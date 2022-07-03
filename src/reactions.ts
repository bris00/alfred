import {
    MessageReaction,
    Message,
    User,
    PartialUser,
    PartialMessageReaction,
} from "discord.js";

import { AlfredReaction } from "./database/alfred";

export async function call(
    r: AlfredReaction,
    user: User | PartialUser,
    mr: MessageReaction | PartialMessageReaction
) {
    const action = REACTIONS[r.reaction.reaction].action(user, mr);
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
    emoji: string;
    action: (
        _0: User | PartialUser,
        _1: MessageReaction | PartialMessageReaction
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

export function reactionEmojis(): Set<string> {
    return new Set(Object.values(REACTIONS).map((r) => r.emoji));
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

    async addToMessage(msg: Message) {
        await Promise.all(
            this.reactions.map((reaction) => addReaction(msg, reaction))
        );
    }
}

export async function addReaction<Args extends unknown[]>(
    msg: Message,
    reaction: ReactionInstance<Args>
) {
    const template = REACTIONS[reaction.reaction];
    const { emoji } = await msg.react(template.emoji);

    await AlfredReaction.create({
        messageId: msg.id,
        emoji: emoji.name,
        reaction,
    });
}
