import { embed, EMPTY_INLINE_FIELD } from "@/alfred";
import { MonopolyPlayer } from "@/database/monopoly";
import { Option } from "@/option";
import { GuildMember } from "discord.js";
import { goAsync, prepare } from "fuzzysort";
import { Context } from "..";
import { Display } from "../interfaces/display";
import { dollar } from "./common";
import { SQUARES } from "./roll";
import * as Sugar from "sugar";

const TARGETS: {
    term: Fuzzysort.Prepared | string | undefined;
    displayable: Display;
}[] = Object.values(SQUARES).flatMap((square) => {
    if (!square) {
        return [];
    }

    return [
        {
            term: prepare(square.searchTerm()),
            displayable: square,
        },
    ];
});

function toInt(value: string): Option<number> {
    const num = +value;

    if (Number.isInteger(num)) {
        return Option.some(num);
    } else {
        return Option.none();
    }
}

function displayMember(member: GuildMember): Display {
    return {
        async display({ game }) {
            const player = await MonopolyPlayer.findOne({
                where: {
                    userId: member.id,
                    channelId: game.channelId,
                    gameId: game.gameId,
                },
            });

            return {
                embed: embed()
                    .setColor(member.displayHexColor)
                    .addFields(
                        {
                            name: "Name",
                            value: member.displayName,
                            inline: true,
                        },
                        {
                            name: "Balance",
                            inline: true,
                            value: dollar(player?.balance || 0),
                        },
                        {
                            name: "Jailed",
                            inline: true,
                            value: player?.jailed ? "yes" : "no",
                        },
                        {
                            name: "Position",
                            inline: true,
                            value: player?.currentSquare || 0,
                        },
                        {
                            name: "Next turn",
                            inline: true,
                            value: Sugar.Date.relative(
                                new Date(player?.nextTurn || 0)
                            ),
                        },
                        EMPTY_INLINE_FIELD
                    ),
                reactions: [],
            };
        },
    };
}

export async function search(
    ctx: Context,
    term: string
): Promise<Option<Display>> {
    const square = toInt(term);

    if (!square.isNone()) {
        const val = SQUARES[square.unwrap()];

        if (val) {
            return Option.some(val);
        }
    }

    const members = await ctx.channel.lastMessage?.guild?.members.fetch({
        query: term,
    });
    const memberTargets =
        members?.map((m) => ({
            term: m.displayName,
            displayable: displayMember(m),
        })) || [];

    const results = await goAsync(term, TARGETS.concat(memberTargets), {
        limit: 1,
        allowTypo: true,
        threshold: -Infinity,
        key: "term",
    });

    return Option.fromMaybeUndef(results[0]?.obj.displayable);
}
