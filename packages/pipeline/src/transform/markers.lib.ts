// Normalisation des marqueurs : classification en catégories et unicité des ids.
// Module pur (testable sans DataTables), partagé par transform/markers.ts et
// par le script normalize-markers.ts.

export type MarkerType = "relic" | "alpha" | "boss" | "tower" | "watchtower" | "ft";

export type Marker = {
  id: string;
  type: MarkerType;
  px: number;
  py: number;
  nameId?: string;
  meta?: { palId?: string; level?: number };
};

/** Entrées des arènes de tours de boss, par `nameId` de point de voyage rapide.
 *  Ids stables : les noms sont localisés, une regex dessus casserait en EN. */
export const TOWER_FT_IDS: ReadonlySet<string> = new Set([
  "FTPoint45", // Syndicat de Rayne
  "Boss_Forest", // Ligue pour la Protection des Pals
  "FTPoint3", // Confrérie des Flammes Éternelles
  "FTPoint20", // Unité de Recherche Génétique
  "FTPoint67", // Clan des Fleurs Lunaires
  "FTPoint9", // Milice Populaire
  "FTPoint76", // Paradis Déchu
  "SkyIsland_BOSS", // Alliance Azurée
]);

/** Volumétrie attendue par catégorie. Bornes larges sur alpha/boss : une mise à
 *  jour du jeu peut en ajouter, un écart franc signale une régression. */
const EXPECTED: Record<MarkerType, [min: number, max: number]> = {
  relic: [120, 200],
  alpha: [75, 95],
  boss: [30, 45],
  tower: [8, 8],
  watchtower: [20, 24],
  ft: [110, 140],
};

export function classifyFt(nameId: string | undefined): MarkerType {
  if (!nameId) return "ft";
  if (TOWER_FT_IDS.has(nameId)) return "tower";
  if (nameId.startsWith("WatchTower_")) return "watchtower";
  return "ft";
}

/** `DT_BossSpawnerLoactionData` mélange boss de Pals et boss humains : ces
 *  derniers n'ont pas de CharacterID exploitable (`None`). */
export function classifyBossSpawner(palId: string | undefined): "alpha" | "boss" {
  return palId && palId !== "None" ? "alpha" : "boss";
}

function reclassify(mk: Marker): Marker {
  if (mk.type === "alpha" || mk.type === "boss") {
    const type = classifyBossSpawner(mk.meta?.palId);
    // « None » est un sentinelle de DataTable, pas un id de Pal : le laisser
    // fuiter donnerait un nom « None » et un lien /paldex/None en 404 côté web.
    if (type === "boss" && mk.meta?.palId) {
      const { palId: _drop, ...meta } = mk.meta;
      return { ...mk, type, meta };
    }
    return { ...mk, type };
  }
  if (mk.type === "ft" || mk.type === "tower" || mk.type === "watchtower") {
    return { ...mk, type: classifyFt(mk.nameId) };
  }
  return mk;
}

/** Clé d'égalité stricte d'un marqueur, méta comprise (ordre des clés
 *  neutralisé). Deux marqueurs qui partagent cette clé sont la même entité
 *  répétée dans la DataTable source, pas deux emplacements distincts. */
function exactKey(mk: Marker): string {
  const meta = mk.meta
    ? Object.entries(mk.meta)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
    : [];
  return JSON.stringify([mk.type, mk.px, mk.py, meta]);
}

/** Reclasse, dédoublonne les entrées identiques, rend les ids uniques, trie.
 *  Idempotent : appliquer deux fois donne le même résultat, ce qui permet de
 *  réparer un fichier déjà commité. */
export function normalizeMarkers(markers: Marker[]): Marker[] {
  // Tri AVANT dédoublonnage : le choix du survivant et l'affectation des
  // suffixes doivent être déterministes, sinon une régénération produit un
  // diff pour rien.
  const sorted = [...markers]
    .map(reclassify)
    .sort((a, b) => a.id.localeCompare(b.id) || a.px - b.px || a.py - b.py);

  // Deux entrées identiques en (type, position, méta) sont un doublon exact
  // de la DataTable source - ex. `DT_BossSpawnerLoactionData` contient
  // chaque boss PNJ deux fois, même SpawnerID, même position, même niveau.
  // On n'en garde qu'une, sans lui attribuer de suffixe : ce n'est pas une
  // collision d'id entre deux entités différentes.
  const seenExact = new Set<string>();
  const deduped = sorted.filter((mk) => {
    const key = exactKey(mk);
    if (seenExact.has(key)) return false;
    seenExact.add(key);
    return true;
  });

  // Un même id à deux positions différentes reste une vraie collision : le
  // mécanisme de suffixe est conservé pour ce cas, qui n'existe pas
  // aujourd'hui dans les données mais garantirait l'unicité si le jeu en
  // introduisait un jour.
  // `allIds` (figé avant renommage) empêche d'attribuer à un doublon un
  // suffixe qu'un id original plus loin dans le tri utilise déjà lui-même -
  // sans ça le renommage n'est pas déterministe selon l'ordre de rencontre.
  const allIds = new Set(deduped.map((mk) => mk.id));
  const used = new Set<string>();
  return deduped.map((mk) => {
    if (!used.has(mk.id)) {
      used.add(mk.id);
      return mk;
    }
    let n = 2;
    while (allIds.has(`${mk.id}_${n}`) || used.has(`${mk.id}_${n}`)) n++;
    const id = `${mk.id}_${n}`;
    used.add(id);
    return { ...mk, id };
  });
}

/** Lève si un id est dupliqué ou si une catégorie sort de ses bornes. */
export function assertMarkerCounts(markers: Marker[]): Record<MarkerType, number> {
  const seen = new Set<string>();
  for (const mk of markers) {
    if (seen.has(mk.id)) throw new Error(`id dupliqué : ${mk.id}`);
    seen.add(mk.id);
  }
  const counts = Object.fromEntries(
    (Object.keys(EXPECTED) as MarkerType[]).map((t) => [t, markers.filter((m) => m.type === t).length]),
  ) as Record<MarkerType, number>;
  for (const [type, [min, max]] of Object.entries(EXPECTED) as Array<[MarkerType, [number, number]]>) {
    const n = counts[type];
    if (n < min || n > max) throw new Error(`${type} suspect : ${n} (attendu ${min}–${max})`);
  }
  return counts;
}
