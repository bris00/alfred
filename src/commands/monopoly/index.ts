import {
    DMChannel,
    Message,
    NewsChannel,
    PartialDMChannel,
    TextChannel,
    ThreadChannel,
    VoiceChannel,
} from "discord.js";
import { Sequelize } from "sequelize";

import {
    MonopolyPlayer,
    MonopolyGame,
    MonopolyInventory,
    MonopolyDeed,
    MonopolyRailroad,
} from "@/database/monopoly";
import { Option } from "@/option";
import { embed } from "@/alfred";
import { roll } from "./actions/roll";
import {
    findChannelCurrentGame,
    getContext,
    isBank,
    meetsPlayerConditions,
} from "./actions/common";
import { trade } from "./actions/trade";
import { search } from "./actions/search";

type MCommand = (msg: Message, args: string[]) => Promise<void>;

export type Context = {
    player: MonopolyPlayer;
    game: MonopolyGame;
    channel:
        | TextChannel
        | NewsChannel
        | DMChannel
        | PartialDMChannel
        | ThreadChannel
        | VoiceChannel;
};

export const MAX_SQUARES = 40;
export const JAIL = 10;
export const DICE = [1, 2, 3, 4, 5, 6];

const STARTING_BALANCE = 1500;

export async function init(sequelize: Sequelize) {
    MonopolyPlayer.init(MonopolyPlayer.FIELDS, {
        sequelize,
        modelName: "monopoly_player",
    });

    MonopolyGame.init(MonopolyGame.FIELDS, {
        sequelize,
        modelName: "monopoly_game",
    });

    MonopolyInventory.init(MonopolyInventory.FIELDS, {
        sequelize,
        modelName: "monopoly_inventory",
    });

    MonopolyDeed.init(MonopolyDeed.FIELDS, {
        sequelize,
        modelName: "monopoly_deed",
    });

    MonopolyRailroad.init(MonopolyRailroad.FIELDS, {
        sequelize,
        modelName: "monopoly_railroad",
    });

    await Promise.all([
        MonopolyGame.sync(),
        MonopolyPlayer.sync(),
        MonopolyInventory.sync(),
        MonopolyDeed.sync(),
        MonopolyRailroad.sync(),
    ]);

    const COMMANDS: Record<string, MCommand | undefined> = {
        async help(msg) {
            await msg.channel.send({
                embeds: [
                    embed().setDescription(
                        "\
A game of monopoly. You may roll once every 12 hours.\n\
\n\
```\n\
!monopoly roll           Roll the dice!\n\
!monopoly pay <kind>     Buy a property or pay your jail fine\n\
!monopoly show <player>  See the players progress\n\
!monopoly jail <player>  Jail a player\n\
!monopoly game           Display information about the current game\n\
!monopoly games          List last games\n\
!monopoly new            Create new game\n\
!monopoly register       Register to play in the current game\n\
!monopoly start          Start new game\n\
!monopoly end            End current game\n\
!monopoly help           Show this help message\n\
```"
                    ),
                ],
            });
        },
        async game(msg) {
            const game = await findChannelCurrentGame(msg.channel.id);

            if (game.isNone()) {
                await msg.channel.send("No game in channel");
                return;
            }

            //TODO

            await msg.channel.send("No game in channel");
        },
        async games(msg) {
            await msg.channel.send("Not implemented yet!");
        },
        async show(msg, terms) {
            const ctx = await getContext(msg.author.id, msg.channel);

            if (ctx.isErr()) {
                await msg.channel.send(ctx.unwrapErr());
            }

            const displayable = await search(ctx.unwrap(), terms.join(" "));

            if (displayable.isNone()) {
                await msg.channel.send(`Could not find "${terms.join(" ")}"`);
                return;
            }

            const { embed, reactions } = await displayable
                .unwrap()
                .display(ctx.unwrap());

            const ans = await msg.channel.send({ embeds: [embed] });

            await reactions.addToMessage(ans);
        },
        async new(msg) {
            if (!(await isBank(msg.author.id))) {
                await msg.channel.send(
                    "You do not have permission to create new games"
                );
                return;
            }

            const game = await findChannelCurrentGame(msg.channel.id);

            if (!game.isNone() && !game.unwrap().ended) {
                await msg.channel.send(
                    "There is an ongoing game in this channel"
                );
                return;
            }

            const nextGameId = game.map((game) => game.gameId + 1).unwrapOr(0);

            await MonopolyGame.create({
                channelId: msg.channel.id,
                gameId: nextGameId,
                active: true,
            });

            await msg.channel.send("Done");
        },
        async start(msg) {
            if (!(await isBank(msg.author.id))) {
                await msg.channel.send(
                    "You do not have permission to create new games"
                );
                return;
            }

            const game = await findChannelCurrentGame(msg.channel.id);

            if (game.isNone()) {
                await msg.channel.send("No game in channel");
                return;
            }

            if (!game.isNone() && game.unwrap().ended) {
                await msg.channel.send("Cannot find new game");
                return;
            }

            if (!game.isNone() && game.unwrap().started) {
                await msg.channel.send("Game already started");
                return;
            }

            await Option.promise(
                game.map((game) => {
                    game.started = true;
                    return game.save();
                })
            );

            await msg.channel.send("Done");
        },
        async end(msg) {
            if (!(await isBank(msg.author.id))) {
                await msg.channel.send(
                    "You do not have permission to end games"
                );
                return;
            }

            const game = await findChannelCurrentGame(msg.channel.id);

            if (game.isNone()) {
                await msg.channel.send("No game in channel");
                return;
            }

            if (
                !game.isNone() &&
                (game.unwrap().ended || !game.unwrap().started)
            ) {
                await msg.channel.send("No active game");
                return;
            }

            await Option.promise(
                game.map((game) => {
                    game.ended = true;
                    return game.save();
                })
            );

            await msg.channel.send("Done");
        },
        async register(msg) {
            if (!(await meetsPlayerConditions(msg.author.id))) {
                await msg.channel.send("Not eligible to play");
                return;
            }

            const game = await findChannelCurrentGame(msg.channel.id);

            if (game.isNone()) {
                await msg.channel.send("No game in channel");
                return;
            }

            if (game.unwrap().started) {
                await msg.channel.send("Has already started");
                return;
            }

            if (game.unwrap().ended) {
                await msg.channel.send("Game over");
                return;
            }

            const [player, built] = await MonopolyPlayer.findOrBuild({
                where: {
                    userId: msg.author.id,
                    channelId: msg.channel.id,
                    gameId: game.unwrap().gameId,
                },
            });

            if (!built) {
                await msg.channel.send("Already registered to play");
                return;
            }

            player.balance = STARTING_BALANCE;
            await player.save();
            await msg.channel.send("Done");
        },
        async trade(msg, args) {
            const partner = args.shift();

            if (!partner) {
                await msg.channel.send("You need to specify who to trade with");
                return;
            }

            const result = await trade(
                msg.author,
                msg.channel,
                partner,
                args.join(" ")
            );

            if (result.isErr()) {
                await msg.channel.send(result.unwrapErr());
            }
        },
        async roll(msg) {
            const result = await roll(msg.author, msg.channel);

            if (result.isErr()) {
                await msg.channel.send(result.unwrapErr());
            }
        },
    };

    return async (msg: Message, args: string[]) => {
        const command = COMMANDS[args[0]];

        if (command) {
            await command(msg, args.slice(1));
        } else {
            await msg.channel.send(
                `No command "${args[0]}"\n\`!m help\` to list all commands`
            );
        }
    };
}
