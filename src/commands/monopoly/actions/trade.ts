import { embed, EMPTY_INLINE_FIELD, EMPTY_VALUE, transaction } from "@/alfred";
import { AlfredReaction } from "@/database/alfred";
import { MonopolyPlayer } from "@/database/monopoly";
import { RemoveMethods } from "@/dataclass";
import { Option } from "@/option";
import { ReactionInstanceList } from "@/reactions";
import { Result } from "@/result";
import {
    CommandInteraction,
    MessageComponentInteraction,
    User,
} from "discord.js";
import { go, prepare } from "fuzzysort";
import { Tradable, TradableArgs, TradableKey } from "../interfaces/trade";
import { acceptTrade, cancelTrade } from "../reactions";
import { DEEDS } from "../squares/deeds";
import { RAILROADS } from "../squares/railroad";
import { findMember, getContext, getPlayer } from "./common";

const DOLLAR_REG = /^\$([0-9]+)$/i;
const ITEM_REG = /^(([0-9]+)x )?(.+)$/i;

enum Status {
    CANCELED = "Canceled",
    PENDING = "Pending",
    ACCEPTED = "Accepted",
    FAILED = "Failed",
}

type TradeItem = { readonly key: TradableKey; readonly amount: number };

type TradeItems = {
    from: TradeItem[];
    to: TradeItem[];
};

let _TRADABLES: Map<TradableKey, Tradable> | null = null;

function tradables(): Map<TradableKey, Tradable> {
    if (_TRADABLES === null) {
        const tradables = new Map<TradableKey, Tradable>();

        Object.values(DEEDS).forEach((deed) => tradables.set(deed.key, deed));
        Object.values(RAILROADS).forEach((rr) => tradables.set(rr.key, rr));

        tradables.set(TradableKey.DOLLAR, {
            key: TradableKey.DOLLAR,
            itemTerms: [],
            displayName: "$",
            async give({ from, to, amount, transaction }: TradableArgs) {
                if (from.balance < amount) {
                    throw "Not enough money";
                }

                from.balance -= amount;
                to.balance += amount;

                await from.save({ transaction });
                await to.save({ transaction });
            },
        });

        _TRADABLES = tradables;
    }

    return _TRADABLES;
}

let _INDEX: { term: Fuzzysort.Prepared; tradable: Tradable }[] | null = null;

function index() {
    if (_INDEX === null) {
        const index = [...tradables().values()].flatMap((tradable) =>
            tradable.itemTerms.map((term) => ({
                term: prepare(term),
                tradable,
            }))
        );

        _INDEX = index;
    }

    return _INDEX;
}

export class Trade {
    items: TradeItems;

    parties: {
        from: {
            id: string;
            name: string;
        };
        to: {
            id: string;
            name: string;
        };
    };

    constructor(data: RemoveMethods<Trade>) {
        this.items = data.items;
        this.parties = data.parties;
    }

    async click(
        accept: boolean,
        interaction: MessageComponentInteraction,
        gameChannelId: string,
        gameId: number
    ) {
        if (
            interaction.user.id in [this.parties.from.id, this.parties.to.id] &&
            !accept
        ) {
            await this.cancel(interaction);
        } else if (interaction.user.id === this.parties.to.id && accept) {
            await this.execute(interaction, gameChannelId, gameId);
        }
    }

    async execute(
        interaction: MessageComponentInteraction,
        gameChannelId: string,
        gameId: number
    ) {
        const fromPlayer = await getPlayer(
            this.parties.from.id,
            gameChannelId,
            gameId
        );

        const toPlayer = await getPlayer(
            this.parties.to.id,
            gameChannelId,
            gameId
        );

        if (fromPlayer.isErr()) {
            await interaction.reply(fromPlayer.unwrapErr());
            return;
        }

        if (toPlayer.isErr()) {
            await interaction.reply(toPlayer.unwrapErr());
            return;
        }

        await AlfredReaction.destroy({
            where: {
                messageId: interaction.message.id,
            },
        });

        const result = await transaction<string>(async (transaction) => {
            await Promise.all([
                ...this.items.from.map(async (item) => {
                    const tradable = Option.fromUndef(
                        tradables().get(item.key)
                    ).unwrap();

                    await tradable.give({
                        from: fromPlayer.unwrap(),
                        to: toPlayer.unwrap(),
                        amount: item.amount,
                        transaction,
                    });
                }),
                ...this.items.to.map(async (item) => {
                    const tradable = Option.fromUndef(
                        tradables().get(item.key)
                    ).unwrap();

                    await tradable.give({
                        from: toPlayer.unwrap(),
                        to: fromPlayer.unwrap(),
                        amount: item.amount,
                        transaction,
                    });
                }),
            ]);

            return "Trade complete";
        });

        if (result.isErr()) {
            if ("edit" in interaction.message) {
                await interaction.message.edit({
                    embeds: [this.embed(Status.FAILED)],
                });
            }

            await interaction.reply(result.unwrapErr().toString());
        } else {
            if ("edit" in interaction.message) {
                await interaction.message.edit({
                    embeds: [this.embed(Status.ACCEPTED)],
                });
            }

            await interaction.reply(result.unwrap());
        }
    }

