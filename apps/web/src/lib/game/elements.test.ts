import { describe, expect, it } from "vitest";
import pals from "@palworld-companion/game-data/pals.json";
import skills from "@palworld-companion/game-data/skills.json";
import { ELEMENT_IDS, elHex, elLabel, elToken, elVar, elVars } from "./elements";

describe("elements", () => {
  it("couvre tous les éléments présents dans pals.json", () => {
    const used = [...new Set(pals.flatMap((p) => p.elements))].sort();
    // Un élément inconnu retomberait silencieusement sur « normal » et
    // dépeindrait toute une famille de Pals en gris. « Normal » est le seul
    // à s'y mapper légitimement.
    for (const el of used) {
      if (el === "Normal") continue;
      expect(elToken(el), `élément « ${el} » non mappé`).not.toBe("normal");
    }
    expect(used).toHaveLength(ELEMENT_IDS.length);
    expect([...ELEMENT_IDS].sort()).toEqual(used);
  });

  it("retombe sur normal pour un id inconnu et pour « None » (skills)", () => {
    const elems = new Set(
      Object.values(skills as Record<string, { element?: string }>)
        .map((s) => s.element)
        .filter((e): e is string => !!e)
    );
    expect(elems.has("None")).toBe(true);
    expect(elToken("None")).toBe("normal");
    expect(elToken("Plasma")).toBe("normal");
  });

  it("elVar et elHex restent cohérents", () => {
    expect(elVar("Fire")).toBe("var(--color-el-feu)");
    expect(elVar("Dark")).toBe("var(--color-el-tenebres)");
    expect(elHex("Fire")).toBe("#ff5a0f");
    expect(elHex("Leaf")).toBe("#3fb950");
  });

  it("elVars distingue mono-type et bi-type", () => {
    // Alphas relevés sur le HTML de référence, écran 2b (slots 2 et 3).
    expect(elVars(["Leaf"])).toBe(
      "--el:var(--color-el-feuille);--el2:var(--color-el-feuille);--el2-a:4%"
    );
    expect(elVars(["Fire", "Dark"])).toBe(
      "--el:var(--color-el-feu);--el2:var(--color-el-tenebres);--el2-a:8%"
    );
    // Un Pal sans élément ne doit pas produire « --el:undefined ».
    expect(elVars([])).toContain("--color-el-normal");
  });

  it("elLabel rend les libellés partagés avec la palette ⌘K", () => {
    expect(elLabel("Fire", "fr")).toBe("Feu");
    expect(elLabel("Dark", "fr")).toBe("Ténèbres");
    expect(elLabel("Leaf", "fr")).toBe("Plante");
    expect(elLabel("Leaf", "en")).toBe("Grass");
  });
});
