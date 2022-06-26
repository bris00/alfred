import { EmbedFieldData } from "discord.js";
import { Context } from "..";

export interface Landable {
    land(context: Context): Promise<EmbedFieldData[]>;
}
