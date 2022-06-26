import { embed, EMPTY_FIELD, EMPTY_INLINE_FIELD, transaction } from "@/alfred";
import { MonopolyPlayer, MonopolyRailroad } from "@/database/monopoly";
import { groupOf, RemoveMethods } from "@/dataclass";
import { Option } from "@/option";
import { Result } from "@/result";
import { EmbedField } from "discord.js";
import { Context } from "..";
import { dollar, findMember } from "../actions/common";
import { DisplayResult } from "../interfaces/display";
import { Mortagable } from "../interfaces/mortage";
import { Purchasable } from "../interfaces/purchasable";
import { Square } from "../interfaces/square";
import { Tradable, TradableArgs, TradableKey } from "../interfaces/trade";

export class Railroad implements Square, Mortagable, Purchasable, Tradable {
    key!: TradableKey;
    itemTerms!: string[];
    displayName: string;

    name!: string;
    square!: number;
    price!: number;
    mortage!: number;

    rent!: {
        1: number;
        2: number;
        3: number;
        4: number;
    };

    constructor(rr: Omit<RemoveMethods<Railroad>, "displayName">) {
        Object.assign(this, rr);

        this.itemTerms.push(this.name);
        this.displayName = this.name;
    }

    async give({ from, to, amount, transaction }: TradableArgs): Promise<void> {
        if (amount !== 1) {
            throw "Can only trade railroads without amounts";
        }

        const rr = await MonopolyRailroad.findOne({
            transaction,
            where: {
                gameId: from.gameId,
                channelId: from.channelId,
                deedName: this.name,
            },
        });

        if (rr?.userId !== from.userId) {
            throw `Must be owner of ${this.name} to trade it`;
        }

        rr.userId = to.userId;
        await rr.save({ transaction });
    }

    searchTerm() {
        return this.name;
    }

    async doMortage(player: MonopolyPlayer): Promise<string> {
        const result = await transaction<string, string>(
            async (transaction) => {
                const railroad = await MonopolyRailroad.findOne({
                    transaction,
                    where: {
                        gameId: player.gameId,
                        channelId: player.channelId,
                        railroadName: this.name,
                    },
                });

                if (!railroad) {
                    throw `you must own ${this.name} to mortage it`;
                }

                railroad.mortaged = true;
                player.balance += this.mortage;

                railroad.save({ transaction });
                player.save({ transaction });

                return "mortaged " + this.name;
            }
        );

        return Result.collapse(result);
    }

    async display({ game, channel }: Context): Promise<DisplayResult> {
        const railroad = await MonopolyRailroad.findOne({
            where: {
                gameId: game.gameId,
                channelId: game.channelId,
                railroadName: this.name,
            },
        });

        const user = await Option.promise(
            Option.fromFalsy(railroad?.userId).map((id) =>
                findMember(channel, id)
            )
        );

        return {
            embed: embed()
                .setColor("0xEEEEEE")
                .addFields(
                    { name: "Railroad", value: this.name, inline: true },
                    {
                        name: "Owner",
                        inline: true,
                        value: user
                            .map((u) =>
                                u.map((u) => u.displayName).unwrapOr("N/A")
                            )
                            .unwrapOr("--------"),
                    },
                    EMPTY_INLINE_FIELD,
                    {
                        name: "Mortaged",
                        value: railroad?.mortaged ? "yes" : "no",
                        inline: true,
                    },
                    EMPTY_INLINE_FIELD,
                    EMPTY_INLINE_FIELD,
                    { name: "Rent", value: dollar(this.rent[1]), inline: true },
                    EMPTY_INLINE_FIELD,
                    EMPTY_INLINE_FIELD,
                    {
                        name: "Rent if 2 R.R are owned",
                        value: dollar(this.rent[2]),
                        inline: true,
                    },
                    {
                        name: "Rent if 3 R.R are owned",
                        value: dollar(this.rent[3]),
                        inline: true,
                    },
                    {
                        name: "Rent if 4 R.R are owned",
                        value: dollar(this.rent[4]),
                        inline: true,
                    },
                    { name: "Price", value: dollar(this.price), inline: true },
                    {
                        name: "Mortage value",
                        value: dollar(this.mortage),
                        inline: true,
                    },
                    EMPTY_INLINE_FIELD
                ),
            reactions: [
                {
                    reaction: "buy",
                    args: [this.square],
                },
                {
                    reaction: "mortage",
                    args: [this.square],
                },
            ],
        };
    }

