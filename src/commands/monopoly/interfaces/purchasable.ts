import { MonopolyPlayer } from "@/database/monopoly";

export interface Purchasable {
    buy(player: MonopolyPlayer): Promise<string>;
}
