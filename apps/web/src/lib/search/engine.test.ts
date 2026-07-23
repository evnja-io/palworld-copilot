import { describe, expect, it } from "vitest";
import { runSearch, type SearchContext, type SearchEntry } from "./engine";

const INDEX: SearchEntry[] = [
  {
    id: "pal:Anubis",
    fr: "Anubis",
    en: "Anubis",
    el: ["Earth"],
    wk: { Handcraft: 4, Mining: 3, Transport: 2 },
  },
  {
    id: "pal:Foxparks",
    fr: "Pyrenard",
    en: "Foxparks",
    el: ["Fire"],
    wk: { EmitFlame: 1 },
  },
  {
    id: "pal:Blazamut",
    fr: "Blazamut",
    en: "Blazamut",
    el: ["Fire"],
    wk: { EmitFlame: 3, Mining: 4 },
  },
  { id: "item:PalSphere", fr: "Sphère", en: "Pal Sphere", cat: "Consume" },
  { id: "skill:Ignis", fr: "Missile Igné", en: "Ignis Blast", el: ["Fire"], pw: 30, ct: 2 },
  { id: "passive:Legend", fr: "Légende", en: "Legend" },
  { id: "marker:relic_a", fr: "Effigie Lifmunk (1, 2)", en: "Lifmunk Effigy (1, 2)", mk: "relic", px: 1, py: 2 },
  { id: "marker:relic_b", fr: "Effigie Lifmunk (3, 4)", en: "Lifmunk Effigy (3, 4)", mk: "relic", px: 3, py: 4 },
  { id: "marker:alpha_x", fr: "Anubis", en: "Anubis", mk: "alpha", lvl: 38, pal: "Anubis", px: 5, py: 6 },
];

const ctx: SearchContext = { locale: "fr" };

describe("runSearch — fuzzy", () => {
  it("tolère les fautes de frappe (« anubs » trouve Anubis)", () => {
    const groups = runSearch(INDEX, [], "anubs", ctx);
    const pals = groups.find((g) => g.ns === "pal");
    expect(pals?.items.map((i) => i.entry.id)).toContain("pal:Anubis");
  });

  it("matche les diacritiques et le nom EN", () => {
    const bySphere = runSearch(INDEX, [], "sphere", ctx).flatMap((g) => g.items);
    expect(bySphere.map((i) => i.entry.id)).toContain("item:PalSphere");
    const byEn = runSearch(INDEX, [], "foxparks", ctx).flatMap((g) => g.items);
    expect(byEn.map((i) => i.entry.id)).toContain("pal:Foxparks");
  });

  it("affiche le nom FR dès qu'il matche, même sans accents dans la requête", () => {
    // « sphere » matche « Sphère » (FR) ET « Pal Sphere » (EN) : la langue de
    // l'utilisateur doit gagner, peu importe le score EN.
    const [sphere] = runSearch(INDEX, [], "sphere", ctx)
      .flatMap((g) => g.items)
      .filter((i) => i.entry.id === "item:PalSphere");
    expect(sphere.matchLocale).toBe("fr");
    // Le nom EN ne sert que quand le nom FR ne matche pas du tout.
    const [fox] = runSearch(INDEX, [], "foxparks", ctx)
      .flatMap((g) => g.items)
      .filter((i) => i.entry.id === "pal:Foxparks");
    expect(fox.matchLocale).toBe("en");
  });

  it("expose les indices de surlignage", () => {
    const [pal] = runSearch(INDEX, [], "pyren", ctx).flatMap((g) => g.items);
    expect(pal.matchLocale).toBe("fr");
    expect([...(pal.indexes ?? [])].length).toBeGreaterThan(0);
  });

  it("ne renvoie rien sous 2 caractères sans token", () => {
    expect(runSearch(INDEX, [], "a", ctx)).toEqual([]);
  });
});

describe("runSearch — tokens", () => {
  it("combine élément + aptitude avec niveau minimum (ET)", () => {
    const groups = runSearch(
      INDEX,
      [
        { kind: "element", value: "Fire" },
        { kind: "work", value: "EmitFlame", min: 2 },
      ],
      "",
      ctx,
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.entry.id))).toEqual(["pal:Blazamut"]);
  });

  it("un élément seul renvoie pals ET skills", () => {
    const groups = runSearch(INDEX, [{ kind: "element", value: "Fire" }], "", ctx);
    expect(groups.map((g) => g.ns)).toEqual(["pal", "skill"]);
  });

  it("filtre les effigies non cochées via la progression", () => {
    const withProgress: SearchContext = { ...ctx, checked: new Set(["relic_a"]) };
    const groups = runSearch(
      INDEX,
      [
        { kind: "marker", value: "relic" },
        { kind: "progress", value: "unchecked" },
      ],
      "",
      withProgress,
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.entry.id))).toEqual(["marker:relic_b"]);
  });

  it("le token skill liste les pals qui apprennent la compétence", () => {
    const withLearners: SearchContext = {
      ...ctx,
      learners: new Map([["Ignis", new Set(["Foxparks", "Blazamut"])]]),
    };
    const groups = runSearch(
      INDEX,
      [{ kind: "skill", value: "Ignis", label: "Missile Igné" }],
      "",
      withLearners,
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.entry.id)).sort()).toEqual([
      "pal:Blazamut",
      "pal:Foxparks",
    ]);
  });

  it("le fuzzy trouve les talents passifs dans leur propre groupe", () => {
    const groups = runSearch(INDEX, [], "legende", ctx);
    const passives = groups.find((g) => g.ns === "passive");
    expect(passives?.items.map((i) => i.entry.id)).toContain("passive:Legend");
  });

  it("le token passif liste les pals qui possèdent le talent", () => {
    const withHolders: SearchContext = {
      ...ctx,
      passiveHolders: new Map([["Legend", new Set(["Anubis"])]]),
    };
    const groups = runSearch(
      INDEX,
      [{ kind: "passive", value: "Legend", label: "Légende" }],
      "",
      withHolders,
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.entry.id))).toEqual(["pal:Anubis"]);
  });

  it("combine token + fuzzy", () => {
    const groups = runSearch(INDEX, [{ kind: "element", value: "Fire" }], "blaz", ctx);
    expect(groups.flatMap((g) => g.items.map((i) => i.entry.id))).toEqual(["pal:Blazamut"]);
  });
});
