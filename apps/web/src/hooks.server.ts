import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { paraglideMiddleware } from "$lib/paraglide/server";
import { validateSessionToken } from "$lib/server/auth/session";

export const paraglideHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;
    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace("%paraglide.lang%", locale),
    });
  });

const authHandle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  const token = event.cookies.get("session");
  if (token) {
    const hit = await validateSessionToken(token);
    if (hit) {
      event.locals.user = hit.user;
      event.cookies.set("session", token, {
        path: "/",
        httpOnly: true,
        secure: event.url.protocol === "https:",
        sameSite: "lax",
        expires: hit.session.expiresAt,
      });
    } else {
      event.cookies.delete("session", { path: "/" });
    }
  }
  return resolve(event);
};

export const handle = sequence(paraglideHandle, authHandle);
