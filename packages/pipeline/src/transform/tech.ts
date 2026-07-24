import { enumName, loadDataTableRows, must, pick, writeGameData } from "../lib.js";

const rows = loadDataTableRows(/DT_TechnologyRecipeUnlock/);
const tech = Object.entries(rows)
  .map(([id, row]: [string, any]) => {
    const requireTech = pick<string>(row, "RequireTechnology");
    const descId = pick<string>(row, "Description");
    return {
      id,
      // Clé L10N portée par la ligne : "NAME_RECIPE_PALBOX" -> tech:RECIPE_PALBOX
      nameId: must(pick<string>(row, "Name"), `${id}.Name`).replace(/^NAME_/, ""),
      descId: descId && descId !== "None" ? descId.replace(/^DESC_/, "") : undefined,
      level: must(pick<number>(row, "LevelCap"), `${id}.LevelCap`),
      tier: pick<number>(row, "Tier") ?? 0,
      cost: pick<number>(row, "Cost") ?? 0,
      isBoss: Boolean(pick(row, "IsBossTechnology")),
      requireTech: requireTech && requireTech !== "None" ? requireTech : undefined,
      requireBoss: (() => {
        const b = enumName(pick(row, "RequireDefeatTowerBoss"));
        return b && b !== "None" ? b : undefined;
      })(),
      iconName: pick<string>(row, "IconName") || undefined,
      // Dédoublonné : le jeu liste parfois le même unlock deux fois
      // (ex. SF_TriangleFoundation), ce qui casserait les {#each} keyed.
      unlocks: [
        ...new Set(
          ([] as string[]).concat(
            pick<string[]>(row, "UnlockItemRecipes") ?? [],
            pick<string[]>(row, "UnlockBuildObjects") ?? [],
          ),
        ),
      ],
    };
  })
  // Tri stable par niveau uniquement : à niveau égal, l'ordre des lignes de la
  // DataTable est préservé - c'est l'ordre d'affichage des nœuds dans l'écran
  // Technologie du jeu.
  .sort((a, b) => a.level - b.level);
if (tech.length < 100) throw new Error(`Comptage tech suspect : ${tech.length}`);
writeGameData("tech.json", tech);
console.log(`tech OK (${tech.length})`);
