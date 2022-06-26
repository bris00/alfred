import { embed } from "@/alfred";
import { MonopolyPlayer } from "@/database/monopoly";
import { Context } from "..";
import { Square } from "../interfaces/square";
import { advanceTo, draw, shuffle } from "../actions/common";

class Chest implements Square {
    square!: number;

    constructor({ square }: { square: number }) {
        this.square = square;
    }

    searchTerm() {
        return "Community chest";
    }

    async display() {
        return {
            reactions: [],
            embed: embed().addField("Community chest", "A random surprise"),
        };
    }

    async land({ player, game }: Context) {
        game.chestDeck = game.chestDeck || [];

        if (game.chestDeck.length === 0) {
            game.chestDeck = shuffle(CHEST);
        }

        const drawn = draw(game.chestDeck, CHEST);
        game.changed("chestDeck", true);

        const field = drawn(player);

        await game.save();

        return [{ name: "You drew", value: field }];
    }
}

export const COMMUNITY_CHESTS = [
    new Chest({ square: 2 }),
    new Chest({ square: 17 }),
    new Chest({ square: 33 }),
];

const CHEST = [
    (player: MonopolyPlayer) => {
        advanceTo(player, 40);

        return "Advance to GO!";
    },
    (player: MonopolyPlayer) => {
        player.balance += 200;

        return "Bank error in your favor -- Collect $200";
    },
    (player: MonopolyPlayer) => {
        player.balance -= 50;

        return "Doctor's fee -- Pay $50";
    },
    (player: MonopolyPlayer) => {
        player.balance += 50;

        return "From sale of stock you get $50";
    },
    (player: MonopolyPlayer) => {
        player.currentSquare = 10;
        player.jailed = 1;

        return "Go to Jail!";
    },
];
