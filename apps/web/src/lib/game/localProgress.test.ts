import { beforeEach, describe, expect, it, vi } from "vitest";

// `browser` est false sous vitest (environnement node) : on le force à true pour
// exercer les vrais chemins de lecture/écriture.
vi.mock("$app/environment", () => ({ browser: true }));

const {
  clearLocalProgress,
  localProgressKey,
  readLocalProgress,
  writeLocalProgress,
} = await import("./localProgress");

/** localStorage minimal, avec un mode « throw » pour simuler navigation privée. */
function installStorage(options: { throwing?: boolean } = {}) {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => {
      if (options.throwing) throw new DOMException("blocked");
      return map.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (options.throwing) throw new DOMException("quota");
      map.set(k, v);
    },
    removeItem: (k: string) => {
      if (options.throwing) throw new DOMException("blocked");
      map.delete(k);
    },
  };
  vi.stubGlobal("localStorage", store);
  return map;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("readLocalProgress / writeLocalProgress", () => {
  it("fait un aller-retour", () => {
    installStorage();
    writeLocalProgress("pal_caught", ["SheepBall", "PinkCat"]);
    expect(readLocalProgress("pal_caught")).toEqual(["SheepBall", "PinkCat"]);
  });

  it("isole les kinds", () => {
    installStorage();
    writeLocalProgress("pal_caught", ["SheepBall"]);
    writeLocalProgress("tech_unlocked", ["Workbench"]);
    expect(readLocalProgress("pal_caught")).toEqual(["SheepBall"]);
    expect(readLocalProgress("tech_unlocked")).toEqual(["Workbench"]);
    expect(readLocalProgress("marker")).toEqual([]);
  });

  it("renvoie [] sans valeur stockée", () => {
    installStorage();
    expect(readLocalProgress("pal_caught")).toEqual([]);
  });

  it("renvoie [] sur du JSON corrompu", () => {
    const map = installStorage();
    map.set(localProgressKey("pal_caught"), "{pas du json");
    expect(readLocalProgress("pal_caught")).toEqual([]);
  });

  it("renvoie [] si la valeur n'est pas un tableau", () => {
    const map = installStorage();
    map.set(localProgressKey("pal_caught"), '{"SheepBall":true}');
    expect(readLocalProgress("pal_caught")).toEqual([]);
  });

  it("filtre les entrées non-string et déduplique", () => {
    const map = installStorage();
    map.set(localProgressKey("pal_caught"), '["SheepBall",42,null,"SheepBall","PinkCat"]');
    expect(readLocalProgress("pal_caught")).toEqual(["SheepBall", "PinkCat"]);
  });

  it("filtre les ids inconnus quand `valid` est fourni", () => {
    installStorage();
    // Cas réel : game-data régénéré, un id a disparu.
    writeLocalProgress("pal_caught", ["SheepBall", "PalSupprime"]);
    expect(readLocalProgress("pal_caught", new Set(["SheepBall"]))).toEqual(["SheepBall"]);
  });

  it("ne jette pas si localStorage est inaccessible", () => {
    installStorage({ throwing: true });
    expect(() => writeLocalProgress("pal_caught", ["SheepBall"])).not.toThrow();
    expect(readLocalProgress("pal_caught")).toEqual([]);
    expect(() => clearLocalProgress(["pal_caught"])).not.toThrow();
  });

  it("clearLocalProgress purge les kinds demandés seulement", () => {
    installStorage();
    writeLocalProgress("pal_caught", ["SheepBall"]);
    writeLocalProgress("marker", ["relic_abc"]);
    clearLocalProgress(["pal_caught"]);
    expect(readLocalProgress("pal_caught")).toEqual([]);
    expect(readLocalProgress("marker")).toEqual(["relic_abc"]);
  });
});
