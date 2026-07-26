import { describe, expect, it } from "vitest";
import markersJson from "@palworld-companion/game-data/markers.json";
import { CATEGORIES, MARKER_CATEGORIES, categoryOf, countsByCategory } from "./categories";
import type { MapMarker } from "./markerController";

const markers = markersJson as MapMarker[];

describe("catégories", () => {
  it("couvre tous les marqueurs sans en inventer", () => {
    // MARKER_CATEGORIES est le sous-ensemble réellement peuplé par markers.json
    // (pas future, pas spawn) : l'utiliser ici double comme test de non-régression
    // pour cet export, sinon inutilisé ailleurs dans le code.
    const total = MARKER_CATEGORIES.reduce(
      (sum, k) => sum + markers.filter((mk) => categoryOf(mk) === k).length,
      0,
    );
    expect(total).toBe(markers.length);
  });

  it("annonce les volumes attendus", () => {
    const n = (k: string) => markers.filter((mk) => categoryOf(mk) === k).length;
    expect(n("relic")).toBe(138);
    expect(n("alpha")).toBe(83);
    expect(n("boss")).toBe(36);
    expect(n("tower")).toBe(8);
    expect(n("watchtower")).toBe(20);
    expect(n("ft")).toBe(129);
  });

  it("marque ressources comme future et sans données", () => {
    expect(CATEGORIES.resource.future).toBe(true);
    expect(markers.some((mk) => categoryOf(mk) === "resource")).toBe(false);
  });

  it("n'ouvre l'affinage par élément qu'aux alphas", () => {
    expect(CATEGORIES.alpha.refine).toBe("level+element");
    expect(CATEGORIES.boss.refine).toBe("level");
    expect(CATEGORIES.relic.refine).toBe("none");
    expect(CATEGORIES.ft.refine).toBe("none");
  });

  it("compte mine et group par catégorie", () => {
    const sample = markers.filter((mk) => categoryOf(mk) === "relic").slice(0, 3);
    const mine = new Set([sample[0].id, sample[1].id]);
    const group = { [sample[2].id]: [{ id: "u", username: "u", avatarUrl: null }] };
    const counts = countsByCategory(markers, mine, group);
    expect(counts.relic.mine).toBe(2);
    expect(counts.relic.group).toBe(1);
    expect(counts.relic.total).toBe(138);
    expect(counts.alpha.mine).toBe(0);
  });

  // Régression du bug d'ids (spec « Régression du bug d'ids ») : un id dupliqué
  // fait lever `each_key_duplicate` sur tout `{#each}` keyé côté web.
  it("n'a aucun id dupliqué dans markers.json", () => {
    expect(new Set(markers.map((mk) => mk.id)).size).toBe(markers.length);
  });
});
