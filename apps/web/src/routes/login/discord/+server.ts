import { redirect } from "@sveltejs/kit";
import { generateState } from "arctic";
import { discordClient } from "$lib/server/auth/discord";
import type { RequestEvent } from "./$types";

export function GET(event: RequestEvent) {
  const state = generateState();
  const url = discordClient(event.url.origin).createAuthorizationURL(state, null, ["identify"]);
  event.cookies.set("discord_oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: event.url.protocol === "https:",
    maxAge: 600,
    sameSite: "lax",
  });
  redirect(302, url.toString());
}
