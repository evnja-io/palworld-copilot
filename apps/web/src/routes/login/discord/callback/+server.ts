import { error, redirect } from "@sveltejs/kit";
import { eq, sql } from "drizzle-orm";
import { discordClient } from "$lib/server/auth/discord";
import { createSession } from "$lib/server/auth/session";
import { generateSessionToken, sessionExpiresAt } from "$lib/server/auth/session-utils";
import { getDb, tables } from "$lib/server/db";
import type { RequestEvent } from "./$types";

export async function GET(event: RequestEvent) {
  const code = event.url.searchParams.get("code");
  const state = event.url.searchParams.get("state");
  const stored = event.cookies.get("discord_oauth_state");
  if (!code || !state || !stored || state !== stored) error(400, "État OAuth invalide");
  event.cookies.delete("discord_oauth_state", { path: "/" });

  const tokens = await discordClient(event.url.origin).validateAuthorizationCode(code, null);
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
  });
  if (!res.ok) error(502, "Discord /users/@me a échoué");
  const du: { id: string; username: string; global_name: string | null; avatar: string | null } =
    await res.json();

  const db = getDb();
  const allowed = await db
    .select()
    .from(tables.allowlist)
    .where(eq(tables.allowlist.discordId, du.id));
  if (allowed.length === 0) redirect(302, "/login/denied");

  const username = du.global_name ?? du.username;
  const avatarUrl = du.avatar
    ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.png`
    : null;
  const [user] = await db
    .insert(tables.users)
    .values({ discordId: du.id, username, avatarUrl })
    .onConflictDoUpdate({ target: tables.users.discordId, set: { username, avatarUrl } })
    .returning();

  // Shim phase 1 : les allowlistés qui se connectent pour la première fois
  // rejoignent automatiquement le serveur legacy. Retiré en phase 2
  // (remplacé par les invitations).
  await db.execute(
    sql`insert into server_members (server_id, user_id, role)
        select id, ${user.id}::uuid, 'member' from servers where slug = 'legacy'
        on conflict (server_id, user_id) do nothing`,
  );

  const token = generateSessionToken();
  await createSession(token, user.id);
  event.cookies.set("session", token, {
    path: "/",
    httpOnly: true,
    secure: event.url.protocol === "https:",
    sameSite: "lax",
    expires: sessionExpiresAt(),
  });
  redirect(302, "/");
}
