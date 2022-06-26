import { MonopolyPlayer } from "@/database/monopoly";

export interface Mortagable {
    doMortage(player: MonopolyPlayer): Promise<string>;
}
