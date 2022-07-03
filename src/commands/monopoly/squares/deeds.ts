import { embed, EMPTY_FIELD, EMPTY_INLINE_FIELD, transaction } from "@/alfred";
import { MonopolyDeed, MonopolyPlayer } from "@/database/monopoly";
import { groupOf, RemoveMethods } from "@/dataclass";
import { Option } from "@/option";
import { ReactionInstanceList } from "@/reactions";
import { Result } from "@/result";
import { EmbedField } from "discord.js";
import { Context } from "..";
import { dollar, findMember } from "../actions/common";
import { DisplayResult } from "../interfaces/display";
import { Mortagable } from "../interfaces/mortage";
import { Purchasable } from "../interfaces/purchasable";
import { Square } from "../interfaces/square";
import { Tradable, TradableArgs, TradableKey } from "../interfaces/trade";
import { buy, buyHotel, buyHouse, mortage } from "../reactions";

enum COLOR {
    BROWN = 0xb35100,
    LIGHT_BLUE = 0x0c9999,
    RED = 0xb30000,
    ORANGE = 0xff7f15,
    GREEN = 0x008f00,
    YELLOW = 0xffb115,
    PINK = 0xcd117b,
    BLUE = 0x082a78,
}

const COLOR_NAME: { [key in COLOR]: string } = {
    [COLOR.BROWN]: "Brown",
    [COLOR.LIGHT_BLUE]: "Light blue",
    [COLOR.RED]: "Red",
    [COLOR.ORANGE]: "Orange",
    [COLOR.GREEN]: "Green",
    [COLOR.YELLOW]: "Yellow",
    [COLOR.PINK]: "Pink",
    [COLOR.BLUE]: "Blue",
};

export class Deed implements Square, Mortagable, Purchasable, Tradable {
    key!: TradableKey;
    itemTerms!: string[];
    displayName: string;

    name!: string;
    color!: COLOR;
    square!: number;

    rent!: {
        base: number;
        set: number;
        house1: number;
        house2: number;
        house3: number;
        house4: number;
        hotel: number;
    };

    cost!: {
        deed: number;
        house: number;
        hotel: number;
    };

    mortage!: number;

    constructor(deed: Omit<RemoveMethods<Deed>, "displayName">) {
        Object.assign(this, deed);

        this.itemTerms.push(this.name);
        this.displayName = this.name;
    }

    async give({ from, to, amount, transaction }: TradableArgs): Promise<void> {
        if (amount !== 1) {
            throw "Can only trade properties without amounts";
        }

        const deed = await MonopolyDeed.findOne({
            transaction,
            where: {
                gameId: from.gameId,
                channelId: from.channelId,
                deedName: this.name,
            },
        });

        if (deed?.userId !== from.userId) {
            throw `Must be owner of ${this.name} to trade it`;
        }

        deed.userId = to.userId;
        await deed.save({ transaction });
    }

    searchTerm() {
        return this.name;
    }

    async doMortage(player: MonopolyPlayer): Promise<string> {
        const result = await transaction<string>(async (transaction) => {
            const deed = await MonopolyDeed.findOne({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    deedName: this.name,
                },
            });

            if (!deed) {
                throw `you must own ${this.name} to mortage it`;
            }

            const deeds = await Promise.all(
                COLORS[this.color]
                    .map((k) => DEEDS[k])
                    .map((d) =>
                        MonopolyDeed.findOne({
                            transaction,
                            where: {
                                gameId: player.gameId,
                                channelId: player.channelId,
                                deedName: d.name,
                            },
                        })
                    )
            );

            if (
                !deeds.every(
                    (d) =>
                        !d ||
                        d.userId !== player.userId ||
                        (!d.hotel && d.houses === 0)
                )
            ) {
                throw `all deeds on monopoly ${
                    COLOR_NAME[this.color]
                } must be unimproved to mortage ${this.name}`;
            }

            deed.mortaged = true;
            player.balance += this.mortage;

            await Promise.all([
                deed.save({ transaction }),
                player.save({ transaction }),
            ]);

            return "mortaged " + this.name;
        });

