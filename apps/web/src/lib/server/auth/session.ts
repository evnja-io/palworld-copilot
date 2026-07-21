import { eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import {
  hashSessionToken,
  sessionExpiresAt,
  shouldExtendSession,
} from "./session-utils";

export async function createSession(token: string, userId: string) {
  const db = getDb();
  const session = { id: hashSessionToken(token), userId, expiresAt: sessionExpiresAt() };
  await db.insert(tables.sessions).values(session);
  return session;
}

export async function validateSessionToken(token: string) {
  const db = getDb();
  const id = hashSessionToken(token);
  const rows = await db
    .select({ session: tables.sessions, user: tables.users })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .where(eq(tables.sessions.id, id));
  const hit = rows[0];
  if (!hit) return null;
  if (hit.session.expiresAt.getTime() <= Date.now()) {
    await db.delete(tables.sessions).where(eq(tables.sessions.id, id));
    return null;
  }
  if (shouldExtendSession(hit.session.expiresAt)) {
    hit.session.expiresAt = sessionExpiresAt();
    await db
      .update(tables.sessions)
      .set({ expiresAt: hit.session.expiresAt })
      .where(eq(tables.sessions.id, id));
  }
  return hit;
}

export async function invalidateSession(sessionId: string) {
  await getDb().delete(tables.sessions).where(eq(tables.sessions.id, sessionId));
}
