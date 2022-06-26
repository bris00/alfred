import { embed } from "@/alfred";
import { Context } from "..";
import { Square } from "../interfaces/square";

export class Start implements Square {
    square = 0;

    searchTerm() {
        return "Start";
    }

    async display() {
        return {
            embed: embed(),
            reactions: [],
        };
    }

    async land(_context: Context) {
        return [];
    }
}
