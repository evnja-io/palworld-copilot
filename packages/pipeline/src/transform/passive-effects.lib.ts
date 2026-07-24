import { enumName } from "../lib.js";

export type PassiveEffect = { type: string; value: number; target: string };
export type ParsedPassive = { rank: number; effects: PassiveEffect[]; values: number[] };

const SLOTS = [1, 2, 3, 4] as const;

/** Déballe une row PalPassiveSkillDatabaseRow en effets structurés + valeurs positionnelles. */
export function parsePassiveRow(row: Record<string, any>): ParsedPassive {
  const values = SLOTS.map((i) => Number(row[`EffectValue${i}`] ?? 0));
  const effects: PassiveEffect[] = [];
  for (const i of SLOTS) {
    const type = enumName(row[`EffectType${i}`]);
    if (!type || type === "no") continue;
    effects.push({
      type,
      value: Number(row[`EffectValue${i}`] ?? 0),
      target: enumName(row[`TargetType${i}`]) ?? "ToSelf",
    });
  }
  return { rank: Number(row.Rank ?? 0), effects, values };
}

/** Map id -> [EffectValue1..4] pour résoudre les placeholders des descriptions. */
export function passiveValuesById(rows: Record<string, any>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, row] of Object.entries(rows)) out[id] = parsePassiveRow(row).values;
  return out;
}
