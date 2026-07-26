// Extraction pure des guildes, bases et affectations de travail depuis
// GroupSaveDataMap / BaseCampSaveData / CharacterContainerSaveData
// (Level.sav converti en JSON par palsav). Aucune I/O ni accès base, testable
// sur fixtures synthétiques (miroir de extract-pals-lib.ts). Chaîne
// d'affectation : camp -> module WorkerDirector.container_id -> slots du
// conteneur -> instance_id -> save_pals. Lectures défensives : chaque skip est
// compté dans les stats plutôt que de faire échouer l'extraction.
import { normalizeGuid, num, str, unwrap } from "./extract-pals-lib.ts";

export type SaveGuildRow = {
  guildId: string; // GUID UPPER sans tirets
  name: string | null; // guild_name (fallback group_name), vide -> null
  baseCampLevel: number;
  adminPlayerGuid: string | null; // GUID nul -> null
};

export type SaveGuildMemberRow = {
  guildId: string;
  playerGuid: string;
  playerName: string | null;
  // Ticks FDateTime bruts (~6.4e17 > 2^53) : string décimale, cast ::bigint côté SQL.
  lastOnlineTicks: string | null;
};

export type SaveBaseRow = {
  baseId: string;
  guildId: string; // group_id_belong_to (soft join save_guilds)
  name: string | null;
  worldX: number | null;
  worldY: number | null;
  worldZ: number | null;
  areaRange: number | null;
  // Longueur du tableau de slots du conteneur WorkerDirector (slots vides inclus).
  slotCount: number | null;
};

export type SaveAssignmentRow = { instanceId: string; baseId: string; slotIndex: number };

export type BaseExtractStats = {
  nonGuildGroups: number; // group_type != Guild (organisations, etc.)
  malformedGroups: number; // RawData non décodée / group_id absent
  malformedBases: number; // id / group_id_belong_to absents
  basesWithoutDirector: number; // ModuleMap sans container_id
  missingContainers: number; // container_id sans entrée CharacterContainerSaveData
  emptySlots: number; // instance_id GUID nul (slot libre)
  malformedSlots: number; // slot sans RawData.instance_id exploitable
  duplicateAssignments: number; // même instance_id vu deux fois (première occurrence gardée)
  duplicateMembers: number; // même (guilde, joueur) vu deux fois (première occurrence gardée)
};

// GUID nul : slot libre / admin absent.
const ZERO_GUID = "0".repeat(32);

/** Clé de map : string directe, { value } ou { ID: { value } } (conteneurs). */
function mapKeyGuid(key: unknown): string | null {
  const k = typeof key === "string" ? key : ((key as any)?.value ?? (key as any)?.ID?.value);
  return typeof k === "string" && k !== "" ? normalizeGuid(k) : null;
}

/** RawData.value exploitable : objet décodé par palsav. Deux formes non
 *  décodées à rejeter : tableau d'octets bruts, et ArrayProperty ByteProperty
 *  sérialisée en { values: [octets] } (forme réelle du fork quand une section
 *  n'est pas décodée, cf. rawdata/group.py qui lit value.values). Un RawData
 *  décodé ne porte jamais `values` comme unique clé. */
function decodedRaw(entry: unknown): Record<string, any> | null {
  const raw = (entry as any)?.value?.RawData?.value;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length === 1 && keys[0] === "values") return null;
  return raw;
}

/** Nom de base exploitable : les camps ne sont pas renommables en jeu et la
 *  save porte un gabarit interne (« 新規生成拠点テンプレート名11(仮) », validé
 *  sur import réel du 2026-07-26) ; traité comme absent. */
function cleanBaseName(name: string | null): string | null {
  return name !== null && /テンプレート名/.test(name) ? null : name;
}

/** GUID normalisé depuis un champ RawData (string éventuellement enveloppée). */
function guidField(v: unknown): string | null {
  const s = str(v);
  return s === null ? null : normalizeGuid(s);
}

/** groups = GroupSaveDataMap.value ; baseCamps = BaseCampSaveData.value ;
 *  charContainers = CharacterContainerSaveData.value. Guildes dédupliquées sur
 *  guildId, bases sur baseId, affectations sur instanceId (première occurrence
 *  conservée, comme extractPalInstances). */
