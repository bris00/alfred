import { embed } from "@/alfred";
import { ReactionInstanceList } from "@/reactions";
import { EmbedFieldData } from "discord.js";
import { Context, JAIL } from "..";
import { jail } from "../actions/jail";
import { Square } from "../interfaces/square";

export class GoToJail implements Square {
    square = 30;

    searchTerm() {
        return "Go to Jail!";
    }

    display() {
        return Promise.resolve({
            embed: embed().addField(
                "Go to Jail!",
                "You're going to jail from here"
            ),
            reactions: ReactionInstanceList.create([]),
        });
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

    display() {
        return Promise.resolve({
            embed: embed().addField("Jail", "You are visiting the jail"),
            reactions: ReactionInstanceList.create([]),
        });
    }

    land(_context: Context): Promise<EmbedFieldData[]> {
        return Promise.resolve([]);
    }
}
