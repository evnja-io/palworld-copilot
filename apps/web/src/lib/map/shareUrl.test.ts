import { describe, expect, it } from "vitest";
import { defaultQuery, type Query } from "./query";
import { fromSearchParams, sanitizeQuery, sanitizeSpawn, toSearchParams } from "./shareUrl";

const spawn = { spawnPal: null, spawnPhase: "day" as const };

describe("toSearchParams", () => {
  it("n'écrit que ce qui diffère des défauts", () => {
    const p = toSearchParams(defaultQuery(), spawn);
    expect(p.toString()).toBe("");
  });

  it("sérialise catégories, affinage et recherche", () => {
    const p = toSearchParams(
      {
        ...defaultQuery(),
        selected: "alpha",
        visible: ["alpha", "tower"],
        levelMin: 40,
        element: "Fire",
        hideTracked: true,
        search: "anub",
      },
      { spawnPal: "Anubis", spawnPhase: "night" },
    );
    expect(p.get("sel")).toBe("alpha");
    expect(p.get("vis")).toBe("alpha,tower");
    expect(p.get("lvl")).toBe("40");
    expect(p.get("el")).toBe("Fire");
    expect(p.get("todo")).toBe("1");
    expect(p.get("q")).toBe("anub");
    expect(p.get("pal")).toBe("Anubis");
    expect(p.get("phase")).toBe("night");
  });

  it("aller-retour avec un ensemble visible explicitement vide", () => {
    const q: Query = { ...defaultQuery(), visible: [] };
    const parsed = fromSearchParams(toSearchParams(q, spawn));
    expect(parsed?.query.visible).toEqual([]);
  });

  it("aller-retour avec une recherche contenant &, #, espace et accent", () => {
    const search = "volcan noir & café #1";
    const q = { ...defaultQuery(), search };
    const parsed = fromSearchParams(toSearchParams(q, spawn));
    expect(parsed?.query.search).toBe(search);
  });
});

describe("fromSearchParams", () => {
  it("renvoie null sans paramètre de filtre", () => {
    expect(fromSearchParams(new URLSearchParams(""))).toBeNull();
    expect(fromSearchParams(new URLSearchParams("focus=relic_x"))).toBeNull();
  });

  it("fait l'aller-retour", () => {
    const q = {
      ...defaultQuery(),
      selected: "boss" as const,
      visible: ["boss"] as const,
      levelMin: 25,
      hideTracked: true,
    };
    const parsed = fromSearchParams(toSearchParams({ ...q, visible: [...q.visible] }, spawn));
    expect(parsed?.query.selected).toBe("boss");
    expect(parsed?.query.visible).toEqual(["boss"]);
    expect(parsed?.query.levelMin).toBe(25);
    expect(parsed?.query.hideTracked).toBe(true);
  });

  it("ignore une catégorie inconnue", () => {
    const parsed = fromSearchParams(new URLSearchParams("vis=alpha,licorne&sel=licorne"));
    expect(parsed?.query.visible).toEqual(["alpha"]);
    expect(parsed?.query.selected).toBeUndefined();
  });

  it("borne le niveau", () => {
    expect(fromSearchParams(new URLSearchParams("lvl=0"))?.query.levelMin).toBe(1);
    expect(fromSearchParams(new URLSearchParams("lvl=999"))?.query.levelMin).toBe(70);
    expect(fromSearchParams(new URLSearchParams("lvl=abc"))?.query.levelMin).toBeUndefined();
  });

  it("ignore une phase invalide", () => {
    // `phase` seul ne constitue pas une vue (cf. tests ci-dessous) : on
    // ajoute `sel=` pour isoler la validation de la phase elle-même.
    expect(
      fromSearchParams(new URLSearchParams("sel=alpha&phase=midi"))?.spawn.spawnPhase,
    ).toBeUndefined();
    expect(
      fromSearchParams(new URLSearchParams("sel=alpha&phase=night"))?.spawn.spawnPhase,
    ).toBe("night");
  });

  // Fix round 1 (Important 1) : `?pal=` seul est le lien "voir les zones"
  // depuis une fiche Pal (paldex/[palId]/+page.svelte). Il ne doit pas être
  // traité comme une vue, sinon MapState.restore() écraserait les filtres
  // sauvegardés de l'utilisateur par les défauts à chaque clic sur ce lien.
  it("un ?pal= seul ne constitue pas une vue : les filtres restent intouchés", () => {
    expect(fromSearchParams(new URLSearchParams("pal=Anubis"))).toBeNull();
    expect(fromSearchParams(new URLSearchParams("pal=Anubis&phase=night"))).toBeNull();
  });

  it("un lien de vue complet restaure aussi le pal et la phase", () => {
    const parsed = fromSearchParams(new URLSearchParams("sel=alpha&pal=Anubis&phase=night"));
    expect(parsed).not.toBeNull();
    expect(parsed?.spawn.spawnPal).toBe("Anubis");
    expect(parsed?.spawn.spawnPhase).toBe("night");
  });

  // Fix round 1 (Important 2) : la présence d'une clé ne suffit pas, il faut
  // qu'au moins une clé de vue ait effectivement validé.
  it("renvoie null quand aucune clé de vue ne valide, même présente", () => {
    expect(fromSearchParams(new URLSearchParams("sel="))).toBeNull();
    expect(fromSearchParams(new URLSearchParams("sel=licorne"))).toBeNull();
  });

  it("un ?vis= valide constitue bien une vue", () => {
    expect(fromSearchParams(new URLSearchParams("vis=alpha,tower"))).not.toBeNull();
  });

  // MUST-FIX (revue de branche complète, 2026-07-26) : `?vis=garbage` filtrait
  // silencieusement en `[]`, indiscernable d'un `?vis=` explicitement vide -
  // un paramètre corrompu écrasait alors localStorage par une carte vide.
  it("un ?vis= explicitement vide reste une vue valide (rien de visible)", () => {
    const parsed = fromSearchParams(new URLSearchParams("vis="));
    expect(parsed).not.toBeNull();
    expect(parsed?.query.visible).toEqual([]);
  });

  it("un ?vis= sans aucun segment connu ne valide rien", () => {
    expect(fromSearchParams(new URLSearchParams("vis=garbage"))).toBeNull();
    expect(fromSearchParams(new URLSearchParams("vis=licorne,dragon-rose"))).toBeNull();
  });

  it("un ?el= inconnu est ignoré, un ?el= connu est accepté", () => {
    expect(fromSearchParams(new URLSearchParams("sel=alpha&el=garbage"))?.query.element).toBeUndefined();
    expect(fromSearchParams(new URLSearchParams("sel=alpha&el=Fire"))?.query.element).toBe("Fire");
  });
});

