import { ReactionInstanceList } from "@/reactions";
import { MessageEmbed } from "discord.js";
import { Context } from "..";

export type DisplayResult = {
    embed: MessageEmbed;
    reactions: ReactionInstanceList;
};

export interface Display {
    display(ctx: Omit<Context, "player">): Promise<DisplayResult>;
}
