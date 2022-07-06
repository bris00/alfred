import { ReactionInstance } from "@/reactions";
import { DataTypes, Model } from "sequelize";

export class AlfredReaction extends Model {
    uuid!: string;
    messageId!: string;
    reaction!: ReactionInstance;

    static FIELDS = {
        uuid: {
            field: "uuid",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        messageId: {
            field: "message_id",
            type: DataTypes.STRING,
        },
        reaction: {
            field: "reaction",
            type: DataTypes.JSON,
        },
    };
}
