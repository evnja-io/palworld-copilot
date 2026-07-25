import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamSlot } from "$lib/types";

vi.mock("$app/environment", () => ({ browser: true }));

const {
  LOCAL_TEAMS_KEY,
  MAX_LOCAL_TEAMS,
  clearLocalTeams,
  countLocalTeams,
  deleteLocalTeam,
  getLocalTeam,
  listLocalTeams,
  upsertLocalTeam,
} = await import("./localTeams");

function installStorage(options: { throwing?: boolean } = {}) {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
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
  });
  return map;
}

const slot = (palId: string): TeamSlot => ({ palId, passives: [], actives: [] });

function team(id: string, name = "Équipe", updatedAt = "2026-07-25T10:00:00.000Z") {
  return { id, name, notes: "", slots: [slot("SheepBall"), null, null, null, null], updatedAt };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("localTeams", () => {
  it("fait un aller-retour", () => {
    installStorage();
    expect(upsertLocalTeam(team("a", "Alpha"))).toBe(true);
    expect(listLocalTeams()).toHaveLength(1);
    expect(getLocalTeam("a")?.name).toBe("Alpha");
    expect(countLocalTeams()).toBe(1);
  });

  it("remplace au lieu de dupliquer sur le même id", () => {
    installStorage();
    upsertLocalTeam(team("a", "Alpha"));
    upsertLocalTeam(team("a", "Alpha renommée"));
    expect(listLocalTeams()).toHaveLength(1);
    expect(getLocalTeam("a")?.name).toBe("Alpha renommée");
  });

  it("trie par date de modification décroissante, comme listTeams côté serveur", () => {
    installStorage();
    upsertLocalTeam(team("vieux", "Vieux", "2026-07-01T00:00:00.000Z"));
    upsertLocalTeam(team("recent", "Récent", "2026-07-25T00:00:00.000Z"));
    expect(listLocalTeams().map((t) => t.id)).toEqual(["recent", "vieux"]);
  });

  it("refuse une création au-delà du plafond mais accepte les mises à jour", () => {
    installStorage();
    for (let i = 0; i < MAX_LOCAL_TEAMS; i++) {
      expect(upsertLocalTeam(team(`t${i}`))).toBe(true);
    }
    expect(upsertLocalTeam(team("un-de-trop"))).toBe(false);
    expect(countLocalTeams()).toBe(MAX_LOCAL_TEAMS);
    // Une mise à jour d'une équipe existante doit rester possible.
    expect(upsertLocalTeam(team("t0", "Renommée"))).toBe(true);
    expect(getLocalTeam("t0")?.name).toBe("Renommée");
  });

  it("supprime sans toucher aux autres", () => {
    installStorage();
    upsertLocalTeam(team("a"));
    upsertLocalTeam(team("b"));
    deleteLocalTeam("a");
    expect(listLocalTeams().map((t) => t.id)).toEqual(["b"]);
  });

  it("renvoie [] sur du JSON corrompu", () => {
    const map = installStorage();
    map.set(LOCAL_TEAMS_KEY, "{pas du json");
    expect(listLocalTeams()).toEqual([]);
  });

  it("écarte les entrées de forme invalide sans jeter", () => {
    const map = installStorage();
    map.set(
      LOCAL_TEAMS_KEY,
      JSON.stringify({
        version: 1,
        teams: [
          team("ok"),
          { id: 42 }, // id non-string
          { id: "x", name: "y", notes: "", slots: "pas un tableau", updatedAt: "z" },
          { id: "y", name: "y", notes: "", slots: [{ palId: 1 }], updatedAt: "z" },
          null,
        ],
      }),
    );
    expect(listLocalTeams().map((t) => t.id)).toEqual(["ok"]);
  });

  it("renvoie [] si l'enveloppe n'a pas de tableau teams", () => {
    const map = installStorage();
    map.set(LOCAL_TEAMS_KEY, JSON.stringify({ version: 1 }));
    expect(listLocalTeams()).toEqual([]);
  });

  it("ne jette pas si localStorage est inaccessible", () => {
    installStorage({ throwing: true });
    expect(() => upsertLocalTeam(team("a"))).not.toThrow();
    expect(listLocalTeams()).toEqual([]);
    expect(() => deleteLocalTeam("a")).not.toThrow();
    expect(() => clearLocalTeams()).not.toThrow();
  });

  it("clearLocalTeams purge tout", () => {
    installStorage();
    upsertLocalTeam(team("a"));
    clearLocalTeams();
    expect(listLocalTeams()).toEqual([]);
  });
});
