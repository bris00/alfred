import {
    SlashCommandStringOption,
    SlashCommandUserOption,
} from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { Model, ModelAttributes, ModelStatic, Sequelize } from "sequelize";
import { embed } from "./alfred";

type CommandOptions = {
    help: string;
    name: string;
    description: string;
    models: (ModelStatic<Model> & {
        FIELDS: ModelAttributes<Model>;
        MODEL_NAME: string;
    })[];
    commands: Record<string, SubCommand | CommandGroup>;
};

export function defineCommand({
    help,
    description,
    models,
    commands,
    name,
}: CommandOptions) {
    return async (sequelize: Sequelize) => {
        for (const model of models) {
            model.init(model.FIELDS, {
                sequelize,
                modelName: model.MODEL_NAME,
            });
        }

        await Promise.all(models.map((model) => model.sync()));

        commands.help = command({
            description: `Show help text for the ${name} command`,
            async handler(interaction) {
                await interaction.reply({
                    embeds: [embed().setDescription(help)],
                });
            },
        });

        const apiV4Commands = {
            name,
            description,
            options: Object.entries(commands).map(([commandName, command]) =>
                command.kind === "group"
                    ? toOptions[command.kind](commandName, command)
                    : toOptions[command.kind](commandName, command)
            ),
        };

        return {
            name,
            commands: apiV4Commands,
            async handler(this: void, interaction: CommandInteraction) {
                await Promise.resolve();
                const groupName = interaction.options.getSubcommandGroup(false);
                const commandName = interaction.options.getSubcommand();

                let command: null | SubCommand = null;

                if (groupName) {
                    const group = commands[groupName];

                    if (group && group.kind === "group") {
                        command = group.commands[commandName];
                    }
                } else {
                    const cmd = commands[commandName];

                    if (cmd && cmd.kind === "subcommand") {
                        command = cmd;
                    }
                }

                if (command) {
                    await command.handler(interaction);
                } else {
                    await interaction.reply({
                        content:
                            "You've caught me with my pants down! This is embarrassing, but I could not find that command.",
                        ephemeral: true,
                    });
                }
            },
        };
    };
}

const toOptions = {
    group(name: string, grp: CommandGroup) {
        return {
            name,
            type: 2,
            description: grp.description,
            options: Object.entries(grp.commands).map(
                ([commandName, command]) =>
                    toOptions.subcommand(commandName, command)
            ),
        };
    },
    subcommand(name: string, cmd: SubCommand) {
        return {
            name,
            type: 1,
            description: cmd.description,
            options: cmd.options?.map((opt) => opt.toJSON()),
        };
    },
};

type CommandGroup = {
    kind: "group";
    description: string;
    commands: Record<string, SubCommand>;
};

export function group(group: {
    commands: Record<string, SubCommand>;
    description: string;
}): CommandGroup {
    return {
        kind: "group",
        description: group.description,
        commands: group.commands,
    };
}

type SubCommand = {
    kind: "subcommand";
    description: string;
    options?: (SlashCommandStringOption | SlashCommandUserOption)[];
    handler: (interaction: CommandInteraction) => Promise<void>;
};

export function command(command: {
    handler: (interaction: CommandInteraction) => Promise<void>;
    description: string;
    options?: (SlashCommandStringOption | SlashCommandUserOption)[];
}): SubCommand {
    return {
        kind: "subcommand",
        description: command.description,
        options: command.options,
        handler: command.handler,
    };
}
