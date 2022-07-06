/*
 * TODO:
 * - Remind me
 * - Watch for changes
 * - Risk
 * - Card add tally
 * - Give card
 * - Tease bot
 * - Has posted verification daily
 * - Porn game, users must post port (image or 60sec max gif) for vote, best/worst gets reward/punishment
 *     - Easter egg hunt
 */

import { Client, CommandInteraction, Intents, MessageEmbed } from "discord.js";
import { Sequelize, Transaction } from "sequelize";
import { Routes } from "discord-api-types/v9";
import { REST } from "@discordjs/rest";
import { init as monopolyInit } from "./commands/monopoly";
import { init as casinoInit } from "./commands/casino";
import { Option } from "./option";
import { Result } from "./result";
import { call } from "./reactions";
import { AlfredReaction } from "./database/alfred";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

export function downcastTo<R>(cls: Constructor<R>): <T>(x: T) => Option<R> {
    return (x) => {
        if (x instanceof cls) {
            return Option.some(x);
        } else {
            return Option.none();
        }
    };
}

const SEQUALIZE = new Sequelize(
    Result.fromUndef(process.env.DATABASE_CONNECTION_URI).unwrap()
);

export async function transaction<T>(
    fn: (t: Transaction) => PromiseLike<T>
): Promise<Result<T, object>> {
    try {
        const result = await SEQUALIZE.transaction(fn);
        return Result.ok(result);
    } catch (e) {
        if (typeof e === "object" && e !== null) {
            return Result.err(e);
        } else {
            return Result.err({ error: e });
        }
    }
}

const rest = new REST({ version: "9" }).setToken(
    Result.fromUndef(process.env.DISCORD_BOT_TOKEN).unwrap()
);

const client = new Client({
    intents: [
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.GUILD_INTEGRATIONS,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_PRESENCES,
    ],
    partials: ["CHANNEL", "MESSAGE"],
});

(async () => {
    const commands = [];
    const handlers: Record<
        string,
        (this: void, _: CommandInteraction) => Promise<void>
    > = {};

    AlfredReaction.init(AlfredReaction.FIELDS, {
        sequelize: SEQUALIZE,
        modelName: "reaction",
    });

    await AlfredReaction.sync();

    if (process.env.ENABLE_MONOPOLY === "true") {
        const monopoly = await monopolyInit(SEQUALIZE);

        commands.push(monopoly.commands);
        handlers[monopoly.name] = monopoly.handler;
    }

    if (process.env.ENABLE_CASINO === "true") {
        const casino = await casinoInit(SEQUALIZE);

        commands.push(casino.commands);
        handlers[casino.name] = casino.handler;
    }

    await rest.put(
        Routes.applicationCommands(
            Result.fromUndef(process.env.DISCORD_APP_ID).unwrap()
        ),
        { body: commands }
    );

    console.log("Successfully registered application commands.");

    client.on("interactionCreate", async (interaction) => {
        if (interaction.isMessageComponent()) {
            const action = await AlfredReaction.findOne({
                where: {
                    uuid: interaction.customId,
                },
            });

            if (action) {
                await call(action, interaction);
            }

            return;
        }

        if (interaction.isCommand()) {
            await handlers[interaction.commandName](interaction);

            return;
        }
    });
})().catch((e) => {
    console.error(e);
    process.exit(1);
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag || "N/A"}!`);
});

export const EMPTY_VALUE = "\u200B";

export const EMPTY_FIELD = {
    name: EMPTY_VALUE,
    value: EMPTY_VALUE,
    inline: false,
};

export const EMPTY_INLINE_FIELD = {
    name: EMPTY_VALUE,
    value: EMPTY_VALUE,
    inline: true,
};

client.login(process.env.DISCORD_BOT_TOKEN).catch((e) => {
    console.error(e);
    process.exit(1);
});

export function embed(): MessageEmbed {
    return new MessageEmbed().setColor(0x0099ff).setTimestamp();
}
