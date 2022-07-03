import { MonopolyGame, MonopolyPlayer } from "@/database/monopoly";
import { Option } from "@/option";
import { Result } from "@/result";
import {
    DMChannel,
    GuildMember,
    NewsChannel,
    PartialDMChannel,
    TextChannel,
    ThreadChannel,
    VoiceChannel,
} from "discord.js";
import { Context } from "..";

export function dollar(amount: number): string {
    return `$${amount}`;
}

export async function findMember(
    channel:
        | TextChannel
        | NewsChannel
        | DMChannel
        | PartialDMChannel
        | ThreadChannel
        | VoiceChannel,
    userId: string
): Promise<Option<GuildMember>> {
    const member = await channel.lastMessage?.guild?.members.fetch(userId);

    if (typeof member === "undefined" || member === null) {
        return Option.none();
    } else {
        return Option.some(member);
    }
}

export async function getPlayer(
    userId: string,
    channel:
        | TextChannel
        | NewsChannel
        | DMChannel
        | PartialDMChannel
        | ThreadChannel
        | VoiceChannel
): Promise<Result<MonopolyPlayer, string>> {
    if (!(await meetsPlayerConditions(userId))) {
        return Result.err("Not eligible to play");
    }

    const game = await findChannelCurrentGame(channel.id);

    if (game.isNone()) {
        return Result.err("No active game in channel");
    }

    if (!ensureGameRunning(game.unwrap())) {
        return Result.err("No game in play");
    }

    const player = await MonopolyPlayer.findOne({
        where: {
            userId: userId,
            channelId: game.unwrap().channelId,
            gameId: game.unwrap().gameId,
        },
    });

    if (!player) {
        return Result.err("Not playing in current game");
    }

    return Result.ok(player);
}

export async function getContext(
    userId: string,
    channel:
        | TextChannel
        | NewsChannel
        | DMChannel
        | PartialDMChannel
        | ThreadChannel
        | VoiceChannel
): Promise<Result<Context, string>> {
    if (!(await meetsPlayerConditions(userId))) {
        return Result.err("Not eligible to play");
    }

    const game = await findChannelCurrentGame(channel.id);

    if (game.isNone()) {
        return Result.err("No active game in channel");
    }

    if (!ensureGameRunning(game.unwrap())) {
        return Result.err("No game in play");
    }

    const player = await MonopolyPlayer.findOne({
        where: {
            userId: userId,
            channelId: channel.id,
            gameId: game.unwrap().gameId,
        },
    });

    if (!player) {
        return Result.err("Not playing in current game");
    }

    return Result.ok({
        player,
        game: game.unwrap(),
        channel,
    });
}

export function ensureGameRunning(game: MonopolyGame): boolean {
    return game.started && !game.ended;
}

export async function findChannelCurrentGame(
    channelId: string
): Promise<Option<MonopolyGame>> {
    const game = await MonopolyGame.findOne({
        where: { channelId },
        order: [["gameId", "DESC"]],
    });

    return Option.fromNullable(game);
}

export function meetsPlayerConditions(_userId: string): Promise<boolean> {
    return Promise.resolve(true);
}

export function isBank(_userId: string): Promise<boolean> {
    return Promise.resolve(true);
}

export function choose<T>(choices: T[]): T {
    const index = Math.floor(Math.random() * choices.length);
    return choices[index];
}

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

export function draw<T>(deck: number[], cards: T[]): T {
    const idx = deck.pop();

    if (typeof idx !== "undefined") {
        return cards[idx];
    } else {
        throw new Error("Drawing from empty deck");
    }
}

export function shuffle<T>(cards: T[]): number[] {
    return shuffleArray([...cards.keys()]);
}

export function advanceTo(player: MonopolyPlayer, square: number) {
    let advanceBy = square - player.currentSquare;

    if (advanceBy < 0) {
        advanceBy += 40;
    }
}
