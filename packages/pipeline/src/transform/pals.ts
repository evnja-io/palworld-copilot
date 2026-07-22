import { enumName, loadDataTableRows, must, pick, writeGameData } from "../lib.js";

const params = loadDataTableRows(/DT_PalMonsterParameter/);
const dropRows = loadDataTableRows(/DT_PalDropItem/);
// Comparaison insensible à la casse : la table de noms diverge parfois du
// paramètre (PAL_NAME_Windchimes vs id WindChimes).
const nameKeys = new Set(
  Object.keys(loadDataTableRows(/\/en\/.*DT_PalNameText/)).map((k) =>
    k.replace(/^PAL_NAME_/, "").toLowerCase(),
  ),
);

// Drops indexés par CharacterID (lignes multiples par pal, champs ItemId1..10 / Rate / min / Max).
const dropsByPal: Record<string, any[]> = {};
for (const row of Object.values(dropRows) as any[]) {
  const cid = pick<string>(row, "CharacterID", "CharacterId");
  if (!cid) continue;
  (dropsByPal[cid] ??= []).push(row);
}

const WORK_TYPES = [
  "EmitFlame", "Watering", "Seeding", "GenerateElectricity", "Handcraft",
  "Collection", "Deforest", "Mining", "OilExtraction", "ProductMedicine",
  "Cool", "Transport", "MonsterFarm",
];

const pals = Object.entries(params)
  .filter(([id, row]: [string, any]) => {
    const zukan = pick<number>(row, "ZukanIndex") ?? -1;
    return zukan > 0 && nameKeys.has(id.toLowerCase()) && pick(row, "IsPal") !== false;
  })
  .map(([id, row]: [string, any]) => ({
    id,
    zukanIndex: must(pick<number>(row, "ZukanIndex"), `${id}.ZukanIndex`),
    zukanSuffix: pick<string>(row, "ZukanIndexSuffix") || undefined,
    elements: [
      enumName(pick(row, "ElementType1")),
      enumName(pick(row, "ElementType2")),
    ].filter((e) => e && e !== "None"),
    stats: {
      hp: must(pick<number>(row, "Hp", "HP"), `${id}.Hp`),
      melee: pick<number>(row, "MeleeAttack") ?? 0,
      shot: must(pick<number>(row, "ShotAttack"), `${id}.ShotAttack`),
      defense: must(pick<number>(row, "Defense"), `${id}.Defense`),
      support: pick<number>(row, "Support") ?? 0,
      craftSpeed: pick<number>(row, "CraftSpeed") ?? 0,
    },
    work: Object.fromEntries(
      WORK_TYPES.map((w) => [w, pick<number>(row, `WorkSuitability_${w}`) ?? 0]).filter(
        ([, v]) => (v as number) > 0,
      ),
    ),
    rarity: pick<number>(row, "Rarity") ?? 0,
    size: enumName(pick(row, "Size")),
    price: pick<number>(row, "Price") ?? 0,
    combiRank: must(pick<number>(row, "CombiRank"), `${id}.CombiRank`),
    combiPriority: pick<number>(row, "CombiDuplicatePriority") ?? 0,
    ignoreCombi: pick<boolean>(row, "IgnoreCombi") || undefined,
    partnerSkillNameId: (() => {
      const v = pick<string>(row, "OverridePartnerSkillNameTextID");
      return v && v !== "None" ? v : undefined;
    })(),
    maleProbability: pick<number>(row, "MaleProbability") ?? 50,
    nocturnal: pick<boolean>(row, "Nocturnal") || undefined,
    passives: [1, 2, 3, 4]
      .map((i) => pick<string>(row, `PassiveSkill${i}`))
      .filter((p) => p && p !== "None"),
    // Une table de loot par palier (ex. Anubis000/Anubis080) : tri par Level
    // croissant puis dédoublonnage par item — le palier de base gagne.
    drops: (() => {
      const seen = new Set<string>();
      const out = [];
      const rows = [...(dropsByPal[id] ?? [])].sort(
        (a, b) => (pick<number>(a, "Level") ?? 0) - (pick<number>(b, "Level") ?? 0),
      );
      for (const d of rows) {
        for (let i = 1; i <= 10; i++) {
          const itemId = pick<string>(d, `ItemId${i}`);
          if (!itemId || itemId === "None" || seen.has(itemId)) continue;
          seen.add(itemId);
          out.push({
            itemId,
            min: pick<number>(d, `min${i}`, `Min${i}`) ?? 1,
            max: pick<number>(d, `Max${i}`) ?? 1,
            rate: pick<number>(d, `Rate${i}`) ?? 100,
          });
        }
      }
      return out;
    })(),
  }))
  .sort(
    (a, b) =>
      a.zukanIndex - b.zukanIndex || (a.zukanSuffix ?? "").localeCompare(b.zukanSuffix ?? ""),
  );

if (pals.length < 150 || pals.length > 500) throw new Error(`Comptage pals suspect : ${pals.length}`);
writeGameData("pals.json", pals);

// Combos de breeding uniques (exceptions à la règle du CombiRank).
const uniques = Object.values(loadDataTableRows(/DT_PalCombiUnique/)).map((row: any) => ({
  parentA: enumName(must(pick(row, "ParentTribeA", "ParentA"), "combi.ParentA")),
  parentB: enumName(must(pick(row, "ParentTribeB", "ParentB"), "combi.ParentB")),
  child: enumName(must(pick(row, "ChildCharacterID", "Child"), "combi.Child")),
}));
writeGameData("breeding.json", { uniqueCombos: uniques });
console.log(`pals OK (${pals.length} pals, ${uniques.length} combos uniques)`);
