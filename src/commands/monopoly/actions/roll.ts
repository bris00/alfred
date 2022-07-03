import { Result } from "@/result";
import {
    DMChannel,
    MessageEmbed,
    NewsChannel,
    PartialDMChannel,
    PartialUser,
    TextChannel,
    ThreadChannel,
    User,
    VoiceChannel,
} from "discord.js";
import { DICE, MAX_SQUARES } from "..";
import { DEEDS } from "../squares/deeds";
import { COMMUNITY_CHESTS } from "../squares/chest";
import { choose, getContext } from "./common";
import { GoToJail, Jail } from "../squares/jail";
import { Square } from "../interfaces/square";
import { Start } from "../squares/start";
import { embed } from "@/alfred";
import { jail } from "./jail";
import { RAILROADS } from "../squares/railroad";
import { Option } from "@/option";
import { ReactionInstanceList } from "@/reactions";
import { rollAgain } from "../reactions";

export const SQUARES: Record<number, Square | undefined> = {};

function addSquares<T extends Square>(sx: Iterable<T>) {
    for (const square of sx) {
        SQUARES[square.square] = square;
    }
}

export function findSquare(square: number): Option<Square> {
    return Option.fromMaybeUndef(SQUARES[square]);
}

addSquares([new Jail(), new GoToJail(), new Start()]);
addSquares(COMMUNITY_CHESTS);
addSquares(Object.values(RAILROADS));
addSquares(Object.values(DEEDS));

const DEFAULT_ACTION: Square = {
    square: NaN,
    searchTerm() {
        return "";
    },
    display: () =>
        Promise.resolve({
            reactions: ReactionInstanceList.create([]),
            embed: embed().addField("Generic square", "Nothing to see here"),
        }),
    land: () => Promise.resolve([]),
};

export async function roll(
    user: User | PartialUser,
    channel:
        | TextChannel
        | DMChannel
        | NewsChannel
        | PartialDMChannel
        | ThreadChannel
        | VoiceChannel
): Promise<Result<void, string>> {
    const reactions = ReactionInstanceList.create([]);

    const context = await getContext(user.id, channel);

    if (context.isErr()) {
        return Result.err(context.unwrapErr());
    }

    const { player, game } = context.unwrap();

    if (new Date() < player.nextTurn) {
        return Result.err("You can't do that yet");
    }

    let info = "";
    let card: MessageEmbed | undefined;

    const roll1 = choose(DICE);
    const roll2 = choose(DICE);

    if (player.getOutOfJail) {
        info += "Released from Jail!\n";
        player.jailed = 0;
    }

    if (roll1 === roll2 && player.jailed > 0) {
        info += "Escaped from Jail!\n";
        player.jailed = 0;
    } else if (player.jailed >= 3) {
        info += "Released from Jail! That will be a $50 fine\n";
        player.jailed = 0;
        player.balance -= 50;
    } else if (roll1 === roll2) {
        player.doubleStreak += 1;
    } else {
        player.doubleStreak = 0;
    }

    if (player.jailed > 0) {
        info += "Still in jail...\n";
        player.jailed += 1;
    } else if (player.doubleStreak >= 3) {
        info += "3 doubles in a row. You are going to Jail!\n";

        player.doubleStreak = 0;
        await jail(player);
    } else {
        player.currentSquare = player.currentSquare + roll1 + roll2;

        if (player.currentSquare >= MAX_SQUARES) {
            info += "Passed start! Here's $200\n";

            player.balance += 200;
            player.currentSquare = player.currentSquare % MAX_SQUARES;
        }

        const square = SQUARES[player.currentSquare] || DEFAULT_ACTION;
        const res = await square.display({ game, channel });

        card = res.embed;
        reactions.extend(res.reactions);

        const fields = await square.land({ player, game, channel });
        card.addFields(...fields);
    }

    if (player.doubleStreak > 0 && player.jailed === 0) {
        info += "Rolled doubles, you may go again\n";

        reactions.add({
            reaction: rollAgain,
            args: [],
        });
    } else {
        const future = new Date();
        future.setSeconds(future.getSeconds() + 1);
        player.nextTurn = future;
    }

    await player.save();

    card = card || embed();
    card.setTitle(`${user.username || "unknown user"} rolling`);
    card.setDescription(`Rolled ${roll1} and ${roll2}\n${info}`);

    const sent = await channel.send({ embeds: [card] });
    await reactions.addToMessage(sent);

    return Result.ok(undefined);
}
