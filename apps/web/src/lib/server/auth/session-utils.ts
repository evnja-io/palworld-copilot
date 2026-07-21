import { createHash, randomBytes } from "node:crypto";

export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export function generateSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DAYS * DAY_MS);
}

export function shouldExtendSession(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() < (SESSION_DAYS / 2) * DAY_MS;
}
