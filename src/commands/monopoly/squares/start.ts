import { embed } from "@/alfred";
import { ReactionInstanceList } from "@/reactions";
import { Context } from "..";
import { Square } from "../interfaces/square";

export class Start implements Square {
    square = 0;

    searchTerm() {
        return "Start";
    }

    display() {
        return Promise.resolve({
            embed: embed(),
            reactions: ReactionInstanceList.create([]),
        });
    }

    land(_context: Context) {
        return Promise.resolve([]);
    }
}
