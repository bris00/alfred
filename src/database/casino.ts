import { DataTypes, Model } from "sequelize";

export class Sentence extends Model {
    userId!: string;
    duration!: string;

    static MODEL_NAME = "sentence";

    static FIELDS = {
        userId: {
            field: "user_id",
            type: DataTypes.STRING,
            primaryKey: true,
        },
        duration: {
            field: "duration",
            type: DataTypes.STRING,
            primaryKey: false,
        },
    };
}
