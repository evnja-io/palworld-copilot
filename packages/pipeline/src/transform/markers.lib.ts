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
  boss: [60, 80],
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
    return { ...mk, type: classifyBossSpawner(mk.meta?.palId) };
  }
  if (mk.type === "ft" || mk.type === "tower" || mk.type === "watchtower") {
    return { ...mk, type: classifyFt(mk.nameId) };
  }
  return mk;
}

/** Reclasse, dédoublonne les ids, trie. Idempotent : appliquer deux fois donne
 *  le même résultat, ce qui permet de réparer un fichier déjà commité. */
export function normalizeMarkers(markers: Marker[]): Marker[] {
  // Tri AVANT dédoublonnage : l'affectation des suffixes doit être
  // déterministe, sinon une régénération produit un diff pour rien.
  const sorted = [...markers]
    .map(reclassify)
    .sort((a, b) => a.id.localeCompare(b.id) || a.px - b.px || a.py - b.py);

  // `allIds` (figé avant renommage) empêche d'attribuer à un doublon un
  // suffixe qu'un id original plus loin dans le tri utilise déjà lui-même -
  // sans ça le renommage n'est pas déterministe selon l'ordre de rencontre.
  const allIds = new Set(sorted.map((mk) => mk.id));
  const used = new Set<string>();
  return sorted.map((mk) => {
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
