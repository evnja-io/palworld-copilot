import { loadDataTableRows } from "./lib.js";

console.log("== Table des Pals ==");
const pals = loadDataTableRows(/monsterparameter/i);
const ids = Object.keys(pals);
console.log(`  lignes : ${ids.length} (inclut variantes BOSS_/RAID_/etc.)`);

console.log("== L10N noms de Pals ==");
const namesEn = loadDataTableRows(/\/en\/.*palnametext/i);
const namesFr = loadDataTableRows(/\/fr\/.*palnametext/i);

// Règle de jointure constatée : DT_PalNameText a pour clés PAL_NAME_<CodeName>,
// texte dans TextData.LocalizedString. Les variantes (RAID_, SUMMON_, GYM_…)
// n'ont pas d'entrée propre — seuls les Pals « de base » sont nommés.
const text = (row: any): string | undefined => row?.TextData?.LocalizedString;
const named = ids.filter((id) => text(namesEn[`PAL_NAME_${id}`]));
console.log(`  Pals avec nom EN : ${named.length} / ${ids.length}`);

let joined = 0;
for (const id of named.slice(0, 5)) {
  const en = text(namesEn[`PAL_NAME_${id}`]);
  const fr = text(namesFr[`PAL_NAME_${id}`]);
  console.log(`  ${id}: EN=${en ?? "??"} | FR=${fr ?? "??"}`);
  if (en && fr) joined++;
}

if (ids.length < 150) throw new Error(`Trop peu de Pals (${ids.length}) — mauvaise table ?`);
if (named.length < 150) throw new Error(`Trop peu de Pals nommés (${named.length})`);
if (joined < 5) throw new Error(`Jointure FR incomplète (${joined}/5)`);
console.log("SPIKE OK — pals + L10N FR/EN joignables");
