import { MessageEmbed } from "discord.js";
import { Context } from "..";
import { Reaction } from "../reactions";

export type DisplayResult = { embed: MessageEmbed; reactions: Reaction[] };

export interface Display {
    display(ctx: Omit<Context, "player">): Promise<DisplayResult>;
}
