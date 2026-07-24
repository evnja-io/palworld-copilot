import { enumName, loadDataTableRows, pick, writeGameData } from "../lib.js";

let skills: Record<string, any> = {};
let moveRows: Record<string, any> = {};
try {
  skills = loadDataTableRows(/DT_WazaDataTable(_Common)?\.json$/);
  moveRows = loadDataTableRows(/DT_WazaMasterLevel(_Common)?\.json$/);
} catch {
  console.warn("  Waza indisponible (repli assumé, cf. decisions.md) - skills.json vide");
}

// Lignes indexées NewRow_x : l'ID réel du skill est WazaType (EPalWazaID::<id>).
const out: Record<string, { element?: string; power?: number; ct?: number }> = {};
for (const row of Object.values(skills) as any[]) {
  const id = enumName(pick(row, "WazaType"));
  if (!id || id === "None") continue;
  out[id] = {
    element: enumName(pick(row, "Element", "ElementType")),
    power: pick<number>(row, "Power"),
    ct: pick<number>(row, "CoolTime", "CT"),
  };
}
writeGameData("skills.json", out);

// Moves par pal - fichier séparé pour éviter une dépendance d'ordre avec pals.ts.
const movesByPal: Record<string, Array<{ skillId: string; level: number }>> = {};
for (const row of Object.values(moveRows) as any[]) {
  const pal = pick<string>(row, "PalId", "PalID", "CharacterID");
  const skillId = enumName(pick(row, "WazaID", "SkillID"));
  const level = pick<number>(row, "Level") ?? 1;
  if (!pal || !skillId || skillId === "None") continue;
  (movesByPal[pal] ??= []).push({ skillId, level });
}
for (const list of Object.values(movesByPal)) list.sort((a, b) => a.level - b.level);
writeGameData("pal-moves.json", movesByPal);
console.log(
  `skills OK (${Object.keys(out).length} skills, ${Object.keys(movesByPal).length} pals avec moves)`,
);
