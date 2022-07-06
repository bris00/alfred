import { downcastTo } from "@/alfred";
import { RemoveMethods } from "@/dataclass";
import { Option } from "@/option";
import { createReaction } from "@/reactions";
import { getContext } from "./actions/common";
import { findSquare, roll } from "./actions/roll";
import { Deed } from "./squares/deeds";
import { Trade } from "./actions/trade";
import { Mortagable } from "./interfaces/mortage";
import { Purchasable } from "./interfaces/purchasable";
import { Railroad } from "./squares/railroad";
import { MessageButton } from "discord.js";
import { Square } from "./interfaces/square";

export const rollAgain = createReaction({
    uuid: "53bd155c-65e5-4784-93de-4562ae413243",
    component: (uuid) =>
        new MessageButton()
            .setCustomId(uuid)
            .setStyle("PRIMARY")
            .setLabel("Re-roll"),
    action(interaction) {
        return async (gameChannelId: string, gameId: number) => {
            const result = await roll(interaction, gameChannelId, gameId);

            if (result.isErr()) {
                console.error(result.unwrapErr());
            }

            return { remove: true };
        };
    },
});

export const acceptTrade = createReaction({
    uuid: "7d652cbc-f930-49bc-b94d-8af114651362",
    component: (uuid) =>
        new MessageButton()
            .setCustomId(uuid)
            .setStyle("PRIMARY")
            .setEmoji("✅"),
    action(interaction) {
        return async (
            trade: RemoveMethods<Trade>,
            gameChannelId: string,
            gameId: number
        ) => {
            await new Trade(trade).click(
                true,
                interaction,
                gameChannelId,
                gameId
            );

            return { remove: false };
        };
    },
});

export const cancelTrade = createReaction({
    uuid: "7264d09c-05cf-425d-bfc8-95500f4796e2",
    component: (uuid) =>
        new MessageButton().setCustomId(uuid).setStyle("DANGER").setEmoji("❌"),
    action(interaction) {
        return async (
            trade: RemoveMethods<Trade>,
            gameChannelId: string,
            gameId: number
        ) => {
            await new Trade(trade).click(
                true,
                interaction,
                gameChannelId,
                gameId
            );

            return { remove: false };
        };
    },
});

export const buyHouse = createReaction({
    uuid: "8e49843d-cf0c-4444-a89b-1a9b6083c548",
    component: (uuid) =>
        new MessageButton()
            .setCustomId(uuid)
            .setStyle("PRIMARY")
            .setLabel("Buy")
            .setEmoji("🏠"),
    action(integration) {
        return async (
            square: number,
            gameChannelId: string,
            gameId: number
        ) => {
            const context = await getContext(
                integration,
                gameChannelId,
                gameId
            );

            if (context.isErr()) {
                await integration.reply(context.unwrapErr());
            }

            const { player } = context.unwrap();

            const message = await Option.promise(
                findSquare(square)
                    .flatMap(downcastTo(Deed))
                    .map((d) => d.buyHouse(player))
            );

            await integration.reply(
                integration.user.toString() +
                    " " +
                    message.unwrapOr(`Cannot buy house on square ${square}`)
            );

            return { remove: false };
        };
    },
});

export const buyHotel = createReaction({
    uuid: "83200089-2527-4744-be8d-b3ab5835177f",
    component: (uuid) =>
        new MessageButton()
            .setCustomId(uuid)
            .setStyle("PRIMARY")
            .setLabel("Buy")
            .setEmoji("🏩"),
    action(integration) {
        return async (
            square: number,
            gameChannelId: string,
            gameId: number
        ) => {
            const context = await getContext(
                integration,
                gameChannelId,
                gameId
            );

            if (context.isErr()) {
                await integration.reply(context.unwrapErr());
            }

            const { player } = context.unwrap();

            const message = await Option.promise(
                findSquare(square)
                    .flatMap(downcastTo(Deed))
                    .map((d) => d.buyHotel(player))
            );

            await integration.reply(
                integration.user.toString() +
                    " " +
                    message.unwrapOr(`Cannot buy hotel on square ${square}`)
            );

            return { remove: true };
        };
    },
});

export const mortage = createReaction({
    uuid: "4cae48d6-a63a-4d93-9ae0-da2a42cb4bc9",
    component: (uuid) =>
        new MessageButton()
            .setCustomId(uuid)
            .setStyle("PRIMARY")
            .setLabel("Buy")
            .setEmoji("↩️"),
    action(integration) {
        return async (
            square: number,
            gameChannelId: string,
            gameId: number
        ) => {
            const context = await getContext(
                integration,
                gameChannelId,
                gameId
            );

            if (context.isErr()) {
                await integration.reply(context.unwrapErr());
            }

            const { player } = context.unwrap();

            const message = await Option.promise(
                findSquare(square)
                    .switch<Square, Mortagable>([
                        downcastTo(Railroad),
                        downcastTo(Deed),
                    ])
                    .map((m) => m.doMortage(player))
            );

            await integration.reply(
                integration.user.toString() +
                    " " +
                    message.unwrapOr(
                        `cannot mortgage property on square ${square}`
                    )
            );

            return { remove: true };
        };
    },
});

export const buy = createReaction({
    uuid: "1b91d22f-fcb5-4c00-a22e-8633a1e146e3",
    component: (uuid) =>
        new MessageButton()
            .setCustomId(uuid)
            .setStyle("PRIMARY")
            .setLabel("Buy")
            .setEmoji("💵"),
    action(integration) {
        return async (
            square: number,
            gameChannelId: string,
            gameId: number
        ) => {
            const context = await getContext(
                integration,
                gameChannelId,
                gameId
            );

            if (context.isErr()) {
                await integration.reply(context.unwrapErr());
            }

            const { player } = context.unwrap();

            const message = await Option.promise(
                findSquare(square)
                    .switch<Square, Purchasable>([
                        downcastTo(Railroad),
                        downcastTo(Deed),
                    ])
                    .map((m) => m.buy(player))
            );

            await integration.reply(
                integration.user.toString() +
                    " " +
                    message.unwrapOr(`cannot buy property on square ${square}`)
            );

            return { remove: true };
        };
    },
});
