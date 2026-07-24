import { redirect } from "@sveltejs/kit";
import { generateState } from "arctic";
import { discordClient } from "$lib/server/auth/discord";
import { safeInternalPath } from "$lib/server/redirect";
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
  // Cible de retour post-login (funnel d'invitation) - validée (anti open-redirect).
  const back = safeInternalPath(event.url.searchParams.get("redirectTo"));
  if (back) {
    event.cookies.set("post_login_redirect", back, {
      path: "/",
      httpOnly: true,
      secure: event.url.protocol === "https:",
      maxAge: 600,
      sameSite: "lax",
    });
  } else {
    event.cookies.delete("post_login_redirect", { path: "/" });
  }
  redirect(302, url.toString());
}