        return Result.collapse(result.mapErr((x) => x.toString()));
    }

    async display({ game, channel }: Context): Promise<DisplayResult> {
        const deed = await MonopolyDeed.findOne({
            where: {
                gameId: game.gameId,
                channelId: game.channelId,
                deedName: this.name,
            },
        });

        const user = await Option.promise(
            Option.fromFalsy(deed?.userId).map((id) => findMember(channel, id))
        );

        return {
            embed: embed()
                .setColor(this.color)
                .addFields(
                    { name: "Deed", value: this.name, inline: true },
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
                        name: "Houses",
                        value: (deed?.houses || 0).toString(),
                        inline: true,
                    },
                    {
                        name: "Hotel",
                        value: deed?.hotel ? "yes" : "no",
                        inline: true,
                    },
                    {
                        name: "Mortaged",
                        value: deed?.mortaged ? "yes" : "no",
                        inline: true,
                    },
                    {
                        name: "Rent site only",
                        value: dollar(this.rent.base),
                        inline: true,
                    },
                    {
                        name: "Rent with 1 house",
                        value: dollar(this.rent.house1),
                        inline: true,
                    },
                    {
                        name: "Rent with 2 houses",
                        value: dollar(this.rent.house2),
                        inline: true,
                    },
                    {
                        name: "Rent with 3 houses",
                        value: dollar(this.rent.house3),
                        inline: true,
                    },
                    {
                        name: "Rent with 4 houses",
                        value: dollar(this.rent.house4),
                        inline: true,
                    },
                    {
                        name: "Rent with hotel",
                        value: dollar(this.rent.hotel),
                        inline: true,
                    },
                    {
                        name: "Price",
                        value: dollar(this.cost.deed),
                        inline: true,
                    },
                    {
                        name: "Mortage",
                        value: dollar(this.mortage),
                        inline: true,
                    },
                    EMPTY_INLINE_FIELD
                ),
            reactions: ReactionInstanceList.create([
                {
                    reaction: buy,
                    args: [this.square],
                },
                {
                    reaction: buyHouse,
                    args: [this.square],
                },
                {
                    reaction: buyHotel,
                    args: [this.square],
                },
                {
                    reaction: mortage,
                    args: [this.square],
                },
            ]),
        };
    }

    async land({ player, channel }: Context): Promise<EmbedField[]> {
        const result = await transaction(async (transaction) => {
            const deed = await MonopolyDeed.findOne({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    deedName: this.name,
                },
            });

            if (!deed || deed.userId === player.userId) {
                return [];
            }

            if (deed.mortaged) {
                return [];
            }

            let rent;

            if (deed.hotel) {
                rent = this.rent.hotel;
            } else if (deed.houses == 0) {
                rent = this.rent.base;
            } else if (deed.houses == 1) {
                rent = this.rent.house1;
            } else if (deed.houses == 2) {
                rent = this.rent.house2;
            } else if (deed.houses == 3) {
                rent = this.rent.house3;
            } else {
                rent = this.rent.house4;
            }

            const owner = await MonopolyPlayer.findOne({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    userId: deed.userId,
                },
            });

            if (!owner) {
                throw new Error("Missing deed owner");
            }

            owner.balance += rent;
            player.balance -= rent;

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
                    value: dollar(rent),
                    inline: false,
                },
            ];
        });

        if (result.isErr()) {
            console.error(result.unwrapErr());
        }

        return result.unwrap();
    }

    async buyHouse(player: MonopolyPlayer) {
        const result = await transaction<string>(async (transaction) => {
            if (player.balance < this.cost.house) {
                throw "cannot afford a house on " + this.name;
            }

            const deed = await MonopolyDeed.findOne({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    deedName: this.name,
                },
            });

            if (!deed || deed.userId !== player.userId) {
                throw "you do not own " + this.name;
            }

            if (deed.houses >= 4) {
                throw "you already own 4 houses on " + this.name;
            }

            const fullSet = await Promise.all(
                COLORS[this.color].map((name) =>
                    MonopolyDeed.findOne({
                        transaction,
                        where: {
                            gameId: player.gameId,
                            channelId: player.channelId,
                            deedName: name,
                        },
                    })
                )
            );

            if (!fullSet.every((d) => d && d.userId === player.userId)) {
                throw (
                    "you do not own all deeds in monopoly " +
                    COLOR_NAME[this.color]
                );
            }

            if (!fullSet.every((d) => d && d.houses >= deed.houses)) {
                throw (
                    "must build houses evenly in monopoly " +
                    COLOR_NAME[this.color]
                );
            }

            player.balance -= this.cost.house;
            deed.houses += 1;

            await Promise.all([
                player.save({ transaction }),
                deed.save({ transaction }),
            ]);

            return "bought house on " + this.name;
        });

        return Result.collapse(result.mapErr((x) => x.toString()));
    }

    async buyHotel(player: MonopolyPlayer) {
        const result = await transaction<string>(async (transaction) => {
            if (player.balance < this.cost.hotel) {
                throw "cannot afford a hotel on " + this.name;
            }

            const deed = await MonopolyDeed.findOne({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    deedName: this.name,
                },
            });

            if (!deed || deed.userId !== player.userId) {
                throw "you do not own " + this.name;
            }

            if (deed.hotel) {
                throw "you already own a hotel on " + this.name;
            }

            const fullSet = await Promise.all(
                COLORS[this.color].map((name) =>
                    MonopolyDeed.findOne({
                        transaction,
                        where: {
                            gameId: player.gameId,
                            channelId: player.channelId,
                            deedName: name,
                        },
                    })
                )
            );

            if (!fullSet.every((d) => d && d.userId === player.userId)) {
                throw (
                    "you do not own all deeds in monopoly " +
                    COLOR_NAME[this.color]
                );
            }

            if (!fullSet.every((d) => d && (d.houses >= 4 || d.hotel))) {
                throw (
                    "you do not own 4 houses or a hotel on all deeds in monopoly " +
                    COLOR_NAME[this.color]
                );
            }

            player.balance -= this.cost.hotel;
            deed.houses = 0;
            deed.hotel = true;

            await Promise.all([
                player.save({ transaction }),
                deed.save({ transaction }),
            ]);

            return "bought hotel on " + this.name;
        });

        return Result.collapse(result.mapErr((x) => x.toString()));
    }

    async buy(player: MonopolyPlayer) {
        const result = await transaction<string>(async (transaction) => {
            if (player.currentSquare !== this.square) {
                throw "you can only buy deeds you are standing on";
            }

            if (player.balance < this.cost.deed) {
                throw "cannot afford " + this.name;
            }

            const [deed, built] = await MonopolyDeed.findOrBuild({
                transaction,
                where: {
                    gameId: player.gameId,
                    channelId: player.channelId,
                    deedName: this.name,
                },
            });

            if (!built) {
                throw "someone already ownes " + this.name;
            }

            player.balance -= this.cost.deed;
            deed.userId = player.userId;

            await Promise.all([
                player.save({ transaction }),
                deed.save({ transaction }),
            ]);

            return "bought " + this.name;
        });

        return Result.collapse(result.mapErr((x) => x.toString()));
    }
}

