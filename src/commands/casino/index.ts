import { embed } from "@/alfred";
import { Sentence } from "@/database/casino";

import { Client, Message } from "discord.js";
import { Model, ModelAttributes, ModelStatic, Sequelize } from "sequelize";

type CommandOptions = {
    help: string;
    models: (ModelStatic<Model> & {
        FIELDS: ModelAttributes<Model>;
        MODEL_NAME: string;
    })[];
    commands: Record<string, (msg: Message, args: string[]) => Promise<void>>;
};

export function defineCommand({ help, models, commands }: CommandOptions) {
    return async (sequelize: Sequelize, _client: Client) => {
        for (const model of models) {
            model.init(model.FIELDS, {
                sequelize,
                modelName: model.MODEL_NAME,
            });
        }

        await Promise.all(models.map((model) => model.sync()));

        commands.help = async (msg) => {
            await msg.channel.send({
                embeds: [embed().setDescription(help)],
            });
        };

        return async (msg: Message, args: string[]) => {
            const command = commands[args[0]];

            if (command) {
                await command(msg, args.slice(1));
            } else {
                await msg.channel.send(
                    `No command "${args[0]}"\n\`!casino help\` to list all commands`
                );
            }
        };
    };
}

export const init = defineCommand({
    models: [Sentence],
    commands: {
        async roll(msg, args) {
            await Promise.resolve();
            console.log({ msg, args });
        },
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