export function extractBaseData(
  groups: unknown[],
  baseCamps: unknown[],
  charContainers: unknown[],
): {
  guilds: SaveGuildRow[];
  members: SaveGuildMemberRow[];
  bases: SaveBaseRow[];
  assignments: SaveAssignmentRow[];
  stats: BaseExtractStats;
} {
  const stats: BaseExtractStats = {
    nonGuildGroups: 0,
    malformedGroups: 0,
    malformedBases: 0,
    basesWithoutDirector: 0,
    missingContainers: 0,
    emptySlots: 0,
    malformedSlots: 0,
    duplicateAssignments: 0,
    duplicateMembers: 0,
  };
  const guilds: SaveGuildRow[] = [];
  const members: SaveGuildMemberRow[] = [];
  const bases: SaveBaseRow[] = [];
  const assignments: SaveAssignmentRow[] = [];

  // Guildes (GroupSaveDataMap) : seuls les groupes de type Guild nous
  // intéressent (les autres group_type : organisations, indépendants...).
  const seenGuilds = new Set<string>();
  for (const entry of groups as any[]) {
    const raw = decodedRaw(entry);

    // GroupType observé sous trois formes : string directe, { value } et
    // { value: { value } } - deux déballages couvrent tout. Fallback sur
    // raw.group_type quand l'enveloppe ne porte pas GroupType.
    const gtRaw = unwrap(unwrap(entry?.value?.GroupType));
    const gt = typeof gtRaw === "string" ? gtRaw : "";
    const rawGt = str(raw?.group_type) ?? "";
    if (!/guild/i.test(gt) && !/guild/i.test(rawGt)) {
      stats.nonGuildGroups++;
      continue;
    }

    const guildId = (raw === null ? null : guidField(raw.group_id)) ?? mapKeyGuid(entry?.key);
    if (raw === null || guildId === null) {
      stats.malformedGroups++;
      continue;
    }
    if (seenGuilds.has(guildId)) continue; // première occurrence conservée
    seenGuilds.add(guildId);

    const admin = guidField(raw.admin_player_uid);
    guilds.push({
      guildId,
      name: str(raw.guild_name ?? raw.group_name),
      baseCampLevel: num(raw.base_camp_level) ?? 1,
      adminPlayerGuid: admin === ZERO_GUID ? null : admin,
    });

    // Membres : player_uid requis et non nul (skip silencieux sinon : une
    // entrée sans uid n'est joignable à rien). Déduplication sur
    // (guilde, joueur) : players[] peut porter des doublons (anomalie de save
    // connue) et la PK de save_guild_members ferait échouer TOUTE la
    // transaction de sync sans ce garde-fou.
    const players = Array.isArray(raw.players) ? raw.players : [];
    const seenMembers = new Set<string>();
    for (const p of players) {
      const playerGuid = guidField(p?.player_uid);
      if (playerGuid === null || playerGuid === ZERO_GUID) continue;
      if (seenMembers.has(playerGuid)) {
        stats.duplicateMembers++;
        continue;
      }
      seenMembers.add(playerGuid);
      const lo = unwrap(p?.player_info?.last_online_real_time);
      members.push({
        guildId,
        playerGuid,
        playerName: str(p?.player_info?.player_name),
        lastOnlineTicks:
          typeof lo === "number" || typeof lo === "bigint" || typeof lo === "string"
            ? String(lo)
            : null,
      });
    }
  }

  // Pré-index des conteneurs de personnages : containerId normalisé -> slots.
  const containerSlots = new Map<string, any[]>();
  for (const entry of charContainers as any[]) {
    const id = mapKeyGuid(entry?.key);
    if (id === null) continue;
    const slots = entry?.value?.Slots?.value?.values;
    if (!containerSlots.has(id)) {
      containerSlots.set(id, Array.isArray(slots) ? slots : []);
    }
  }

  // Camps de base (BaseCampSaveData) + affectations via WorkerDirector.
  const seenBases = new Set<string>();
  const seenInstances = new Set<string>();
  for (const entry of baseCamps as any[]) {
    const raw = decodedRaw(entry);
    if (raw === null) {
      stats.malformedBases++;
      continue;
    }
    const baseId = guidField(raw.id) ?? mapKeyGuid(entry?.key);
    const guildId = guidField(raw.group_id_belong_to);
    if (baseId === null || guildId === null) {
      stats.malformedBases++;
      continue;
    }
    if (seenBases.has(baseId)) continue; // première occurrence conservée
    seenBases.add(baseId);

    const tr = raw.transform?.translation;
    const base: SaveBaseRow = {
      baseId,
      guildId,
      // Le jeu stocke un nom-gabarit interne (« 新規生成拠点テンプレート名11(仮) »,
      // observé sur save réelle) : traité comme absent, l'UI numérote les bases.
      name: cleanBaseName(str(raw.name)),
      worldX: num(tr?.x),
      worldY: num(tr?.y),
      worldZ: num(tr?.z),
      areaRange: num(raw.area_range),
      slotCount: null,
    };
    bases.push(base);

    // Module WorkerDirector : premier module dont la clé contient
    // "WorkerDirector" OU dont le RawData porte un container_id.
    // WorkerDirector : propriété DIRECTE du camp dans l'enveloppe réelle
    // (validé sur l'import du 2026-07-26 : les 11 bases tombaient en
    // basesWithoutDirector avec la seule hypothèse ModuleMap). Chemin réel :
    // entry.value.WorkerDirector.value.RawData.value.container_id (cf.
    // enregistrement du parseur .BaseCampSaveData.Value.WorkerDirector.RawData).
    // Le balayage de ModuleMap est conservé en repli défensif.
    let containerId: string | null = guidField(
      (entry as any)?.value?.WorkerDirector?.value?.RawData?.value?.container_id,
    );
    if (containerId === null) {
      const modules = entry?.value?.ModuleMap?.value;
      for (const mod of Array.isArray(modules) ? modules : []) {
        const keyRaw = unwrap(mod?.key);
        const key = typeof keyRaw === "string" ? keyRaw : "";
        const cid = guidField(mod?.value?.RawData?.value?.container_id);
        if (/workerdirector/i.test(key) || cid !== null) {
          containerId = cid;
          break;
        }
      }
    }
    if (containerId === null) {
      stats.basesWithoutDirector++; // base émise quand même, slotCount null
      continue;
    }

    const slots = containerSlots.get(containerId);
    if (slots === undefined) {
      stats.missingContainers++;
      continue;
    }
    // Capacité = longueur du tableau de slots, slots vides (GUID nul) inclus.
    base.slotCount = slots.length;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const instRaw = str(slot?.RawData?.value?.instance_id);
      if (instRaw === null) {
        stats.malformedSlots++;
        continue;
      }
      const instanceId = normalizeGuid(instRaw);
      if (instanceId === ZERO_GUID) {
        stats.emptySlots++;
        continue;
      }
      if (seenInstances.has(instanceId)) {
        stats.duplicateAssignments++; // un pal ne travaille qu'à une base
        continue;
      }
      seenInstances.add(instanceId);
      assignments.push({
        instanceId,
        baseId,
        slotIndex: num(slot?.SlotIndex?.value) ?? i,
      });
    }
  }

  return { guilds, members, bases, assignments, stats };
}