    async land({ player, channel }: Context): Promise<EmbedField[]> {
        const result = await transaction(async (transaction) => {
            const railroad = await MonopolyRailroad.findOne({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    railroadName: this.name,
                },
            });

            if (!railroad || railroad.userId === player.userId) {
                return [];
            }

            if (railroad.mortaged) {
                return [];
            }

            const num_owned = await MonopolyRailroad.count({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    userId: railroad.userId,
                },
            });

            if (!(num_owned in this.rent)) {
                throw new Error("Bad number of owned railroads");
            }

            const sum = this.rent[
                num_owned as keyof typeof Railroad.prototype.rent
            ];

            const owner = await MonopolyPlayer.findOne({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    userId: railroad.userId,
                },
            });

            if (!owner) {
                throw new Error("Missing railroad owner");
            }

            owner.balance += sum;
            player.balance -= sum;

            await Promise.all([
                owner.save({ transaction }),
                player.save({ transaction }),
            ]);

            const ownerMember = await findMember(channel, owner.userId);

            return [
                EMPTY_FIELD,
                {
                    name:
                        "Paid rent to " +
                        ownerMember
                            .map((m) => m.displayName)
                            .unwrapOr("unknown"),
                    value: dollar(sum),
                    inline: false,
                },
            ];
        });

        if (result.isErr()) {
            console.error(result.unwrapErr());
        }

        return result.unwrap();
    }

    async buy(player: MonopolyPlayer) {
        const result = await transaction<string, string>(
            async (transaction) => {
                const [rr, built] = await MonopolyRailroad.findOrBuild({
                    transaction,
                    where: {
                        gameId: player.gameId,
                        channelId: player.channelId,
                        railroadName: this.name,
                    },
                });

                if (!built) {
                    throw "someone already ownes " + this.name;
                }

                if (player.balance < this.price) {
                    throw "cannot afford " + this.name;
                }

                player.balance -= this.price;
                rr.userId = player.userId;

                await Promise.all([
                    player.save({ transaction }),
                    rr.save({ transaction }),
                ]);

                return "bought " + this.name;
            }
        );

        return Result.collapse(result);
    }
}

export const RAILROADS = groupOf(Railroad, (rr) => rr.name, [
    {
        name: "Railroad 1",
        square: 5,
        price: 200,
        mortage: 100,
        rent: {
            1: 25,
            2: 50,
            3: 100,
            4: 200,
        },
        key: TradableKey.PROPERTY_23,
        itemTerms: [],
    },
    {
        name: "Railroad 2",
        square: 15,
        price: 200,
        mortage: 100,
        rent: {
            1: 25,
            2: 50,
            3: 100,
            4: 200,
        },
        key: TradableKey.PROPERTY_24,
        itemTerms: [],
    },
    {
        name: "Railroad 3",
        square: 25,
        price: 200,
        mortage: 100,
        rent: {
            1: 25,
            2: 50,
            3: 100,
            4: 200,
        },
        key: TradableKey.PROPERTY_25,
        itemTerms: [],
    },
    {
        name: "Railroad 4",
        square: 35,
        price: 200,
        mortage: 100,
        rent: {
            1: 25,
            2: 50,
            3: 100,
            4: 200,
        },
        key: TradableKey.PROPERTY_26,
        itemTerms: [],
    },
]);
