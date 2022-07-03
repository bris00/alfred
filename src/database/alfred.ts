import { ReactionInstance } from "@/reactions";
import { DataTypes, Model } from "sequelize";

export class AlfredReaction extends Model {
    messageId!: string;
    emoji!: string;
    gameId!: string;
    reaction!: ReactionInstance;

    static FIELDS = {
        messageId: {
            field: "message_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        emoji: {
            field: "emoji",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        gameId: {
            field: "game_id",
            type: DataTypes.STRING,
        },
        reaction: {
            field: "reaction",
            type: DataTypes.JSON,
        },
    };
}
