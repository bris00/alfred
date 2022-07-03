/*
 * TODO:
 * - Remind me
 * - Watch for changes
 * - Risk
 * - Card add tally
 * - Give card
 * - Tease bot
 * - Has posted verification daily
 */

import { Client, Message, Intents, MessageEmbed } from "discord.js";
import { Sequelize, Transaction } from "sequelize";
import { init as monopolyInit } from "./commands/monopoly";
import { init as casinoInit } from "./commands/casino";
import { Option } from "./option";
import { Result } from "./result";
import { call, reactionEmojis } from "./reactions";
import { AlfredReaction } from "./database/alfred";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

export function downcastTo<T, R>(cls: Constructor<R>): (x: T) => Option<R> {
    return (x) => {
        if (x instanceof cls) {
            return Option.some(x);
        } else {
            return Option.none();
        }
    };
}

const SEQUALIZE = new Sequelize("database", "user", "password", {
    host: "localhost",
    dialect: "sqlite",
    logging: false,
    // SQLite only
    storage: "database.sqlite",
});

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

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag || "N/A"}!`);
});

function handler<A>(handler: (x: A) => Promise<void>): (_: A) => Promise<void> {
    return (x) => handler(x).catch(console.error);
}

const PREFIX = "!";

type Command = (msg: Message, args: string[]) => Promise<void>;

const COMMANDS: Promise<Record<string, Command | undefined>> = (async () => {
    const commands = {};

    AlfredReaction.init(AlfredReaction.FIELDS, {
        sequelize: SEQUALIZE,
        modelName: "reaction",
    });

    await AlfredReaction.sync();

    if (process.env.ENABLE_MONOPOLY === "true") {
        const monopoly = await monopolyInit(SEQUALIZE);

        Object.assign(commands, {
            monopoly: monopoly,
            m: monopoly,
        });
    }

    if (process.env.ENABLE_CASINO === "true") {
        const casino = await casinoInit(SEQUALIZE, client);

        Object.assign(commands, {
            casino,
        });
    }

    return commands;
})().catch((e) => {
    console.error(e);
    process.exit(1);
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

client.on(
    "messageCreate",
    handler(async (msg) => {
        if (!msg.author.bot && msg.content.startsWith(PREFIX)) {
            const args = msg.content.trim().slice(1).split(/ +/);
            const command = (await COMMANDS)[args[0]];

            if (command) {
                await command(msg, args.slice(1));
            }
        }
    })
);

client.on("messageReactionAdd", async (reaction, user) => {
    if (
        !user.bot &&
        reaction.emoji?.name &&
        reactionEmojis().has(reaction.emoji.name)
    ) {
        const action = await AlfredReaction.findOne({
            where: {
                messageId: reaction.message.id,
                emoji: reaction.emoji.name,
            },
        });

        if (action) {
            await call(action, user, reaction);
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch((e) => {
    console.error(e);
    process.exit(1);
});

export function embed(): MessageEmbed {
    return new MessageEmbed().setColor(0x0099ff).setTimestamp();
}
