import { redirect } from "@sveltejs/kit";
import { hashSessionToken } from "$lib/server/auth/session-utils";
import { invalidateSession } from "$lib/server/auth/session";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  const token = event.cookies.get("session");
  if (token) {
    await invalidateSession(hashSessionToken(token));
    event.cookies.delete("session", { path: "/" });
  }
  redirect(302, "/login");
}
