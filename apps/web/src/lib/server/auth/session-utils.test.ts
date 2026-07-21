import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiresAt,
  shouldExtendSession,
  SESSION_DAYS,
} from "./session-utils";

describe("session-utils", () => {
  it("génère des tokens uniques, opaques et assez longs", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hash stable et distinct du token (le token ne va jamais en BDD)", () => {
    const t = generateSessionToken();
    expect(hashSessionToken(t)).toBe(hashSessionToken(t));
    expect(hashSessionToken(t)).not.toBe(t);
    expect(hashSessionToken(t)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("expire dans SESSION_DAYS jours", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    const exp = sessionExpiresAt(now);
    expect(exp.getTime() - now.getTime()).toBe(SESSION_DAYS * 86_400_000);
  });

  it("étend seulement après la mi-vie", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    const freshExpiry = sessionExpiresAt(now);
    expect(shouldExtendSession(freshExpiry, now)).toBe(false);
    const past = new Date(now.getTime() - (SESSION_DAYS / 2 + 1) * 86_400_000);
    expect(shouldExtendSession(sessionExpiresAt(past), now)).toBe(true);
  });
});
