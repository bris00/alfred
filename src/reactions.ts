import { randomBytes } from "crypto";
import {
    MessageActionRow,
    MessageActionRowComponentResolvable,
    MessageComponentInteraction,
} from "discord.js";

import { AlfredReaction } from "./database/alfred";

export async function call(
    r: AlfredReaction,
    interaction: MessageComponentInteraction
) {
    const action = REACTIONS[r.reaction.reaction].action(interaction);
    const { remove } = await action(...r.reaction.args);

    if (remove) {
        await r.destroy();
    }
}

type ReactionKey<Args extends unknown[]> = string & {
    readonly __brand__: unique symbol;
    readonly __nonexistent__: Reaction<Args>;
};

type Reaction<Args extends unknown[]> = {
    component: (uuid: string) => MessageActionRowComponentResolvable;
    action: (
        interaction: MessageComponentInteraction
    ) => (...args: Args) => Promise<{ remove: boolean }>;
};

export type ReactionInstance<Args extends unknown[] = unknown[]> = {
    args: Args;
    reaction: ReactionKey<Args>;
};

const REACTIONS: Record<string, Reaction<unknown[]>> = {};

export function createReaction<Args extends unknown[]>(
    opts: Reaction<Args> & { uuid: string }
): ReactionKey<Args> {
    if (Object.keys(REACTIONS).includes(opts.uuid)) {
        throw new Error("duplicate uuid used for reactions");
    }

    REACTIONS[opts.uuid] = opts as unknown as Reaction<unknown[]>;

    return opts.uuid as ReactionKey<Args>;
}

type A = unknown[];

export class ReactionInstanceList {
    private reactions: ReactionInstance[];

    private constructor() {
        this.reactions = [];
    }

    static create<A0 extends A, A1 extends A, A2 extends A, A3 extends A>(
        rs:
            | []
            | [ReactionInstance<A0>]
            | [ReactionInstance<A0>, ReactionInstance<A1>]
            | [ReactionInstance<A0>, ReactionInstance<A1>, ReactionInstance<A2>]
            | [
                  ReactionInstance<A0>,
                  ReactionInstance<A1>,
                  ReactionInstance<A2>,
                  ReactionInstance<A3>
              ]
    ) {
        const reactions = new ReactionInstanceList();

        rs.map((r) => reactions.add(r as unknown as ReactionInstance<A>));

        return reactions;
    }

    add<Args extends unknown[]>(reaction: ReactionInstance<Args>) {
        this.reactions.push(reaction as unknown as ReactionInstance<unknown[]>);
    }

    extend(reactions: ReactionInstanceList) {
        this.reactions.push(...reactions.reactions);
    }

    async createComponents(): Promise<{
        components: MessageActionRow[];
    }> {
        const components = await Promise.all(
            this.reactions.map(async (reaction) => {
                const template = REACTIONS[reaction.reaction];
                const uuid = randomBytes(16).toString("hex");

                await AlfredReaction.create({
                    uuid,
                    reaction,
                });

                return template.component(uuid);
            })
        );

        return {
            components:
                components.length > 0
                    ? [new MessageActionRow().addComponents(components)]
                    : [],
        };
    }
}
