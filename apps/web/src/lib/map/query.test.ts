import { describe, expect, it } from "vitest";
import { defaultQuery, runQuery, type Query } from "./query";
import type { MapMarker } from "./markerController";

const MARKERS: MapMarker[] = [
  { id: "r1", type: "relic", px: 0, py: 0 },
  { id: "r2", type: "relic", px: 0, py: 0 },
  { id: "a1", type: "alpha", px: 0, py: 0, meta: { palId: "Anubis", level: 47 } },
  { id: "a2", type: "alpha", px: 0, py: 0, meta: { palId: "Chillet", level: 11 } },
  { id: "b1", type: "boss", px: 0, py: 0, meta: { level: 30 } },
  { id: "t1", type: "tower", px: 0, py: 0, nameId: "FTPoint45" },
  { id: "f1", type: "ft", px: 0, py: 0, nameId: "FTPoint1" },
];

const NAMES: Record<string, string> = {
  r1: "Effigie 001",
  r2: "Effigie 002",
  a1: "Anubis",
  a2: "Chillet",
  b1: "Believer CrossBow",
  t1: "Tour du Syndicat de Rayne",
  f1: "Volcan Noir – Flanc",
};
const nameOf = (mk: MapMarker) => NAMES[mk.id] ?? mk.id;
const ELEMENTS: Record<string, string> = { Anubis: "Earth", Chillet: "Ice" };
const q = (over: Partial<Query> = {}): Query => ({ ...defaultQuery(), ...over });
const ids = (list: MapMarker[]) => list.map((mk) => mk.id);

describe("runQuery", () => {
  it("ne renvoie que la catégorie sélectionnée", () => {
    expect(ids(runQuery(MARKERS, q({ selected: "relic" }), new Set(), nameOf))).toEqual([
      "r1",
      "r2",
    ]);
    expect(ids(runQuery(MARKERS, q({ selected: "tower" }), new Set(), nameOf))).toEqual(["t1"]);
  });

  it("filtre par niveau minimum", () => {
    const out = runQuery(MARKERS, q({ selected: "alpha", levelMin: 40 }), new Set(), nameOf);
    expect(ids(out)).toEqual(["a1"]);
  });

  it("ignore le niveau pour une catégorie sans niveau", () => {
    const out = runQuery(MARKERS, q({ selected: "relic", levelMin: 70 }), new Set(), nameOf);
    expect(ids(out)).toEqual(["r1", "r2"]);
  });

  it("filtre par élément via elementOf", () => {
    const out = runQuery(
      MARKERS,
      q({ selected: "alpha", element: "Ice" }),
      new Set(),
      nameOf,
      (mk) => (mk.meta?.palId ? ELEMENTS[mk.meta.palId] : undefined),
    );
    expect(ids(out)).toEqual(["a2"]);
  });

  it("masque ce qui est suivi", () => {
    const out = runQuery(
      MARKERS,
      q({ selected: "relic", hideTracked: true }),
      new Set(["r1"]),
      nameOf,
    );
    expect(ids(out)).toEqual(["r2"]);
  });

  it("cherche sans casse ni accents", () => {
    expect(
      ids(runQuery(MARKERS, q({ selected: "alpha", search: "ANUB" }), new Set(), nameOf)),
    ).toEqual(["a1"]);
    expect(
      ids(runQuery(MARKERS, q({ selected: "ft", search: "volcan noir" }), new Set(), nameOf)),
    ).toEqual(["f1"]);
    expect(
      ids(runQuery(MARKERS, q({ selected: "ft", search: "flanc" }), new Set(), nameOf)),
    ).toEqual(["f1"]);
  });

  it("rend une liste vide pour une catégorie future", () => {
    expect(runQuery(MARKERS, q({ selected: "resource" }), new Set(), nameOf)).toEqual([]);
  });

  it("rend une liste vide pour la pseudo-catégorie spawn", () => {
    expect(runQuery(MARKERS, q({ selected: "spawn" }), new Set(), nameOf)).toEqual([]);
  });

  it("combine les critères", () => {
    const out = runQuery(
      MARKERS,
      q({ selected: "alpha", levelMin: 10, search: "chill", hideTracked: true }),
      new Set(["a1"]),
      nameOf,
    );
    expect(ids(out)).toEqual(["a2"]);
  });
});

describe("visibleMarkers", () => {
  it("ne garde que les catégories visibles et applique hideTracked aux suivis", async () => {
    const { visibleMarkers } = await import("./query");
    const out = visibleMarkers(
      MARKERS,
      q({ visible: ["relic", "tower"], hideTracked: true }),
      new Set(["r1"]),
    );
    expect(ids(out)).toEqual(["r2", "t1"]);
  });
});

describe("defaultQuery", () => {
  it("part sur les catégories de progression, pas sur les 414 marqueurs", () => {
    const d = defaultQuery();
    expect(d.selected).toBe("relic");
    expect(d.visible).toEqual(["relic", "alpha", "boss", "tower"]);
    expect(d.levelMin).toBe(1);
    expect(d.hideTracked).toBe(false);
  });
});
