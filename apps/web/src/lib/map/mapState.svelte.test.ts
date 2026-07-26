import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapState } from "./mapState.svelte";
import { defaultQuery } from "./query";

const KEY = "map-filters-v3";

/** localStorage minimal pour vitest (environnement node, pas de vrai storage). */
function installStorage(initial?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
  };
  vi.stubGlobal("localStorage", store);
  return map;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("MapState.restore", () => {
  it("retombe sur les défauts si localStorage est vide", () => {
    installStorage();
    const state = new MapState();
    state.restore();
    expect(state.query).toEqual(defaultQuery());
    expect(state.spawn).toEqual({ spawnPal: null, spawnPhase: "day" });
  });

  it("restaure un payload localStorage valide", () => {
    installStorage({
      [KEY]: JSON.stringify({
        query: { ...defaultQuery(), selected: "boss", levelMin: 30 },
        spawn: { spawnPal: "Anubis", spawnPhase: "night" },
      }),
    });
    const state = new MapState();
    state.restore();
    expect(state.query.selected).toBe("boss");
    expect(state.query.levelMin).toBe(30);
    expect(state.spawn).toEqual({ spawnPal: "Anubis", spawnPhase: "night" });
  });

  // Fix round 1, item localStorage : payload aux types corrompus (ex. une
  // extension tierce ou une version antérieure du site a écrit n'importe quoi).
  it("ignore un payload localStorage aux types corrompus", () => {
    installStorage({
      [KEY]: JSON.stringify({
        query: { selected: "licorne", visible: "relic", levelMin: "quarante" },
        spawn: { spawnPal: 42, spawnPhase: "midi" },
      }),
    });
    const state = new MapState();
    state.restore();
    expect(state.query).toEqual(defaultQuery());
    expect(state.spawn).toEqual({ spawnPal: null, spawnPhase: "day" });
  });

  // Fix round 1, item localStorage : JSON carrément invalide, pas seulement
  // un mauvais type de champ.
  it("ignore un payload localStorage qui n'est pas du JSON valide", () => {
    installStorage({ [KEY]: "{not json" });
    const state = new MapState();
    state.restore();
    expect(state.query).toEqual(defaultQuery());
    expect(state.spawn).toEqual({ spawnPal: null, spawnPhase: "day" });
  });

  // Fix round 1, Important 1 : le lien "voir les zones" d'une fiche Pal
  // (paldex/[palId]/+page.svelte) n'envoie que `?pal=`. Il ne doit pas
  // réinitialiser les filtres sauvegardés de l'utilisateur.
  it("un ?pal= seul dans l'URL laisse les filtres localStorage intacts", () => {
    installStorage({
      [KEY]: JSON.stringify({
        query: { ...defaultQuery(), selected: "boss", hideTracked: true },
        spawn: { spawnPal: null, spawnPhase: "day" },
      }),
    });
    const state = new MapState();
    state.restore(new URL("https://example.test/s/x/map?pal=Anubis"));
    expect(state.query.selected).toBe("boss");
    expect(state.query.hideTracked).toBe(true);
  });

  it("une URL de vue complète l'emporte sur localStorage", () => {
    installStorage({
      [KEY]: JSON.stringify({
        query: { ...defaultQuery(), selected: "boss" },
        spawn: { spawnPal: null, spawnPhase: "day" },
      }),
    });
    const state = new MapState();
    state.restore(new URL("https://example.test/s/x/map?sel=alpha"));
    expect(state.query.selected).toBe("alpha");
  });
});
