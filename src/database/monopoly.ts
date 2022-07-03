import { DataTypes, Model } from "sequelize";

export class MonopolyGame extends Model {
    channelId!: string;
    gameId!: number;
    started!: boolean;
    ended!: boolean;
    chestDeck!: number[];

    static FIELDS = {
        channelId: {
            field: "channel_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        gameId: {
            field: "game_id",
            type: DataTypes.NUMBER,
            primaryKey: true,
        },
        started: {
            field: "started",
            type: DataTypes.BOOLEAN,
            default: false,
        },
        ended: {
            field: "ended",
            type: DataTypes.BOOLEAN,
            default: false,
        },
        chestDeck: {
            field: "chest_deck",
            type: DataTypes.JSON,
            default: [],
        },
    };
}

export class MonopolyPlayer extends Model {
    userId!: string;
    channelId!: string;
    balance!: number;
    jailed!: number;
    nextTurn!: Date;
    doubleStreak!: number;
    gameId!: number;
    currentSquare!: number;
    getOutOfJail!: boolean;

    static FIELDS = {
        userId: {
            field: "user_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        channelId: {
            field: "channel_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        gameId: {
            field: "game_id",
            type: DataTypes.NUMBER,
            primaryKey: true,
        },
        balance: {
            field: "balance",
            type: DataTypes.NUMBER,
            defaultValue: 0,
        },
        jailed: {
            field: "jailed",
            type: DataTypes.NUMBER,
            defaultValue: 0,
        },
        doubleStreak: {
            field: "double_streak",
            type: DataTypes.NUMBER,
            defaultValue: 0,
        },
        nextTurn: {
            field: "next_turn",
            type: DataTypes.DATE,
            defaultValue: new Date(),
        },
        currentSquare: {
            field: "current_square",
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        getOutOfJail: {
            field: "exit_jail",
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    };
}

export class MonopolyInventory extends Model {
    userId!: string;
    gameId!: string;
    channelId!: string;
    item!: string;
    amount!: number;

    static FIELDS = {
        channelId: {
            field: "channel_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        gameId: {
            field: "game_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        userId: {
            field: "user_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        item: {
            field: "item",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        amount: {
            field: "amount",
            type: DataTypes.NUMBER,
            defaultValue: 0,
        },
    };
}

export class MonopolyDeed extends Model {
    channelId!: string;
    userId!: string | null;
    deedName!: string;
    gameId!: string;
    houses!: number;
    hotel!: boolean;
    mortaged!: boolean;

    static FIELDS = {
        channelId: {
            field: "channel_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        gameId: {
            field: "game_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        deedName: {
            field: "deed_name",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        userId: {
            field: "user_id",
            type: DataTypes.STRING,
            default: null,
        },
        houses: {
            field: "houses",
            type: DataTypes.NUMBER,
            defaultValue: 0,
        },
        hotel: {
            field: "hotel",
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        mortaged: {
            field: "mortaged",
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    };
}

export class MonopolyRailroad extends Model {
    channelId!: string;
    gameId!: string;
    railroadName!: string;
    userId!: string | null;
    mortaged!: boolean;

    static FIELDS = {
        channelId: {
            field: "channel_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        gameId: {
            field: "game_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        railroadName: {
            field: "railroad_name",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        userId: {
            field: "user_id",
            type: DataTypes.STRING,
            defaultValue: null,
        },
        mortaged: {
            field: "mortaged",
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    };
}
