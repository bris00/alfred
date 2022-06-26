import { MonopolyPlayer } from "@/database/monopoly";
import { JAIL } from "..";

export function jail(player: MonopolyPlayer): Promise<string> {
    player.currentSquare = JAIL;
    player.jailed = 1;

    return Promise.resolve("Go to Jail!");
}
