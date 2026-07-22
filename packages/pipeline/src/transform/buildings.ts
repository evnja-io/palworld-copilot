import { enumName, loadDataTableRows, pick, writeGameData } from "../lib.js";

const rows = loadDataTableRows(/DT_BuildObjectDataTable/);
const buildings = Object.entries(rows)
  .map(([id, row]: [string, any]) => {
    const materials = [];
    for (let i = 1; i <= 5; i++) {
      const mid = pick<string>(row, `Material${i}_Id`);
      const count = pick<number>(row, `Material${i}_Count`) ?? 0;
      if (mid && mid !== "None" && count > 0) materials.push({ id: mid, count });
    }
    return {
      id,
      // Jointure L10N : MAPOBJECT_NAME_<MapObjectId> -> building:<mapObjectId>
      mapObjectId: pick<string>(row, "MapObjectId") ?? id,
      category: enumName(pick(row, "TypeUIDisplay", "TypeA")),
      typeB: enumName(pick(row, "TypeB")),
      rank: pick<number>(row, "Rank") ?? 0,
      workAmount: pick<number>(row, "RequiredBuildWorkAmount") ?? 0,
      energyType: (() => {
        const e = enumName(pick(row, "RequiredEnergyType"));
        return e && e !== "None" ? e : undefined;
      })(),
      materials,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
if (buildings.length < 100) throw new Error(`Comptage constructions suspect : ${buildings.length}`);
writeGameData("buildings.json", buildings);
console.log(`buildings OK (${buildings.length})`);
