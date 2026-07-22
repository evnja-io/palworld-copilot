import { l10nMap, writeGameData } from "../lib.js";

// Préfixes constatés sur les exports réels (2026-07-22, cf. docs/decisions.md).
// (table, préfixe L10N, namespace de sortie)
const NAME_SOURCES: Array<[RegExp, string, string]> = [
  [/DT_PalNameText/, "PAL_NAME_", "pal:"],
  [/DT_ItemNameText/, "ITEM_NAME_", "item:"],
  [/DT_SkillNameText/, "ACTION_SKILL_", "skill:"],
  [/DT_SkillNameText/, "PASSIVE_", "passive:"],
  [/DT_SkillNameText/, "PARTNERSKILL_", "partnerskill:"],
  [/DT_TechnologyNameText/, "NAME_", "tech:"],
  [/DT_MapObjectNameText/, "MAPOBJECT_NAME_", "building:"],
  [/DT_MapRespawnPointInfoText/, "", "ft:"],
];
const DESC_SOURCES: Array<[RegExp, string, string]> = [
  [/DT_ItemDescriptionText/, "ITEM_DESC_", "item:"],
  [/DT_PalLongDescriptionText/, "PAL_LONG_DESC_", "pal:"],
  [/DT_TechnologyDescText/, "DESC_", "tech:"],
];

for (const locale of ["en", "fr"] as const) {
  const names: Record<string, string> = {};
  const descs: Record<string, string> = {};
  for (const [table, l10nPrefix, ns] of NAME_SOURCES) {
    const hint = new RegExp(`/${locale}/.*${table.source}`);
    for (const [id, text] of Object.entries(l10nMap(hint, l10nPrefix))) names[ns + id] = text;
  }
  // Certaines entrées (technos surtout) sont des templates du jeu référençant
  // un item ou un objet de map : <itemName id=|X|/>, <mapObjectName id=|X|/>
  // (casse variable) -> nom localisé correspondant.
  for (const [key, text] of Object.entries(names)) {
    if (text.includes("<")) {
      names[key] = text
        .replace(/<itemName id=\|([^|]+)\|\/>/gi, (_, id) => names[`item:${id}`] ?? id)
        .replace(/<mapObjectName id=\|([^|]+)\|\/>/gi, (_, id) => names[`building:${id}`] ?? id);
    }
  }
  for (const [table, l10nPrefix, ns] of DESC_SOURCES) {
    const hint = new RegExp(`/${locale}/.*${table.source}`);
    try {
      for (const [id, text] of Object.entries(l10nMap(hint, l10nPrefix))) descs[ns + id] = text;
    } catch {
      console.warn(`  (description absente pour ${table} en ${locale} — toléré)`);
    }
  }
  // Les descriptions embarquent les mêmes templates que les noms.
  for (const [key, text] of Object.entries(descs)) {
    if (text.includes("<")) {
      descs[key] = text
        .replace(/<itemName id=\|([^|]+)\|\/>/gi, (_, id) => names[`item:${id}`] ?? id)
        .replace(/<mapObjectName id=\|([^|]+)\|\/>/gi, (_, id) => names[`building:${id}`] ?? id);
    }
  }
  if (Object.keys(names).length < 800) throw new Error(`Trop peu de noms ${locale}`);
  writeGameData(`l10n/names.${locale}.json`, names);
  writeGameData(`l10n/descriptions.${locale}.json`, descs);
}
console.log("l10n OK");
