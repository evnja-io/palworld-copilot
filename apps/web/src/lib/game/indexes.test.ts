import pals from "@palworld-companion/game-data/pals.json";
import { describe, expect, it } from "vitest";
import {
  markersByPal,
  palsDropping,
  recipesByProduct,
  recipesUsingItem,
  techUnlocking,
} from "./indexes";

describe("index inversés", () => {
  it("retrouve les recettes produisant un item courant", () => {
    const r = recipesByProduct.get("PalSphere");
    expect(r?.length).toBeGreaterThan(0);
    expect(r![0].productId).toBe("PalSphere");
  });
  it("retrouve les recettes consommant le bois", () => {
    expect(recipesUsingItem.get("Wood")?.length).toBeGreaterThan(5);
  });
  it("retrouve les Pals droppant du cuir, avec quantités et taux", () => {
    // Le bois brut n'est droppé par aucun Pal (il vient des arbres) ;
    // le cuir est le drop le plus répandu.
    const drops = palsDropping.get("Leather");
    expect(drops?.length).toBeGreaterThan(10);
    for (const d of drops!) {
      expect(d.palId).toBeTruthy();
      expect(d.min).toBeGreaterThan(0);
      expect(d.max).toBeGreaterThanOrEqual(d.min);
      expect(d.rate).toBeGreaterThan(0);
    }
  });
  it("retrouve la techno débloquant une recette", () => {
    const anyTech = techUnlocking.size;
    expect(anyTech).toBeGreaterThan(300);
  });
  it("indexe les marqueurs Alpha par Pal, sans la clé « None »", () => {
    // Anubis n'existe qu'en boss de terrain : il doit avoir un marqueur.
    const anubis = markersByPal.get("Anubis");
    expect(anubis?.length).toBeGreaterThan(0);
    expect(anubis![0].type).toBe("alpha");
    expect(anubis![0].meta?.level).toBeGreaterThan(0);
    // SheepBall (nom affiché « Lamball ») est un id valide sans spawner Alpha.
    expect(pals.some((p) => p.id === "SheepBall")).toBe(true);
    expect(markersByPal.get("SheepBall")).toBeUndefined();
    // Les spawners sans Pal résolu (boss PNJ) ne doivent pas créer d'entrée.
    expect(markersByPal.has("None")).toBe(false);
  });
});
