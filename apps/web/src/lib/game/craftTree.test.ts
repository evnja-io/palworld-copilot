import { describe, expect, it } from "vitest";
import { recipesByProduct } from "./indexes";
import { buildTree, craftableIds, rawTotals } from "./craftTree";

describe("craftTree", () => {
  it("multiplie les matériaux par le nombre de fabrications", () => {
    const id = "CompoundBow";
    const recipe = recipesByProduct.get(id)?.[0];
    expect(recipe, "CompoundBow doit avoir une recette").toBeDefined();

    const tree = buildTree(id, 3);
    expect(tree.crafts).toBe(Math.ceil(3 / recipe!.count));
    for (const child of tree.children) {
      const mat = recipe!.materials.find((mt) => mt.id === child.itemId)!;
      expect(child.need).toBe(mat.count * tree.crafts);
    }
  });

  it("arrondit au craft supérieur quand une recette rend plusieurs unités", () => {
    // Une recette qui rend 2 unités ne doit pas être lancée 10 fois pour 10.
    const multi = [...recipesByProduct.values()]
      .map((rs) => rs[0]!)
      .find((r) => r.count > 1);
    expect(multi, "il faut au moins une recette rendant >1 unité").toBeDefined();

    const tree = buildTree(multi!.productId, multi!.count);
    expect(tree.crafts).toBe(1);
    expect(buildTree(multi!.productId, multi!.count + 1).crafts).toBe(2);
  });

  it("termine sur tout le catalogue — pas de cycle non borné", () => {
    // Le vrai test du garde-fou : 1 408 recettes, dont des chaînes circulaires.
    for (const id of craftableIds()) {
      const tree = buildTree(id, 1);
      expect(tree.itemId).toBe(id);
    }
  });

  it("borne la profondeur", () => {
    const deepest = (n: { depth: number; children: { depth: number }[] }): number =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      n.children.length ? Math.max(...n.children.map((c) => deepest(c as any))) : n.depth;
    for (const id of craftableIds()) {
      expect(deepest(buildTree(id, 1))).toBeLessThanOrEqual(8);
    }
  });

  it("n'agrège que les feuilles dans le total brut", () => {
    const tree = buildTree("CompoundBow", 3);
    const totals = rawTotals(tree);
    expect(totals.size).toBeGreaterThan(0);
    // Un nœud intermédiaire (qui a une recette) ne doit pas figurer au total.
    const intermediate = tree.children.find((c) => c.children.length > 0);
    if (intermediate) expect(totals.has(intermediate.itemId)).toBe(false);
  });

  it("un objet sans recette est une feuille", () => {
    const tree = buildTree("Wood", 5);
    expect(tree.children).toEqual([]);
    expect(rawTotals(tree)).toEqual(new Map([["Wood", 5]]));
  });

  it("plancher à 1 sur la quantité", () => {
    expect(buildTree("CompoundBow", 0).need).toBe(1);
    expect(buildTree("CompoundBow", -4).need).toBe(1);
  });
});