export const DEEDS = groupOf(Deed, (deed) => deed.name, [
    {
        name: "Brown 1",
        color: COLOR.BROWN,
        square: 1,
        rent: {
            base: 2,
            set: 4,
            house1: 10,
            house2: 30,
            house3: 90,
            house4: 160,
            hotel: 250,
        },
        cost: {
            deed: 60,
            house: 50,
            hotel: 50,
        },
        mortage: 30,
        itemTerms: [],
        key: TradableKey.PROPERTY_1,
    },
    {
        name: "Brown 2",
        color: COLOR.BROWN,
        square: 3,
        rent: {
            base: 4,
            set: 8,
            house1: 20,
            house2: 60,
            house3: 180,
            house4: 320,
            hotel: 450,
        },
        cost: {
            deed: 60,
            house: 50,
            hotel: 50,
        },
        mortage: 30,
        itemTerms: [],
        key: TradableKey.PROPERTY_2,
    },
    {
        name: "Light Blue 1",
        color: COLOR.LIGHT_BLUE,
        square: 6,
        rent: {
            base: 6,
            set: 12,
            house1: 30,
            house2: 90,
            house3: 270,
            house4: 400,
            hotel: 550,
        },
        cost: {
            deed: 100,
            house: 50,
            hotel: 50,
        },
        mortage: 50,
        itemTerms: [],
        key: TradableKey.PROPERTY_3,
    },
    {
        name: "Light Blue 2",
        color: COLOR.LIGHT_BLUE,
        square: 8,
        rent: {
            base: 6,
            set: 12,
            house1: 30,
            house2: 90,
            house3: 270,
            house4: 400,
            hotel: 550,
        },
        cost: {
            deed: 100,
            house: 50,
            hotel: 50,
        },
        mortage: 50,
        itemTerms: [],
        key: TradableKey.PROPERTY_4,
    },
    {
        name: "Light Blue 3",
        color: COLOR.LIGHT_BLUE,
        square: 9,
        rent: {
            base: 8,
            set: 16,
            house1: 40,
            house2: 100,
            house3: 300,
            house4: 450,
            hotel: 600,
        },
        cost: {
            deed: 120,
            house: 50,
            hotel: 50,
        },
        mortage: 60,
        itemTerms: [],
        key: TradableKey.PROPERTY_5,
    },
    {
        name: "Pink 1",
        color: COLOR.PINK,
        square: 11,
        rent: {
            base: 10,
            set: 20,
            house1: 50,
            house2: 150,
            house3: 450,
            house4: 625,
            hotel: 750,
        },
        cost: {
            deed: 140,
            house: 100,
            hotel: 100,
        },
        mortage: 70,
        itemTerms: [],
        key: TradableKey.PROPERTY_6,
    },
    {
        name: "Pink 2",
        color: COLOR.PINK,
        square: 13,
        rent: {
            base: 12,
            set: 24,
            house1: 60,
            house2: 180,
            house3: 500,
            house4: 700,
            hotel: 900,
        },
        cost: {
            deed: 140,
            house: 100,
            hotel: 100,
        },
        mortage: 70,
        itemTerms: [],
        key: TradableKey.PROPERTY_7,
    },
    {
        name: "Pink 3",
        color: COLOR.PINK,
        square: 14,
        rent: {
            base: 10,
            set: 20,
            house1: 50,
            house2: 150,
            house3: 450,
            house4: 625,
            hotel: 750,
        },
        cost: {
            deed: 160,
            house: 100,
            hotel: 100,
        },
        mortage: 80,
        itemTerms: [],
        key: TradableKey.PROPERTY_8,
    },
    {
        name: "Orange 1",
        color: COLOR.ORANGE,
        square: 16,
        rent: {
            base: 14,
            set: 28,
            house1: 70,
            house2: 200,
            house3: 550,
            house4: 750,
            hotel: 950,
        },
        cost: {
            deed: 180,
            house: 100,
            hotel: 100,
        },
        mortage: 90,
        itemTerms: [],
        key: TradableKey.PROPERTY_9,
    },
    {
        name: "Orange 2",
        color: COLOR.ORANGE,
        square: 18,
        rent: {
            base: 14,
            set: 28,
            house1: 70,
            house2: 200,
            house3: 550,
            house4: 750,
            hotel: 950,
        },
        cost: {
            deed: 180,
            house: 100,
            hotel: 100,
        },
        mortage: 90,
        itemTerms: [],
        key: TradableKey.PROPERTY_10,
    },
    {
        name: "Orange 3",
        color: COLOR.ORANGE,
        square: 19,
        rent: {
            base: 16,
            set: 32,
            house1: 80,
            house2: 220,
            house3: 600,
            house4: 800,
            hotel: 1000,
        },
        cost: {
            deed: 200,
            house: 100,
            hotel: 100,
        },
        mortage: 100,
        itemTerms: [],
        key: TradableKey.PROPERTY_11,
    },
    {
        name: "Red 1",
        color: COLOR.RED,
        square: 21,
        rent: {
            base: 18,
            set: 36,
            house1: 90,
            house2: 250,
            house3: 700,
            house4: 875,
            hotel: 1050,
        },
        cost: {
            deed: 220,
            house: 150,
            hotel: 150,
        },
        mortage: 110,
        itemTerms: [],
        key: TradableKey.PROPERTY_12,
    },
    {
        name: "Red 2",
        color: COLOR.RED,
        square: 23,
        rent: {
            base: 20,
            set: 40,
            house1: 100,
            house2: 300,
            house3: 750,
            house4: 925,
            hotel: 1100,
        },
        cost: {
            deed: 220,
            house: 150,
            hotel: 150,
        },
        mortage: 110,
        itemTerms: [],
        key: TradableKey.PROPERTY_13,
    },
    {
        name: "Red 3",
        color: COLOR.RED,
        square: 24,
        rent: {
            base: 18,
            set: 36,
            house1: 90,
            house2: 250,
            house3: 700,
            house4: 875,
            hotel: 1050,
        },
        cost: {
            deed: 240,
            house: 150,
            hotel: 150,
        },
        mortage: 120,
        itemTerms: [],
        key: TradableKey.PROPERTY_14,
    },
    {
        name: "Yellow 1",
        color: COLOR.YELLOW,
        square: 26,
        rent: {
            base: 22,
            set: 44,
            house1: 110,
            house2: 330,
            house3: 800,
            house4: 975,
            hotel: 1150,
        },
        cost: {
            deed: 260,
            house: 150,
            hotel: 150,
        },
        mortage: 130,
        itemTerms: [],
        key: TradableKey.PROPERTY_15,
    },
    {
        name: "Yellow 2",
        color: COLOR.YELLOW,
        square: 27,
        rent: {
            base: 22,
            set: 44,
            house1: 110,
            house2: 330,
            house3: 800,
            house4: 975,
            hotel: 1150,
        },
        cost: {
            deed: 260,
            house: 150,
            hotel: 150,
        },
        mortage: 130,
        itemTerms: [],
        key: TradableKey.PROPERTY_16,
    },
    {
        name: "Yellow 3",
        color: COLOR.YELLOW,
        square: 29,
        rent: {
            base: 24,
            set: 48,
            house1: 120,
            house2: 360,
            house3: 850,
            house4: 1025,
            hotel: 1200,
        },
        cost: {
            deed: 280,
            house: 150,
            hotel: 150,
        },
        mortage: 140,
        itemTerms: [],
        key: TradableKey.PROPERTY_17,
    },
    {
        name: "Green 1",
        color: COLOR.GREEN,
        square: 31,
        rent: {
            base: 26,
            set: 52,
            house1: 130,
            house2: 390,
            house3: 900,
            house4: 1100,
            hotel: 1275,
        },
        cost: {
            deed: 300,
            house: 200,
            hotel: 200,
        },
        mortage: 150,
        itemTerms: [],
        key: TradableKey.PROPERTY_18,
    },
    {
        name: "Green 2",
        color: COLOR.GREEN,
        square: 32,
        rent: {
            base: 28,
            set: 56,
            house1: 150,
            house2: 450,
            house3: 1000,
            house4: 1200,
            hotel: 1400,
        },
        cost: {
            deed: 300,
            house: 200,
            hotel: 200,
        },
        mortage: 150,
        itemTerms: [],
        key: TradableKey.PROPERTY_19,
    },
    {
        name: "Green 3",
        color: COLOR.GREEN,
        square: 34,
        rent: {
            base: 26,
            set: 52,
            house1: 130,
            house2: 390,
            house3: 900,
            house4: 1100,
            hotel: 1275,
        },
        cost: {
            deed: 320,
            house: 200,
            hotel: 200,
        },
        mortage: 160,
        itemTerms: [],
        key: TradableKey.PROPERTY_20,
    },
    {
        name: "Blue 1",
        color: COLOR.BLUE,
        square: 37,
        rent: {
            base: 50,
            set: 100,
            house1: 200,
            house2: 600,
            house3: 1400,
            house4: 1700,
            hotel: 2000,
        },
        cost: {
            deed: 350,
            house: 200,
            hotel: 200,
        },
        mortage: 175,
        itemTerms: [],
        key: TradableKey.PROPERTY_21,
    },
    {
        name: "Blue 2",
        color: COLOR.BLUE,
        square: 39,
        rent: {
            base: 35,
            set: 70,
            house1: 175,
            house2: 500,
            house3: 1100,
            house4: 1300,
            hotel: 1500,
        },
        cost: {
            deed: 400,
            house: 200,
            hotel: 200,
        },
        mortage: 200,
        itemTerms: [],
        key: TradableKey.PROPERTY_22,
    },
]);

type Colors = Record<COLOR, (keyof typeof DEEDS)[]>;

export const COLORS = Object.entries(DEEDS).reduce(
    (record: Partial<Colors>, [key, value]) => {
        const keys = record[value.color];

        if (keys) {
            keys.push(key);
        } else {
            record[value.color] = [key];
        }

        return record;
    },
    {}
) as Colors;
