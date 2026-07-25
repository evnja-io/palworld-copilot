import { describe, expect, it } from "vitest";
import {
  GUEST_FEATURES,
  GUEST_INDEXABLE_FEATURES,
  GUEST_SLUG,
  guestTarget,
  isGuestRouteId,
  stripGuestPrefix,
} from "./guest";

describe("guestTarget", () => {
  it("mappe une page liste et une page de détail", () => {
    expect(guestTarget("/paldex")).toBe(`/s/${GUEST_SLUG}/paldex`);
    expect(guestTarget("/paldex/Lamball")).toBe(`/s/${GUEST_SLUG}/paldex/Lamball`);
    expect(guestTarget("/items/Wood")).toBe(`/s/${GUEST_SLUG}/items/Wood`);
    expect(guestTarget("/buildings/Foundation")).toBe(`/s/${GUEST_SLUG}/buildings/Foundation`);
  });

  it("normalise le slash final", () => {
    expect(guestTarget("/paldex/")).toBe(`/s/${GUEST_SLUG}/paldex`);
    expect(guestTarget("/map/")).toBe(`/s/${GUEST_SLUG}/map`);
  });

  it("couvre les 7 fonctionnalités publiques de l'étape 1", () => {
    for (const path of ["/paldex", "/breeding", "/items", "/craft", "/tech", "/buildings", "/map"]) {
      expect(guestTarget(path)).toBe(`/s/${GUEST_SLUG}${path}`);
    }
  });

  it("ne capture pas un préfixe partiel", () => {
    // Le piège : /paldex ne doit pas avaler /paldexical.
    expect(guestTarget("/paldexical")).toBeUndefined();
    expect(guestTarget("/mapping")).toBeUndefined();
    expect(guestTarget("/techno")).toBeUndefined();
  });

  it("laisse passer les routes publiques non-invité", () => {
    expect(guestTarget("/")).toBeUndefined();
    expect(guestTarget("/docs")).toBeUndefined();
    expect(guestTarget("/login")).toBeUndefined();
    expect(guestTarget("/login/discord/callback")).toBeUndefined();
    expect(guestTarget("/logout")).toBeUndefined();
    expect(guestTarget("/servers")).toBeUndefined();
    expect(guestTarget("/servers/new")).toBeUndefined();
    expect(guestTarget("/join/abc123")).toBeUndefined();
  });

  it("laisse passer les routes techniques et les assets", () => {
    expect(guestTarget("/api/servers/abc/progress")).toBeUndefined();
    expect(guestTarget("/ingest/e")).toBeUndefined();
    expect(guestTarget("/sitemap.xml")).toBeUndefined();
    expect(guestTarget("/robots.txt")).toBeUndefined();
    expect(guestTarget("/icons/pals/Anubis.webp")).toBeUndefined();
  });

  it("ne re-mappe pas une URL tenant déjà résolue", () => {
    expect(guestTarget("/s/abc123XYZ0/paldex")).toBeUndefined();
    expect(guestTarget(`/s/${GUEST_SLUG}/paldex`)).toBeUndefined();
  });
});

describe("stripGuestPrefix", () => {
  it("retire le préfixe interne", () => {
    expect(stripGuestPrefix(`/s/${GUEST_SLUG}/paldex`)).toBe("/paldex");
    expect(stripGuestPrefix(`/s/${GUEST_SLUG}/paldex/SheepBall`)).toBe("/paldex/SheepBall");
  });

  it("renvoie la racine relative sur le préfixe seul", () => {
    expect(stripGuestPrefix(`/s/${GUEST_SLUG}`)).toBe("");
  });

  it("laisse intact un chemin sans le préfixe", () => {
    // Un membre EN arrive avec un chemin déjà dé-localisé : pas de double retrait.
    expect(stripGuestPrefix("/paldex")).toBe("/paldex");
    expect(stripGuestPrefix("/s/abc123XYZ0/paldex")).toBe("/s/abc123XYZ0/paldex");
  });

  it("ne confond pas un slug qui commence pareil", () => {
    expect(stripGuestPrefix(`/s/${GUEST_SLUG}xyz/paldex`)).toBe(`/s/${GUEST_SLUG}xyz/paldex`);
  });

  it("est idempotent", () => {
    const once = stripGuestPrefix(`/s/${GUEST_SLUG}/paldex`);
    expect(stripGuestPrefix(once)).toBe(once);
  });
});

describe("isGuestRouteId", () => {
  it("accepte les routes de fonctionnalité et leurs enfants", () => {
    expect(isGuestRouteId("/s/[slug]/paldex")).toBe(true);
    expect(isGuestRouteId("/s/[slug]/paldex/[palId]")).toBe(true);
    expect(isGuestRouteId("/s/[slug]/items/[itemId]")).toBe(true);
    expect(isGuestRouteId("/s/[slug]/map")).toBe(true);
  });

  it("refuse le tableau de bord, la synchro et l'administration", () => {
    expect(isGuestRouteId("/s/[slug]")).toBe(false);
    expect(isGuestRouteId("/s/[slug]/settings")).toBe(false);
    expect(isGuestRouteId("/s/[slug]/import")).toBe(false);
    expect(isGuestRouteId("/s/[slug]/upload")).toBe(false);
    expect(isGuestRouteId("/s/[slug]/setup")).toBe(false);
  });

  it("accepte les équipes et leurs sous-routes (étape 2)", () => {
    expect(isGuestRouteId("/s/[slug]/teams")).toBe(true);
    expect(isGuestRouteId("/s/[slug]/teams/new")).toBe(true);
    expect(isGuestRouteId("/s/[slug]/teams/[teamId=uuid]")).toBe(true);
  });

  it("refuse un route id absent", () => {
    expect(isGuestRouteId(null)).toBe(false);
  });
});

describe("GUEST_INDEXABLE_FEATURES", () => {
  it("exclut les espaces de travail personnels du sitemap", () => {
    // /teams reste accessible et dans la nav, mais n'a rien à faire dans l'index :
    // la liste d'équipes d'un visiteur est vide par définition.
    expect(GUEST_FEATURES).toContain("/teams");
    expect(GUEST_INDEXABLE_FEATURES).not.toContain("/teams");
  });

  it("garde toutes les autres fonctionnalités", () => {
    for (const f of ["/paldex", "/breeding", "/items", "/craft", "/tech", "/buildings", "/map"]) {
      expect(GUEST_INDEXABLE_FEATURES).toContain(f);
    }
  });
});
