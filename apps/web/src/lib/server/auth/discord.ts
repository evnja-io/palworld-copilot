import { Discord } from "arctic";
import { env } from "$env/dynamic/private";

export function discordClient(origin: string) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new Error("Variables DISCORD_CLIENT_ID/SECRET manquantes");
  }
  return new Discord(
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
    `${origin}/login/discord/callback`,
  );
}