    async cancel(interaction: MessageComponentInteraction) {
        await AlfredReaction.destroy({
            where: {
                messageId: interaction.message.id,
            },
        });

        if ("edit" in interaction.message) {
            await interaction.message.edit({
                embeds: [this.embed(Status.CANCELED)],
            });
        }
    }

    embed(status: Status) {
        function item(i: TradeItem): string {
            if (i.key === TradableKey.DOLLAR) {
                return `$${i.amount}`;
            } else {
                return `${i.amount}x ${
                    tradables().get(i.key)?.displayName || "?"
                }`;
            }
        }

        return embed()
            .setTitle(status)
            .setDescription("Both parties needs to accept trade")
            .addFields([
                {
                    name: this.parties.from.name,
                    value: this.items.from.map(item).join("\n") || EMPTY_VALUE,
                    inline: true,
                },
                {
                    name: this.parties.to.name,
                    value: this.items.to.map(item).join("\n") || EMPTY_VALUE,
                    inline: true,
                },
                EMPTY_INLINE_FIELD,
            ]);
    }
}

const TRADE_SIDES_SEP = "<>";
const TRADE_ITEM_SEP = ",";

function parseTradeString(trade: string): Option<TradeItems> {
    const split = trade.split(TRADE_SIDES_SEP);

    if (split.length !== 2) {
        return Option.none();
    }

    const [from, to] = split;

    function parseItems(terms: string): Option<TradeItem[]> {
        const items: TradeItem[] = [];

        for (const term of terms
            .split(TRADE_ITEM_SEP)
            .map((i) => i.trim())
            .filter(Boolean)) {
            const dollar = term.match(DOLLAR_REG);

            if (dollar) {
                items.push({ key: TradableKey.DOLLAR, amount: +dollar[1] });
                continue;
            }

            const item = term.match(ITEM_REG);

            if (item) {
                const results = go(item[3], index(), {
                    limit: 1,
                    threshold: -Infinity,
                    key: "term",
                });

                if (results[0]) {
                    items.push({
                        key: results[0].obj.tradable.key,
                        amount: +item[2] || 1,
                    });
                    continue;
                }
            }

            return Option.none();
        }

        return Option.some(items);
    }

    return parseItems(from).flatMap((from) =>
        parseItems(to).map((to) => ({ from, to }))
    );
}

export async function trade(
    interaction: CommandInteraction,
    gameChannelId: string,
    gameId: number,
    partner: User,
    trade: string
): Promise<Result<void, string>> {
    const items = parseTradeString(trade);

    if (items.isNone()) {
        return Result.err("Bad trade arguments");
    }

    const context = await getContext(interaction, gameChannelId, gameId);

    if (context.isErr()) {
        return Result.err(context.unwrapErr());
    }

    const { player, guild, game } = context.unwrap();

    const tradee = await MonopolyPlayer.findOne({
        where: {
            userId: partner.id,
            gameId: player.gameId,
            channelId: player.channelId,
        },
    });

    if (!tradee) {
        return Result.err(`${partner.username} is not playing in current game`);
    }

    const playerMember = await findMember(
        { game, guild, player },
        player.userId
    );

    if (playerMember.isNone()) {
        return Result.err(
            "Could not find player's discord member. (E_MEMBER_TOO_SMALL)"
        );
    }

    const trader = playerMember.unwrap();

    const data = {
        items: items.unwrap(),
        parties: {
            from: {
                id: trader.id,
                name: trader.displayName,
            },
            to: {
                id: partner.id,
                name: partner.username,
            },
        },
    };

    const { components } = await ReactionInstanceList.create([
        {
            reaction: acceptTrade,
            args: [data, gameChannelId, gameId],
        },
        {
            reaction: cancelTrade,
            args: [data, gameChannelId, gameId],
        },
    ]).createComponents();

    await interaction.reply({
        embeds: [new Trade(data).embed(Status.PENDING)],
        components,
    });

    return Result.ok(void 0);
}
