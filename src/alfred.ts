import * as Discord from "discord.js";

const client = new Discord.Client();

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag || "N/A"}!`);
});

function handler<A>(handler: (x: A) => Promise<void>): (_: A) => void {
    return (x) => handler(x).catch(console.error);
}

client.on(
    "message",
    handler(async (msg) => {
        if (msg.content === "ping") {
            await msg.channel.send("pong");
        }
    })
);

client.login("token").catch(console.error);
