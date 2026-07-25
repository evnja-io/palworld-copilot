import { describe, expect, it } from "vitest";
import { reroute } from "./hooks";
import { GUEST_SLUG } from "$lib/guest";

/** Le hook ne lit que `url`. On lui passe une URL absolue, comme Kit le fait. */
function resolve(pathname: string): string {
  const result = reroute({
    url: new URL(`https://palwork.evnja.gg${pathname}`),
    fetch: globalThis.fetch,
  });
  // Notre implémentation est synchrone (et doit le rester : Kit met en cache).
  if (typeof result !== "string") throw new Error("le reroute doit renvoyer une string");
  return result;
}

describe("reroute composé (locale puis mode invité)", () => {
  it("mappe une fonctionnalité publique en FR (locale de base, sans préfixe)", () => {
    expect(resolve("/paldex")).toBe(`/s/${GUEST_SLUG}/paldex`);
    expect(resolve("/paldex/Lamball")).toBe(`/s/${GUEST_SLUG}/paldex/Lamball`);
  });

  it("dé-localise puis mappe une fonctionnalité publique en EN", () => {
    expect(resolve("/en/paldex")).toBe(`/s/${GUEST_SLUG}/paldex`);
    expect(resolve("/en/paldex/Lamball")).toBe(`/s/${GUEST_SLUG}/paldex/Lamball`);
    expect(resolve("/en/items/Wood")).toBe(`/s/${GUEST_SLUG}/items/Wood`);
  });

  it("dé-localise les pages publiques hors périmètre invité", () => {
    // Le piège : renvoyer undefined ici casserait /en/docs.
    expect(resolve("/en/docs")).toBe("/docs");
    expect(resolve("/en/")).toBe("/");
    expect(resolve("/docs")).toBe("/docs");
    expect(resolve("/")).toBe("/");
  });

  it("laisse les URLs tenant intactes", () => {
    expect(resolve("/s/abc123XYZ0/paldex")).toBe("/s/abc123XYZ0/paldex");
    expect(resolve("/s/abc123XYZ0/settings")).toBe("/s/abc123XYZ0/settings");
  });

  it("laisse les routes techniques intactes", () => {
    expect(resolve("/api/servers/abc/progress")).toBe("/api/servers/abc/progress");
    expect(resolve("/sitemap.xml")).toBe("/sitemap.xml");
    expect(resolve("/robots.txt")).toBe("/robots.txt");
    expect(resolve("/login/discord/callback")).toBe("/login/discord/callback");
  });

  it("est idempotent sur un chemin déjà résolu", () => {
    const once = resolve("/paldex");
    expect(resolve(once)).toBe(once);
  });
});
