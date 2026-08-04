import { recipesByProduct, techUnlocking, type Recipe, type Tech } from "$lib/game/indexes";

export type CraftNode = {
  itemId: string;
  /** Quantité requise par le parent. */
  need: number;
  /** Nombre de fabrications : `ceil(need / recipe.count)`. Une recette qui rend
   *  2 unités n'a pas besoin d'être lancée 10 fois pour en produire 10. */
  crafts: number;
  /** Absent = feuille : matière brute, à récolter ou à miner. */
  recipe?: Recipe;
  /** Technologie qui débloque la recette, quand il y en a une. */
  tech?: Tech;
  /** Travail total du nœud (`recipe.workAmount * crafts`). */
  workAmount: number;
  depth: number;
  children: CraftNode[];
};

/** Palworld contient des chaînes circulaires (minerai → lingot → …). Sans
 *  garde-fou d'ancêtres, la récursion ne rend jamais la main et fige l'onglet. */
const MAX_DEPTH = 8;

function build(
  itemId: string,
  need: number,
  depth: number,
  ancestors: ReadonlySet<string>
): CraftNode {
  const recipe = recipesByProduct.get(itemId)?.[0];

  // Feuille : pas de recette, ou cycle détecté, ou profondeur maximale.
  if (!recipe || ancestors.has(itemId) || depth >= MAX_DEPTH) {
    return { itemId, need, crafts: need, workAmount: 0, depth, children: [] };
  }

  const perCraft = recipe.count > 0 ? recipe.count : 1;
  const crafts = Math.ceil(need / perCraft);
  const nextAncestors = new Set(ancestors).add(itemId);

  return {
    itemId,
    need,
    crafts,
    recipe,
    tech: techUnlocking.get(recipe.id),
    workAmount: recipe.workAmount * crafts,
    depth,
    children: recipe.materials.map((mat) =>
      build(mat.id, mat.count * crafts, depth + 1, nextAncestors)
    ),
  };
}

/** Arbre de fabrication d'un objet, quantité comprise. */
export function buildTree(itemId: string, qty: number): CraftNode {
  return build(itemId, Math.max(1, Math.floor(qty)), 0, new Set());
}

/** Total des matières PREMIÈRES — les feuilles seules, agrégées par id.
 *  C'est le « total brut » du dessin 3a : ce qu'il faut réellement récolter. */
export function rawTotals(node: CraftNode): Map<string, number> {
  const totals = new Map<string, number>();
  const walk = (n: CraftNode) => {
    if (n.children.length === 0) {
      totals.set(n.itemId, (totals.get(n.itemId) ?? 0) + n.need);
      return;
    }
    n.children.forEach(walk);
  };
  walk(node);
  return totals;
}

/** Les objets qui ont une recette — c'est l'univers sélectionnable du Craft
 *  (1 408 des 2 344 objets). */
export function craftableIds(): string[] {
  return [...recipesByProduct.keys()];
}
