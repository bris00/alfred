import { downcastTo } from "@/alfred";
import { RemoveMethods } from "@/dataclass";
import { Option } from "@/option";
import { createReaction } from "@/reactions";
import { getContext } from "./actions/common";
import { findSquare, roll } from "./actions/roll";
import { Deed } from "./squares/deeds";
import { Trade } from "./actions/trade";
import { Mortagable } from "./interfaces/mortage";
import { Purchasable } from "./interfaces/purchasable";
import { Railroad } from "./squares/railroad";

export const rollAgain = createReaction({
    uuid: "53bd155c-65e5-4784-93de-4562ae413243",
    action(clicker, reaction) {
        return async () => {
            const result = await roll(clicker, reaction.message.channel);

            if (result.isErr()) {
                console.error(result.unwrapErr());
            }

            return { remove: true };
        };
    },
    emoji: "🏃",
});

export const acceptTrade = createReaction({
    uuid: "7d652cbc-f930-49bc-b94d-8af114651362",
    action(_clicker, reaction) {
        return async (trade: RemoveMethods<Trade>) => {
            await new Trade(trade).click(reaction.message);

            return { remove: false };
        };
    },
    emoji: "✅",
});

export const cancelTrade = createReaction({
    uuid: "7264d09c-05cf-425d-bfc8-95500f4796e2",
    action(_clicker, reaction) {
        return async (trade: RemoveMethods<Trade>) => {
            await new Trade(trade).click(reaction.message);

            return { remove: false };
        };
    },
    emoji: "❌",
});

export const buyHouse = createReaction({
    uuid: "8e49843d-cf0c-4444-a89b-1a9b6083c548",
    action(clicker, reaction) {
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
                    message.unwrapOr(`Cannot buy house on square ${square}`)
            );

            return { remove: false };
        };
    },
    emoji: "🏠",
});

export const buyHotel = createReaction({
    uuid: "83200089-2527-4744-be8d-b3ab5835177f",
    action(clicker, reaction) {
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
                    message.unwrapOr(`Cannot buy hotel on square ${square}`)
            );

            return { remove: true };
        };
    },
    emoji: "🏩",
});

export const mortage = createReaction({
    uuid: "4cae48d6-a63a-4d93-9ae0-da2a42cb4bc9",
    action(clicker, reaction) {
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
                        `cannot mortgage property on square ${square}`
                    )
            );

            return { remove: true };
        };
    },
    emoji: "↩️",
});

export const buy = createReaction({
    uuid: "1b91d22f-fcb5-4c00-a22e-8633a1e146e3",
    action(clicker, reaction) {
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
                    message.unwrapOr(`cannot buy property on square ${square}`)
            );

            return { remove: true };
        };
    },
    emoji: "💵",
});
