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
import * as dotenv from "dotenv";
dotenv.config({ path: "prod.local.env" });

import { Client, Message, MessageEmbed } from "discord.js";
import { Sequelize, Transaction } from "sequelize";
import { init as monopolyInit } from "./commands/monopoly";
import { Option } from "./option";
import { Result } from "./result";

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

export async function transaction<T, E>(
    fn: (t: Transaction) => PromiseLike<T>
): Promise<Result<T, E>> {
    try {
        const result = await SEQUALIZE.transaction(fn);
        return Result.ok(result);
    } catch (e) {
        return Result.err(e);
    }
}

const client = new Client();

const monopoly = monopolyInit(SEQUALIZE, client);

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag || "N/A"}!`);
});

function handler<A>(handler: (x: A) => Promise<void>): (_: A) => void {
    return (x) => handler(x).catch(console.error);
}

const PREFIX = "!";

type Command = (msg: Message, args: string[]) => Promise<void>;

const COMMANDS: Record<string, Command | undefined> = {
    monopoly,
    m: monopoly,
};

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
    "message",
    handler(async (msg) => {
        if (!msg.author.bot && msg.content.startsWith(PREFIX)) {
            const args = msg.content.trim().slice(1).split(/ +/);
            const command = COMMANDS[args[0]];

            if (command) {
                await command(msg, args.slice(1));
            }
        }
    })
);

client.login(process.env.DISCORD_BOT_TOKEN).catch((e) => {
    console.error(e);
    process.exit(1);
});

export function embed() {
    return new MessageEmbed().setColor("#0099ff").setTimestamp();
}
