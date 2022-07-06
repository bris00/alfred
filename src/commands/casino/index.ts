import { defineCommand, command, group } from "@/commands";
import { Sentence } from "@/database/casino";

export const init = defineCommand({
    models: [Sentence],
    name: "casino",
    description: "Let fate decide",
    commands: {
        roll: command({
            description: "Roll 'top' level",
            async handler(interaction) {
                console.log({ t: 4, interaction });
                await Promise.resolve();
            },
        }),
        grouptest: group({
            description: "grouptest group",
            commands: {
                a: command({
                    description: "A subcommand",
                    async handler(interaction) {
                        console.log({ t: 5, interaction });
                        await Promise.resolve();
                    },
                }),
                roll: command({
                    description: "Roll subcommand",
                    async handler(interaction) {
                        console.log({ t: 6, interaction });
                        await Promise.resolve();
                    },
                }),
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
