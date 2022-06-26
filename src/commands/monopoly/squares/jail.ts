import { embed } from "@/alfred";
import { EmbedFieldData } from "discord.js";
import { Context, JAIL } from "..";
import { jail } from "../actions/jail";
import { Square } from "../interfaces/square";

export class GoToJail implements Square {
    square = 30;

    searchTerm() {
        return "Go to Jail!";
    }

    async display() {
        return {
            embed: embed().addField(
                "Go to Jail!",
                "You're going to jail from here"
            ),
            reactions: [],
        };
    }

    async land({ player }: Context) {
        await jail(player);

        return [];
    }
}

export class Jail implements Square {
    square = JAIL;

    searchTerm() {
        return "Jail";
    }

    async display() {
        return {
            embed: embed().addField("Jail", "You are visiting the jail"),
            reactions: [],
        };
    }

    async land(_context: Context): Promise<EmbedFieldData[]> {
        return [];
    }
}
