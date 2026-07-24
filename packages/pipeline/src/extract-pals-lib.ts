// Extraction pure des instances de Pals depuis CharacterSaveParameterMap
// (Level.sav converti en JSON par palsav). Aucune I/O ni accès base - testable
// sur fixtures synthétiques (miroir de la direction import-lib du plan phase 3,
// docs/superpowers/plans/2026-07-23-multi-tenant-phase-3.md).

export type PalInstanceRow = {
  instanceId: string; // GUID UPPER sans tirets (PK avec server_id)
  ownerGuid: string; // GUID UPPER sans tirets - joint server_members.pal_player_guid
  palId: string; // id canonique pals.json
  gender: "male" | "female" | null;
  level: number;
  nickname: string | null;
  passives: string[];
  talentHp: number | null;
  talentShot: number | null;
  talentDefense: number | null;
};

export type ExtractStats = {
  players: number; // entrées joueur (IsPlayer) - extraites par extract-players.ts
  noOwner: number; // pals sauvages : OwnerPlayerUId absent ou GUID nul
  unknownSpecies: number; // CharacterID hors pals.json (GYM_/RAID_/PREDATOR_…)
  duplicates: number; // InstanceId déjà vu - première occurrence conservée
};

/** UUID "00afd495-0000-…" -> "00AFD495000000000000000000000000" (format des
 *  noms de fichiers Players/ et de save_snapshots.player_guid). */
export function normalizeGuid(uuid: string): string {
  return uuid.replaceAll("-", "").toUpperCase();
}

// GUID nul renvoyé par le jeu pour les pals sans propriétaire.
const ZERO_GUID = "0".repeat(32);

/** cmap = CharacterSaveParameterMap.value ; palIdsLower = lowercase -> id
 *  canonique pals.json. Lectures défensives : l'enveloppe des entrées pal
 *  n'est pas garantie (cf. plan, risque n°1) - tout champ inattendu est
 *  ignoré ou compté dans les stats plutôt que de faire échouer l'extraction. */
export function extractPalInstances(
  cmap: unknown[],
  palIdsLower: Map<string, string>,
): { rows: PalInstanceRow[]; stats: ExtractStats } {
  const stats: ExtractStats = { players: 0, noOwner: 0, unknownSpecies: 0, duplicates: 0 };
  const rows: PalInstanceRow[] = [];
  const seen = new Set<string>();

  for (const entry of cmap as any[]) {
    const sp = entry?.value?.RawData?.value?.object?.SaveParameter?.value;

    // Les joueurs partagent la même map - extraits ailleurs, on les saute.
    if (sp?.IsPlayer?.value) {
      stats.players++;
      continue;
    }

    // Propriétaire requis (proxy « équipe + palbox ») : les pals sauvages ont
    // un OwnerPlayerUId absent ou nul.
    const rawOwner = sp?.OwnerPlayerUId?.value;
    const ownerGuid = typeof rawOwner === "string" ? normalizeGuid(rawOwner) : "";
    if (ownerGuid === "" || ownerGuid === ZERO_GUID) {
      stats.noOwner++;
      continue;
    }

    // Espèce : casse variable dans la save ("Sheepball") ; les pals alpha ont
    // un préfixe BOSS_ ("BOSS_KingAlpaca_Ice") qu'on retente sans préfixe ;
    // GYM_/RAID_/PREDATOR_… n'existent pas dans pals.json -> skip compté.
    const rawSpecies = sp?.CharacterID?.value;
    const speciesLower = typeof rawSpecies === "string" ? rawSpecies.toLowerCase() : "";
    const palId =
      palIdsLower.get(speciesLower) ?? palIdsLower.get(speciesLower.replace(/^boss_/, ""));
    if (!palId) {
      stats.unknownSpecies++;
      continue;
    }

    // Identifiant d'instance : clé de la map - requis (PK), dédupliqué.
    const rawInstanceId = entry?.key?.InstanceId?.value;
    if (typeof rawInstanceId !== "string" || rawInstanceId === "") continue;
    const instanceId = normalizeGuid(rawInstanceId);
    if (seen.has(instanceId)) {
      stats.duplicates++;
      continue;
    }
    seen.add(instanceId);

    // Genre : deux formes d'enveloppe EnumProperty observées selon les
    // convertisseurs - valeur string directe ou objet { value } imbriqué.
    // /female/i d'abord : "Female" contient "male".
    const g = sp?.Gender?.value;
    const genderStr = typeof g === "string" ? g : g?.value;
    const gender: PalInstanceRow["gender"] =
      typeof genderStr === "string"
        ? /female/i.test(genderStr)
          ? "female"
          : /male/i.test(genderStr)
            ? "male"
            : null
        : null;

    // Passifs : ArrayProperty { values: string[] } - absente si aucun passif.
    const rawPassives = sp?.PassiveSkillList?.value?.values ?? [];
    const passives = (Array.isArray(rawPassives) ? rawPassives : []).filter(
      (p): p is string => typeof p === "string",
    );

    // Scalaires typés défensivement : une valeur inattendue (enveloppe
    // divergente) retombe sur le défaut plutôt que de casser le cast SQL
    // (int[]/text[]) de toute la transaction d'insertion.
    const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
    const str = (v: unknown): string | null =>
      typeof v === "string" && v !== "" ? v : null;

    rows.push({
      instanceId,
      ownerGuid,
      palId,
      gender,
      level: num(sp?.Level?.value) ?? 1,
      nickname: str(sp?.NickName?.value),
      passives,
      talentHp: num(sp?.Talent_HP?.value),
      talentShot: num(sp?.Talent_Shot?.value),
      talentDefense: num(sp?.Talent_Defense?.value),
    });
  }

  return { rows, stats };
}
