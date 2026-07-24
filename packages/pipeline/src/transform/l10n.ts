import {
  isL10nPlaceholder, l10nMap, loadDataTableRows, resolveEffectPlaceholders, stripRichTags, writeGameData,
} from "../lib.js";
import { passiveValuesById } from "./passive-effects.lib.js";

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
  [/DT_SkillDescText/, "ACTION_SKILL_", "skill:"],
  [/DT_SkillDescText/, "PASSIVE_", "passive:"],
];
const passiveValues = passiveValuesById(loadDataTableRows(/DT_PassiveSkill_Main/));

for (const locale of ["en", "fr"] as const) {
  const names: Record<string, string> = {};
  const descs: Record<string, string> = {};
  for (const [table, l10nPrefix, ns] of NAME_SOURCES) {
    const hint = new RegExp(`/${locale}/.*${table.source}`);
    for (const [id, text] of Object.entries(l10nMap(hint, l10nPrefix))) {
      if (isL10nPlaceholder(text)) continue;
      names[ns + id] = text;
    }
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
      for (const [id, text] of Object.entries(l10nMap(hint, l10nPrefix))) {
        if (isL10nPlaceholder(text)) continue;
        descs[ns + id] = text;
      }
    } catch {
      console.warn(`  (description absente pour ${table} en ${locale} - toléré)`);
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
  // Les variantes d'équipement par rareté (_2.._5) n'ont pas d'entrée L10N
  // propre : le jeu résout leur nom via OverrideName/OverrideDescription
  // (clé L10N de l'item de base). On matérialise cette résolution.
  for (const [id, row] of Object.entries(loadDataTableRows(/DT_ItemDataTable/)) as [string, any][]) {
    const ovName = row.OverrideName;
    if (ovName && ovName !== "None" && !names[`item:${id}`]) {
      const src = names[`item:${ovName.replace(/^ITEM_NAME_/, "")}`];
      if (src) names[`item:${id}`] = src;
    }
    const ovDesc = row.OverrideDescription;
    if (ovDesc && ovDesc !== "None" && !descs[`item:${id}`]) {
      const src = descs[`item:${ovDesc.replace(/^ITEM_DESC_/, "")}`];
      if (src) descs[`item:${id}`] = src;
    }
  }
  // La casse des clés de noms diverge parfois de l'id paramètre (PAL_NAME_Windchimes
  // vs WindChimes) : on recopie le nom sous la casse de DT_PalMonsterParameter.
  for (const dict of [names, descs]) {
    const byLower = new Map(Object.keys(dict).map((k) => [k.toLowerCase(), k]));
    for (const paramId of Object.keys(loadDataTableRows(/DT_PalMonsterParameter/))) {
      const key = `pal:${paramId}`;
      if (dict[key]) continue;
      const match = byLower.get(key.toLowerCase());
      if (match) dict[key] = dict[match];
    }
  }
  // Descriptions actives/passives : résolution des {EffectValueN} + nettoyage rich-text.
  // Scopé à skill:/passive: pour ne pas régresser item:/pal:/tech:.
  for (const key of Object.keys(descs)) {
    if (key.startsWith("passive:")) {
      const id = key.slice("passive:".length);
      const resolved = stripRichTags(resolveEffectPlaceholders(descs[key], passiveValues[id] ?? []));
      if (/\{EffectValue\d\}/.test(resolved)) {
        delete descs[key]; // valeur d'effet absente -> l'UI retombe sur le nom seul
      } else {
        descs[key] = resolved;
      }
    } else if (key.startsWith("skill:")) {
      descs[key] = stripRichTags(descs[key]);
    }
  }
  if (Object.keys(names).length < 800) throw new Error(`Trop peu de noms ${locale}`);
  writeGameData(`l10n/names.${locale}.json`, names);
  writeGameData(`l10n/descriptions.${locale}.json`, descs);
}
console.log("l10n OK");
