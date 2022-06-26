import { embed, EMPTY_INLINE_FIELD, EMPTY_VALUE, transaction } from "@/alfred";
import { MonopolyPlayer, MonopolyReaction } from "@/database/monopoly";
import { RemoveMethods } from "@/dataclass";
import { Option } from "@/option";
import { Result } from "@/result";
import {
    DMChannel,
    Message,
    NewsChannel,
    PartialUser,
    TextChannel,
    User,
} from "discord.js";
import { go, prepare } from "fuzzysort";
import { Tradable, TradableArgs, TradableKey } from "../interfaces/trade";
import { addReactions } from "../reactions";
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

const TRADABLES: Map<TradableKey, Tradable> = new Map();

Object.values(DEEDS).forEach((deed) => TRADABLES.set(deed.key, deed));
Object.values(RAILROADS).forEach((rr) => TRADABLES.set(rr.key, rr));

const INDEX = [...TRADABLES.values()].flatMap((tradable) =>
    tradable.itemTerms.map((term) => ({ term: prepare(term), tradable }))
);

TRADABLES.set(TradableKey.DOLLAR, {
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

    async click(msg: Message) {
        const [yes, no] = await Promise.all([
            msg.reactions.cache.get("✅")?.users.fetch(),
            msg.reactions.cache.get("❌")?.users.fetch(),
        ]);

        const filter = (user: User) => {
            return [this.parties.from.id, this.parties.to.id].some(
                (id) => id === user.id
            );
        };

        const numYes = yes?.filter(filter).size || 0;
        const numNo = no?.filter(filter).size || 0;

        if (numNo > 0) {
            await this.cancel(msg);
        } else if (numYes >= 2) {
            await this.execute(msg);
        }
    }

    async execute(msg: Message) {
        const fromPlayer = await getPlayer(this.parties.from.id, msg.channel);
        const toPlayer = await getPlayer(this.parties.to.id, msg.channel);

        if (fromPlayer.isErr()) {
            await msg.channel.send(fromPlayer.unwrapErr());
            return;
        }

        if (toPlayer.isErr()) {
            await msg.channel.send(toPlayer.unwrapErr());
            return;
        }

        await MonopolyReaction.destroy({
            where: {
                messageId: msg.id,
            },
        });

        const result = await transaction<string, string>(
            async (transaction) => {
                await Promise.all([
                    ...this.items.from.map(async (item) => {
                        const tradable = Option.fromMaybeUndef(
                            TRADABLES.get(item.key)
                        ).unwrap();

                        await tradable.give({
                            from: fromPlayer.unwrap(),
                            to: toPlayer.unwrap(),
                            amount: item.amount,
                            transaction,
                        });
                    }),
                    ...this.items.to.map(async (item) => {
                        const tradable = Option.fromMaybeUndef(
                            TRADABLES.get(item.key)
                        ).unwrap();

                        await tradable.give({
                            from: toPlayer.unwrap(),
                            to: fromPlayer.unwrap(),
                            amount: item.amount,
                            transaction,
                        });
                    }),
                ]);

                await msg.edit(this.embed(Status.ACCEPTED));

                return "Trade complete";
            }
        );

        if (result.isErr()) {
            await msg.edit(this.embed(Status.FAILED));
            msg.channel.send(result.unwrapErr());
        } else {
            await msg.edit(this.embed(Status.ACCEPTED));
            msg.channel.send(result.unwrap());
        }
    }

    async cancel(msg: Message) {
        await MonopolyReaction.destroy({
            where: {
                messageId: msg.id,
            },
        });

        await msg.edit(this.embed(Status.CANCELED));
    }

    embed(status: Status) {
        function item(i: TradeItem): string {
            if (i.key === TradableKey.DOLLAR) {
                return `$${i.amount}`;
            } else {
                return `${i.amount}x ${TRADABLES.get(i.key)?.displayName}`;
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
                const results = go(item[3], INDEX, {
                    limit: 1,
                    allowTypo: true,
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
    user: User | PartialUser,
    channel: TextChannel | DMChannel | NewsChannel,
    partner: string,
    trade: string
): Promise<Result<void, string>> {
    const items = parseTradeString(trade);

    if (items.isNone()) {
        return Result.err("Bad trade arguments");
    }

    const context = await getContext(user.id, channel);

    if (context.isErr()) {
        return Result.err(context.unwrapErr());
    }

    const { player, game } = context.unwrap();

    const members = await channel.lastMessage?.guild?.members.fetch({
        query: partner,
        limit: 1,
    });
    const member = members?.first();

    if (!member) {
        return Result.err("Could not find member " + partner);
    }

    const tradee = await MonopolyPlayer.findOne({
        where: {
            userId: member.id,
            gameId: player.gameId,
            channelId: player.channelId,
        },
    });

    if (!tradee) {
        return Result.err(
            member.displayName + " is not playing in current game"
        );
    }

    const playerMember = await findMember(channel, player.userId);

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
                id: member.id,
                name: member.displayName,
            },
        },
    };

    const msg = await channel.send(new Trade(data).embed(Status.PENDING));

    await addReactions(game, msg, [
        {
            reaction: "acceptTrade",
            args: [data],
        },
        {
            reaction: "cancelTrade",
            args: [data],
        },
    ]);

    return Result.ok(void 0);
}
