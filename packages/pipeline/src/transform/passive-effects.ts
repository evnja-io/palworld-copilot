import { l10nMap, loadDataTableRows, writeGameData } from "../lib.js";
import { parsePassiveRow, type PassiveEffect } from "./passive-effects.lib.js";

const rows = loadDataTableRows(/DT_PassiveSkill_Main/);
// On ne garde que les passifs "réels" (dotés d'un nom localisé) : écarte TestSkill* et internes.
const named = new Set(Object.keys(l10nMap(/\/en\/.*DT_SkillNameText/, "PASSIVE_")));

const out: Record<string, { rank: number; effects: PassiveEffect[] }> = {};
for (const [id, row] of Object.entries(rows)) {
  if (!named.has(id)) continue;
  const { rank, effects } = parsePassiveRow(row as Record<string, any>);
  if (effects.length === 0) continue;
  out[id] = { rank, effects };
}

writeGameData("passive-effects.json", out);
console.log(`passive-effects OK (${Object.keys(out).length} passifs)`);
