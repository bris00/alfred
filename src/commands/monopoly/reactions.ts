import { downcastTo } from "@/alfred";
import { MonopolyGame, MonopolyReaction } from "@/database/monopoly";
import { RemoveMethods } from "@/dataclass";
import { Option } from "@/option";
import { MessageReaction, Message, User, PartialUser } from "discord.js";
import { getContext } from "./actions/common";
import { findSquare, roll } from "./actions/roll";
import { Trade } from "./actions/trade";
import { Mortagable } from "./interfaces/mortage";
import { Purchasable } from "./interfaces/purchasable";
import { Deed } from "./squares/deeds";
import { Railroad } from "./squares/railroad";

type Reactions = typeof REACTIONS;
type Args<K extends keyof Reactions> = Parameters<
    ReturnType<Reactions[K]["action"]>
>;

type Distribute<K extends keyof Reactions> = K extends any
    ? { reaction: K; args: Args<K> }
    : never;

export type Reaction = Distribute<keyof Reactions>;

export async function call(
    r: MonopolyReaction,
    user: User | PartialUser,
    mr: MessageReaction
) {
    const ret: ReturnType<ReturnType<Reactions["buy"]["action"]>> = (REACTIONS[
        r.reaction.reaction
    ].action(user, mr) as any)(...r.reaction.args);

    const { remove } = await ret;

    if (remove) {
        await r.destroy();
    }
}

export const REACTIONS = {
    rollAgain: {
        action(clicker: User | PartialUser, reaction: MessageReaction) {
            return async () => {
                const result = await roll(clicker, reaction.message.channel);

                if (result.isErr()) {
                    console.error(result.unwrapErr());
                }

                return { remove: true };
            };
        },
        emoji: "🏃",
    },
    buyHouse: {
        action(clicker: User | PartialUser, reaction: MessageReaction) {
            return async (square: number) => {
                const context = await getContext(
                    clicker.id,
                    reaction.message.channel
                );

                if (context.isErr()) {
                    await reaction.message.channel.send(context.unwrapErr());
                }

                const { player } = context.unwrap();

                const message = await Option.promise(
                    findSquare(square)
                        .flatMap(downcastTo(Deed))
                        .map((d) => d.buyHouse(player))
                );

                await reaction.message.channel.send(
                    clicker.toString() +
                        " " +
                        message.unwrapOr("Cannot buy house on square " + square)
                );

                return { remove: false };
            };
        },
        emoji: "🏠",
    },
    buyHotel: {
        action(clicker: User | PartialUser, reaction: MessageReaction) {
            return async (square: number) => {
                const context = await getContext(
                    clicker.id,
                    reaction.message.channel
                );

                if (context.isErr()) {
                    await reaction.message.channel.send(context.unwrapErr());
                }

                const { player } = context.unwrap();

                const message = await Option.promise(
                    findSquare(square)
                        .flatMap(downcastTo(Deed))
                        .map((d) => d.buyHotel(player))
                );

                await reaction.message.channel.send(
                    clicker.toString() +
                        " " +
                        message.unwrapOr("Cannot buy hotel on square " + square)
                );

                return { remove: true };
            };
        },
        emoji: "🏩",
    },
    buy: {
        action(clicker: User | PartialUser, reaction: MessageReaction) {
            return async (square: number) => {
                const context = await getContext(
                    clicker.id,
                    reaction.message.channel
                );

                if (context.isErr()) {
                    await reaction.message.channel.send(context.unwrapErr());
                }

                const { player } = context.unwrap();

                const message = await Option.promise(
                    findSquare(square)
                        .switch<Purchasable>([
                            downcastTo(Railroad),
                            downcastTo(Deed),
                        ])
                        .map((m) => m.buy(player))
                );

                await reaction.message.channel.send(
                    clicker.toString() +
                        " " +
                        message.unwrapOr(
                            "cannot buy property on square " + square
                        )
                );

                return { remove: true };
            };
        },
        emoji: "💵",
    },
    mortage: {
        action(clicker: User | PartialUser, reaction: MessageReaction) {
            return async (square: number) => {
                const context = await getContext(
                    clicker.id,
                    reaction.message.channel
                );

                if (context.isErr()) {
                    await reaction.message.channel.send(context.unwrapErr());
                }

                const { player } = context.unwrap();

                const message = await Option.promise(
                    findSquare(square)
                        .switch<Mortagable>([
                            downcastTo(Railroad),
                            downcastTo(Deed),
                        ])
                        .map((m) => m.doMortage(player))
                );

                await reaction.message.channel.send(
                    clicker.toString() +
                        " " +
                        message.unwrapOr(
                            "cannot morgage property on square " + square
                        )
                );

                return { remove: true };
            };
        },
        emoji: "↩️",
    },
    acceptTrade: {
        action(_clicker: User | PartialUser, reaction: MessageReaction) {
            return async (trade: RemoveMethods<Trade>) => {
                await new Trade(trade).click(reaction.message);

                return { remove: false };
            };
        },
        emoji: "✅",
    },
    cancelTrade: {
        action(_clicker: User | PartialUser, reaction: MessageReaction) {
            return async (trade: RemoveMethods<Trade>) => {
                await new Trade(trade).click(reaction.message);

                return { remove: false };
            };
        },
        emoji: "❌",
    },
};

export const REACTION_EMOJIS = new Set(
    Object.values(REACTIONS).map((r) => r.emoji)
);

export async function addReactions(
    game: MonopolyGame,
    msg: Message,
    reactions: Reaction[]
) {
    await Promise.all(
        reactions.map(async (reaction) => {
            const template = REACTIONS[reaction.reaction];
            const { emoji } = await msg.react(template.emoji);

            await MonopolyReaction.create({
                messageId: msg.id,
                emoji: emoji.name,
                gameId: game.gameId,
                reaction,
            });
        })
    );
}
