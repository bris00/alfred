import { MonopolyPlayer } from "@/database/monopoly";
import { Transaction } from "sequelize";

export enum TradableKey {
    RED_CARD = 1,
    GREEN_CARD,
    YELLOW_CARD,
    STICKY_CARD,
    FREEZE_CARD,
    DOUBLE_CARD,
    RESET_CARD,
    GET_OUT_OF_JAIL,
    DOLLAR,
    PROPERTY_1,
    PROPERTY_2,
    PROPERTY_3,
    PROPERTY_4,
    PROPERTY_5,
    PROPERTY_6,
    PROPERTY_7,
    PROPERTY_8,
    PROPERTY_9,
    PROPERTY_10,
    PROPERTY_11,
    PROPERTY_12,
    PROPERTY_13,
    PROPERTY_14,
    PROPERTY_15,
    PROPERTY_16,
    PROPERTY_17,
    PROPERTY_18,
    PROPERTY_19,
    PROPERTY_20,
    PROPERTY_21,
    PROPERTY_22,
    PROPERTY_23,
    PROPERTY_24,
    PROPERTY_25,
    PROPERTY_26,
}

export type TradableArgs = {
    from: MonopolyPlayer;
    to: MonopolyPlayer;
    amount: number;
    transaction: Transaction;
};

export interface Tradable {
    readonly key: TradableKey;
    readonly itemTerms: string[];
    readonly displayName: string;

    give(args: TradableArgs): Promise<void>;
}