describe("sanitizeQuery", () => {
  it("valide un objet correct champ par champ", () => {
    const q = sanitizeQuery({
      selected: "boss",
      visible: ["boss", "tower"],
      levelMin: 25,
      element: "Fire",
      hideTracked: true,
      search: "anub",
    });
    expect(q).toEqual({
      selected: "boss",
      visible: ["boss", "tower"],
      levelMin: 25,
      element: "Fire",
      hideTracked: true,
      search: "anub",
    });
  });

  it("rejette les champs de mauvais type plutôt que de les propager", () => {
    // `visible` en chaîne au lieu d'un tableau : cf. Fix round 1, item
    // localStorage. Sans cette garde, `.join(",")` planterait dans toSearchParams.
    const q = sanitizeQuery({
      selected: "licorne",
      visible: "relic",
      levelMin: "40",
      element: 42,
      hideTracked: "oui",
      search: 123,
    });
    expect(q).toEqual({});
  });

  it("borne levelMin et ignore les entrées non finies", () => {
    expect(sanitizeQuery({ levelMin: 999 })).toEqual({ levelMin: 70 });
    expect(sanitizeQuery({ levelMin: 0 })).toEqual({ levelMin: 1 });
    expect(sanitizeQuery({ levelMin: Number.NaN })).toEqual({});
  });

  it("renvoie un objet vide pour une entrée non-objet", () => {
    expect(sanitizeQuery(null)).toEqual({});
    expect(sanitizeQuery("relic")).toEqual({});
    expect(sanitizeQuery(undefined)).toEqual({});
  });
});

describe("sanitizeSpawn", () => {
  it("valide spawnPal et spawnPhase", () => {
    expect(sanitizeSpawn({ spawnPal: "Anubis", spawnPhase: "night" })).toEqual({
      spawnPal: "Anubis",
      spawnPhase: "night",
    });
    expect(sanitizeSpawn({ spawnPal: null, spawnPhase: "day" })).toEqual({
      spawnPal: null,
      spawnPhase: "day",
    });
  });

  it("rejette une phase invalide", () => {
    expect(sanitizeSpawn({ spawnPal: "Anubis", spawnPhase: "midi" })).toEqual({
      spawnPal: "Anubis",
    });
  });

  it("renvoie un objet vide pour une entrée non-objet", () => {
    expect(sanitizeSpawn(null)).toEqual({});
    expect(sanitizeSpawn(42)).toEqual({});
  });
});
