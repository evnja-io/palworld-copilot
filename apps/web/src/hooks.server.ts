import type { Handle, HandleServerError } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { paraglideMiddleware } from "$lib/paraglide/server";
import { validateSessionToken } from "$lib/server/auth/session";
import { getPostHogClient } from "$lib/server/posthog";

const ingestHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  if (pathname.startsWith("/ingest")) {
    const useAssetHost =
      pathname.startsWith("/ingest/static/") || pathname.startsWith("/ingest/array/");
    const hostname = useAssetHost ? "eu-assets.i.posthog.com" : "eu.i.posthog.com";
    const url = new URL(event.request.url);
    url.protocol = "https:";
    url.hostname = hostname;
    url.port = "443";
    url.pathname = pathname.replace(/^\/ingest/, "");
    const headers = new Headers(event.request.headers);
    headers.set("host", hostname);
    headers.set("accept-encoding", "");
    const clientIp =
      event.request.headers.get("x-forwarded-for") || event.getClientAddress();
    if (clientIp) headers.set("x-forwarded-for", clientIp);
    return fetch(url.toString(), {
      method: event.request.method,
      headers,
      body: event.request.body,
      // @ts-expect-error duplex requis pour le streaming
      duplex: "half",
    });
  }
  return resolve(event);
};

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

export const handleError: HandleServerError = async ({ error, status, message }) => {
  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: "server",
      event: "server_error",
      properties: {
        error: error instanceof Error ? error.message : String(error),
        status,
        message,
      },
    });
    await posthog.flush();
  } catch {
    // PostHog non configuré — ignorer
  }
  return { message, status };
};

export const handle = sequence(ingestHandle, paraglideHandle, authHandle);
