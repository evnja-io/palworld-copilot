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
  descId?: string;
  level: number;
  cost: number;
  isBoss: boolean;
  requireBoss?: string;
  requireTech?: string;
  iconName?: string;
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

export type PalDrop = { palId: string; min: number; max: number; rate: number };

export const palsDropping = new Map<string, PalDrop[]>();
for (const p of palsJson as Array<{
  id: string;
  drops: Array<{ itemId: string; min: number; max: number; rate: number }>;
}>) {
  for (const d of p.drops)
    push(palsDropping, d.itemId, { palId: p.id, min: d.min, max: d.max, rate: d.rate });
}

/** Techno débloquant une recette ou une construction (clé = id débloqué). */
export const techUnlocking = new Map<string, Tech>();
for (const t of tech) for (const u of t.unlocks) techUnlocking.set(u, t);

export const buildingByMapObjectId = new Map(buildings.map((b) => [b.mapObjectId, b]));
