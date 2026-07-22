import recipesJson from "@palworld-companion/game-data/recipes.json";
import palsJson from "@palworld-companion/game-data/pals.json";
import techJson from "@palworld-companion/game-data/tech.json";
import buildingsJson from "@palworld-companion/game-data/buildings.json";

export type Recipe = {
  id: string;
  productId: string;
  count: number;
  workAmount: number;
  materials: Array<{ id: string; count: number }>;
};
export type Tech = {
  id: string;
  nameId: string;
  level: number;
  cost: number;
  isBoss: boolean;
  requireBoss?: string;
  unlocks: string[];
};
export type Building = {
  id: string;
  mapObjectId: string;
  category?: string;
  rank: number;
  workAmount: number;
  energyType?: string;
  materials: Array<{ id: string; count: number }>;
};

export const recipes = recipesJson as Recipe[];
export const tech = techJson as Tech[];
export const buildings = buildingsJson as Building[];

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export const recipesByProduct = new Map<string, Recipe[]>();
export const recipesUsingItem = new Map<string, Recipe[]>();
for (const r of recipes) {
  push(recipesByProduct, r.productId, r);
  for (const mat of r.materials) push(recipesUsingItem, mat.id, r);
}

export const palsDropping = new Map<string, string[]>();
for (const p of palsJson as Array<{ id: string; drops: Array<{ itemId: string }> }>) {
  for (const d of p.drops) push(palsDropping, d.itemId, p.id);
}

/** Techno débloquant une recette ou une construction (clé = id débloqué). */
export const techUnlocking = new Map<string, Tech>();
for (const t of tech) for (const u of t.unlocks) techUnlocking.set(u, t);

export const buildingByMapObjectId = new Map(buildings.map((b) => [b.mapObjectId, b]));
