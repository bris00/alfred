import { defineCommand, command } from "@/commands";

import {
    MonopolyPlayer,
    MonopolyGame,
    MonopolyInventory,
    MonopolyDeed,
    MonopolyRailroad,
} from "@/database/monopoly";
import { Option } from "@/option";
import { roll } from "./actions/roll";
import {
    findChannelCurrentGame,
    getContext,
    isBank,
    meetsPlayerConditions,
} from "./actions/common";
import { trade } from "./actions/trade";
import { search } from "./actions/search";
import { Guild } from "discord.js";
import {
    SlashCommandStringOption,
    SlashCommandUserOption,
} from "@discordjs/builders";

export type Context = {
    player: MonopolyPlayer;
    game: MonopolyGame;
    guild: Guild;
};

export const MAX_SQUARES = 40;
export const JAIL = 10;
export const DICE = [1, 2, 3, 4, 5, 6];

const STARTING_BALANCE = 1500;

export const init = defineCommand({
    models: [
        MonopolyPlayer,
        MonopolyGame,
        MonopolyInventory,
        MonopolyDeed,
        MonopolyRailroad,
    ],
    name: "monopoly",
    description: "Play a game of monopoly!",
    commands: {
        roll: command({
            description: "Roll the monopoly dice",
            async handler(interaction) {
                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (game.isNone()) {
                    await interaction.reply("No active game in channel");
                    return;
                }

                const result = await roll(
                    interaction,
                    game().channelId,
                    game().gameId
                );

                if (result.isErr()) {
                    await interaction.reply(result.unwrapErr());
                }
            },
        }),
        game: command({
            description: "Display information about the current game",
            async handler(interaction) {
                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (game.isNone()) {
                    await interaction.reply("No game in channel");
                    return;
                }

                //TODO

                await interaction.reply("TODO");
            },
        }),
        show: command({
            description: "Show information about player status or square",
            options: [
                new SlashCommandStringOption()
                    .setDescription("The term to search for")
                    .setRequired(true)
                    .setName("term"),
            ],
            async handler(interaction) {
                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (game.isNone()) {
                    await interaction.reply("No active game in channel");
                    return;
                }

                const ctx = await getContext(
                    interaction,
                    game().channelId,
                    game().gameId
                );

                if (ctx.isErr()) {
                    await interaction.reply(ctx.unwrapErr());
                }

                const terms = interaction.options.getString("term", true);

                const displayable = await search(ctx.unwrap(), terms);

                if (displayable.isNone()) {
                    await interaction.reply(`Could not find "${terms}"`);
                    return;
                }

                const { embed, reactions } = await displayable
                    .unwrap()
                    .display(ctx.unwrap());

                const { components } = await reactions.createComponents();

                await interaction.reply({
                    embeds: [embed],
                    components,
                });
            },
        }),
        new: command({
            description: "Create a game",
            async handler(interaction) {
                if (!(await isBank(interaction.user.id))) {
                    await interaction.reply(
                        "You do not have permission to create new games"
                    );
                    return;
                }

                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (!game.isNone() && !game().ended) {
                    await interaction.reply(
                        "There is an ongoing game in this channel"
                    );
                    return;
                }

                const nextGameId = game
                    .map((game) => game.gameId + 1)
                    .unwrapOr(0);

                await MonopolyGame.create({
                    channelId: interaction.channelId,
                    gameId: nextGameId,
                    active: true,
                });

                await interaction.reply("Done");
            },
        }),
        start: command({
            description: "Start the new game",
            async handler(interaction) {
                if (!(await isBank(interaction.user.id))) {
                    await interaction.reply(
                        "You do not have permission to create new games"
                    );
                    return;
                }

                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (game.isNone()) {
                    await interaction.reply("No game in channel");
                    return;
                }

                if (!game.isNone() && game().ended) {
                    await interaction.reply("Cannot find new game");
                    return;
                }

                if (!game.isNone() && game().started) {
                    await interaction.reply("Game already started");
                    return;
                }

                await Option.promise(
                    game.map((game) => {
                        game.started = true;
                        return game.save();
                    })
                );

                await interaction.reply("Done");
            },
        }),
        end: command({
            description: "End the current game",
            async handler(interaction) {
                if (!(await isBank(interaction.user.id))) {
                    await interaction.reply(
                        "You do not have permission to end games"
                    );
                    return;
                }

                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (game.isNone()) {
                    await interaction.reply("No game in channel");
                    return;
                }

                if (!game.isNone() && (game().ended || !game().started)) {
                    await interaction.reply("No active game");
                    return;
                }

                await Option.promise(
                    game.map((game) => {
                        game.ended = true;
                        return game.save();
                    })
                );

                await interaction.reply("Done");
            },
        }),
        register: command({
            description: "Register to play in the current game",
            async handler(interaction) {
                if (!(await meetsPlayerConditions(interaction.user.id))) {
                    await interaction.reply("Not eligible to play");
                    return;
                }

                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (game.isNone()) {
                    await interaction.reply("No game in channel");
                    return;
                }

                if (game().started) {
                    await interaction.reply("Has already started");
                    return;
                }

                if (game().ended) {
                    await interaction.reply("Game over");
                    return;
                }

                const [player, built] = await MonopolyPlayer.findOrBuild({
                    where: {
                        userId: interaction.user.id,
                        channelId: interaction.channelId,
                        gameId: game().gameId,
                    },
                });

                if (!built) {
                    await interaction.reply("Already registered to play");
                    return;
                }

                player.balance = STARTING_BALANCE;
                await player.save();
                await interaction.reply("Done");
            },
        }),
        trade: command({
            description: "Trade stuff",
            options: [
                new SlashCommandUserOption()
                    .setDescription("The trading partner")
                    .setRequired(true)
                    .setName("partner"),
                new SlashCommandStringOption()
                    .setDescription("The tradable(s) in question")
                    .setRequired(true)
                    .setName("tradable"),
            ],
            async handler(interaction) {
                const partner = interaction.options.getUser("partner");

                if (!partner) {
                    await interaction.reply(
                        "You need to specify who to trade with"
                    );
                    return;
                }

                const game = await findChannelCurrentGame(
                    interaction.channelId
                );

                if (game.isNone()) {
                    await interaction.reply("No game in channel");
                    return;
                }

                const result = await trade(
                    interaction,
                    game().channelId,
                    game().gameId,
                    partner,
                    interaction.options.getString("tradable", true)
                );

                if (result.isErr()) {
                    await interaction.reply(result.unwrapErr());
                }
            },
        }),
        games: command({
            description: "List last games",
            async handler(interaction) {
                //TODO
                await interaction.reply("Not implemented yet!");
            },
        }),
    },
    help: "\
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
```",
});
