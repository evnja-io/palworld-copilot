import { describe, expect, it } from "vitest";
import {
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
  it("retrouve les Pals droppant du cuir", () => {
    // Le bois brut n'est droppé par aucun Pal (il vient des arbres) ;
    // le cuir est le drop le plus répandu.
    expect(palsDropping.get("Leather")?.length).toBeGreaterThan(10);
  });
  it("retrouve la techno débloquant une recette", () => {
    const anyTech = techUnlocking.size;
    expect(anyTech).toBeGreaterThan(300);
  });
});
