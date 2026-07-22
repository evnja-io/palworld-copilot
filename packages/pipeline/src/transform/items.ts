import { enumName, loadDataTableRows, must, pick, writeGameData } from "../lib.js";

const itemRows = loadDataTableRows(/DT_ItemDataTable/);
// Filtre encyclopédie : un item sans nom localisé est inaffichable (items de
// test/internes). Même critère que pals.ts.
const namedIds = new Set(
  Object.keys(loadDataTableRows(/\/en\/.*DT_ItemNameText/)).map((k) => k.replace(/^ITEM_NAME_/, "")),
);
const items = Object.entries(itemRows)
  .filter(([id]) => namedIds.has(id))
  .map(([id, row]: [string, any]) => ({
    id,
    typeA: enumName(pick(row, "TypeA")),
    typeB: enumName(pick(row, "TypeB")),
    rarity: pick<number>(row, "Rarity") ?? 0,
    price: pick<number>(row, "Price") ?? 0,
    maxStack: pick<number>(row, "MaxStackCount") ?? 1,
    weight: pick<number>(row, "Weight") ?? 0,
    sortId: pick<number>(row, "SortId", "SortID") ?? 0,
    iconName: pick<string>(row, "IconName") || undefined,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));
if (items.length < 400) throw new Error(`Comptage items suspect : ${items.length}`);
writeGameData("items.json", items);

const itemIds = new Set(items.map((i) => i.id));
const recipeRows = loadDataTableRows(/DT_ItemRecipeDataTable/);
let orphans = 0;
const recipes = Object.entries(recipeRows)
  .map(([id, row]: [string, any]) => {
    const materials = [];
    for (let i = 1; i <= 5; i++) {
      const mid = pick<string>(row, `Material${i}_Id`);
      const count = pick<number>(row, `Material${i}_Count`) ?? 0;
      if (mid && mid !== "None" && count > 0) {
        materials.push({ id: mid, count });
        if (!itemIds.has(mid)) orphans++;
      }
    }
    return {
      id,
      productId: must(pick<string>(row, "Product_Id"), `${id}.Product_Id`),
      count: pick<number>(row, "Product_Count") ?? 1,
      workAmount: pick<number>(row, "WorkAmount") ?? 0,
      materials,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
if (recipes.length < 200) throw new Error(`Comptage recettes suspect : ${recipes.length}`);
if (orphans > recipes.length * 0.02) throw new Error(`${orphans} matériaux orphelins (réfs vers items inconnus)`);
writeGameData("recipes.json", recipes);
console.log(`items OK (${items.length} items, ${recipes.length} recettes, ${orphans} orphelins tolérés)`);
