# Barre latérale de la carte — filtres unifiés et liste de résultats

Date : 2026-07-26
Statut : validé (exploration design menée dans un lab temporaire, variante F retenue)

## Problème

La carte affiche 447 marqueurs derrière trois cases à cocher
(`FilterPanel.svelte`) et un panneau de zones de spawn (`SpawnPanel.svelte`).
Trois limites :

1. **Catégories manquantes.** Les tours et les boss humains n'existent pas comme
   catégories, alors que les données les distinguent déjà (voir « Découvertes »).
2. **Rien pour trouver.** Aucune liste : « quels alphas de niveau 40+ me
   reste-t-il ? » se répond à l'œil, en balayant la carte.
3. **Rien à suivre hors effigies.** Seules les effigies sont cochables ; les
   alphas, boss et tours vaincus ne laissent aucune trace.

## Découvertes sur les données (préalables au design)

### Les tours sont déjà là

Les arènes des boss de tour sont des points de voyage rapide. Huit entrées,
identifiées par `nameId` (ids stables, pas de regex sur des noms localisés) :

| `nameId` | Tour |
| --- | --- |
| `FTPoint45` | Syndicat de Rayne |
| `Boss_Forest` | Ligue pour la Protection des Pals |
| `FTPoint3` | Confrérie des Flammes Éternelles |
| `FTPoint20` | Unité de Recherche Génétique |
| `FTPoint67` | Clan des Fleurs Lunaires |
| `FTPoint9` | Milice Populaire |
| `FTPoint76` | Paradis Déchu |
| `SkyIsland_BOSS` | Alliance Azurée |

S'y ajoutent 20 tours d'observation (`WatchTower_*`), catégorie distincte : elles
dévoilent le brouillard de carte, ce n'est pas un combat de boss. Aucune
extraction nouvelle n'est nécessaire — seulement une classification.

### « alpha » mélange deux choses

Sur les 152 marqueurs `alpha` de `DT_BossSpawnerLoactionData`, **83 portent un
`palId` réel** et **69 ont `palId: "None"`** : ce sont des spawners de boss
humains (`BOSS_Believer_CrossBow`, `BOSS_DarkTrader`, `BOSS_Female_Soldier`…).
Deux catégories, pas une.

### 33 ids dupliqués — bug bloquant

`transform/markers.ts` dérive l'id du `SpawnerID`, or 33 spawners PNJ occupent
deux emplacements avec le même `SpawnerID`. Conséquences :

- `MarkerController` indexe par id (`#byId`) : **33 marqueurs ne sont jamais
  affichés** aujourd'hui.
- Tout `{#each}` keyé sur ces ids lève `each_key_duplicate`. Constaté
  concrètement : dans le lab, deux variantes rendaient une colonne vide avant
  correction. **La liste de résultats est donc impossible tant que ce bug
  existe.**

Aucune migration de données à prévoir : les ids modifiés sont tous des boss PNJ,
jamais cochés, donc absents de la table `progress` (seuls des ids `relic_*` y
figurent).

### Les ressources restent hors périmètre

Minerai, charbon, soufre, quartz : acteurs spawners répartis dans ~10 000
cellules World Partition, aucun dataset communautaire — déjà reporté dans
`docs/decisions.md` (2026-07-21, « Coffres sur la carte »). La catégorie existe
dans l'interface, grisée et libellée « bientôt », pour prouver que le modèle
accueille une septième catégorie sans retoucher la mise en page.

## Modèle de catégories

Sept catégories réelles, une future :

| clé | libellé | volume | cochable | affinage |
| --- | --- | --- | --- | --- |
| `relic` | Effigies de Lifmunk | 138 | oui | — |
| `alpha` | Alpha (Pal) | 83 | oui | niveau, élément |
| `boss` | Boss humains | 69 | oui | niveau |
| `tower` | Tours de boss | 8 | oui | — |
| `watchtower` | Tours d'observation | 20 | oui | — |
| `ft` | Voyage rapide | 129 | oui | — |
| `spawn` | Zones de spawn d'un Pal | 249 Pals | non | jour / nuit |
| `resource` | Ressources | 0 | — | grisée, « bientôt » |

`relic + alpha + boss + tower + watchtower + ft = 447`, soit exactement le
contenu actuel de `markers.json` : la classification redistribue, elle n'invente
rien.

## Interface retenue (variante F)

Visuel « HUD de jeu » posé sur une disposition à rail. Deux colonnes :

```
┌────┬──────────────────────────────┐
│ ✦  │ ◕ 13%  ALPHA            ⧉    │   en-tête : anneau de progression
│138 │ 11 / 83        ☑ Carte       │   de la catégorie sélectionnée
│ 🐾 │ 20 trouvés par le groupe     │
│ 83 ├──────────────────────────────┤
│ ☠  │ [ Chercher dans alpha…    ]  │   recherche
│ 69 ├──────────────────────────────┤
│ ⌂  │ Niveau 1+  ──●──────────     │   affinage (alpha / boss seulement)
│  8 │ ● ● ● ● ● ● ● ● ●            │
│ ⌖  ├──────────────────────────────┤
│ 20 │ 83 CIBLES   ☐ masquer faits  │
│ ◆  ├──────────────────────────────┤
│129 │ 🐾 Chillet      Glace    11  │   liste : portrait, nom, méta,
│ ◈  │ 🐾 Neptilius    Eau      60  │   badge de niveau, case à cocher
│  — │ 🐾 Vaelet       Plante   27  │
│    │ …                            │
│ 🐾 │                              │
└────┴──────────────────────────────┘
  rail          panneau
```

Le rail sort les catégories de la colonne défilante : la liste occupe toute la
hauteur restante (≈ 10 lignes visibles au repos, contre ≈ 2 quand les catégories
étaient empilées au-dessus).

### Sélection et visibilité sont deux choses distinctes

- **Sélection** (clic sur une tuile du rail) : catégorie au premier plan — son
  anneau, ses contrôles d'affinage, sa liste.
- **Visibilité** (case « Carte » de l'en-tête) : ses marqueurs sont dessinés ou
  non. Une catégorie masquée porte une barre oblique sur sa tuile de rail.

On peut donc parcourir la liste d'une catégorie sans en afficher les épingles, et
inversement garder des épingles affichées tout en travaillant sur une autre
catégorie.

### Comportements

- **Ligne cliquée** → la carte centre le marqueur (`setView`, zoom 4) et ouvre sa
  popup. Même chemin que `?focus=` aujourd'hui.
- **Case d'une ligne** → bascule le suivi, optimiste, propagé au groupe
  (`ProgressStore.toggle`).
- **Anneau** → complétion de la catégorie sélectionnée, teinté de sa couleur ;
  sous-titre « n trouvés par le groupe » (masqué en mode invité, où il n'y a pas
  de groupe).
- **Recherche** → filtre la liste de la catégorie sélectionnée par nom localisé.
- **Affinage** → niveau minimum et élément, uniquement pour `alpha` et `boss`
  (les seules catégories portant ces données).
- **« Masquer les faits »** → retire les entrées suivies, par catégorie.
- **Tuile de spawn** (bas du rail) → l'en-tête devient le portrait du Pal, avec
  segment Jour / Nuit et nombre de zones ; la recherche sert alors à changer de
  Pal.
- **⧉ Copier le lien** → sérialise l'état de filtres dans l'URL.

### États

| état | rendu |
| --- | --- |
| liste vide après filtrage | « Rien ne correspond à ces filtres. » |
| catégorie future (`resource`) | tuile grisée, désactivée, « bientôt » |
| catégorie masquée | barre oblique sur la tuile |
| entrée suivie | ligne désaturée (`grayscale`), opacité réduite |
| invité | pas de ligne « groupe », pas d'avatars |
| zones de spawn en chargement | segment inchangé, cercles dessinés à l'arrivée du fetch |

### Mobile — feuille glissante

Sous ~900 px, la barre devient une feuille ancrée en bas, trois positions :
poignée seule (compteurs), moitié, plein écran. Dans la feuille, le rail passe à
l'horizontale (bande défilante en haut) et l'en-tête se replie sur une ligne :
un rail vertical y consommerait la largeur utile et laisserait deux lignes de
résultats. Cibles tactiles 44 px minimum.

## Architecture

### Découpage des composants

`FilterPanel.svelte` et `SpawnPanel.svelte` disparaissent, remplacés par des
unités à responsabilité unique dans `lib/map/sidebar/` :

| fichier | rôle | dépend de |
| --- | --- | --- |
| `MapSidebar.svelte` | ossature : rail + panneau, feuille sur mobile | les composants ci-dessous |
| `CategoryRail.svelte` | tuiles de catégories, sélection, état masqué | `categories`, props |
| `CategoryHeader.svelte` | anneau, compteurs, « Carte », copier le lien | props seulement |
| `RefineControls.svelte` | niveau + éléments | props seulement |
| `ResultList.svelte` | lignes, clic, coche | props + événements |
| `SpawnPicker.svelte` | choix du Pal, jour / nuit | `spawnCounts` |
| `categories.ts` | registre des catégories (clé, libellé, couleur, glyphe, cochable, affinable, future) | `markers.json` |
| `query.ts` | `Query` + `runQuery` — filtrage pur, testable sans DOM | `categories.ts` |

`query.ts` et `categories.ts` sont du TypeScript pur : ce sont eux qui portent les
tests unitaires. Les composants restent fins et sans logique de filtrage.

### Flux de données

Inchangé dans son principe : **Leaflet possède le DOM, Svelte possède l'état.**

```
markers.json ──► categories.ts ──► MapSidebar (état) ──► runQuery()
                                          │                  │
                                          │                  ├──► ResultList (lignes)
                                          │                  │
                                          └──────────────────┴──► MarkerController.sync()
```

`MarkerController` conserve son diff impératif — jamais un composant Svelte par
marqueur. `ResultList` rend au maximum les lignes d'une seule catégorie (138 au
pire), sans virtualisation.

### État et persistance

`MapState` passe en `map-filters-v3` (le v2 ne connaît ni les nouvelles
catégories ni la sélection ; un état v2 restauré tel quel les laisserait
absentes) :

```ts
type MapFilters = {
  /** Catégorie au premier plan dans le panneau. */
  selected: CatKey;
  /** Catégories dessinées sur la carte. */
  visible: CatKey[];
  levelMin: number;
  element: string;
  hideTracked: boolean;
  search: string;
  spawnPal: string | null;
  spawnPhase: SpawnPhase;
};
```

- **localStorage** : source normale, comme aujourd'hui.
- **URL** : `⧉ Copier le lien` sérialise l'état en querystring. À l'ouverture,
  une URL porteuse de filtres l'emporte, puis les modifications repartent dans
  localStorage — pas d'entrée d'historique par case cochée.
- `?pal=` et `?focus=` continuent de fonctionner à l'identique, y compris leur
  effet de bord actuel (ouvrir la catégorie du marqueur ciblé, désactiver
  « masquer les faits » si le marqueur est déjà suivi).

### Suivi de progression

Le `kind` existant `marker` est **élargi**, pas dupliqué : `REGISTRY.marker`
passe de « ids `relic_*` » à « tous les ids de `markers.json` ».

Conséquences voulues :

- aucune migration, aucun changement de schéma ;
- les lignes `relic_*` déjà en base restent valides ;
- les deux fusions d'import (`packages/pipeline/src/import-lib.ts` et
  `apps/web/src/lib/server/import.ts`) restent inchangées ;
- un seul `ProgressStore`, un seul aller-retour d'API ; les compteurs par
  catégorie se dérivent côté client.

Le garde-fou d'ids valides du mode invité (`RELIC_IDS` dans la page carte) suit
le même élargissement.

L'auto-remplissage depuis les saves (`FastTravelPointUnlockFlag`,
`NormalBossDefeatFlag`, `TowerBossDefeatFlag`) reste **hors périmètre** : le
format de clé des drapeaux de boss n'est pas vérifié, et l'attendre bloquerait la
barre latérale. Le suivi manuel couvre déjà les mondes locaux et les invités.

### Pipeline

`transform/markers.ts` :

1. **Dédoublonner les ids.** Suffixer les occurrences suivantes d'un même
   `SpawnerID` (`alpha_BOSS_X`, `alpha_BOSS_X#2`). Assertion de sortie : aucun id
   dupliqué dans `markers.json`.
2. **Séparer `alpha` et `boss`** selon `palId === "None"`.
3. **Classer les points de voyage rapide** en `tower` (liste d'ids ci-dessus) /
   `watchtower` (préfixe `WatchTower_`) / `ft`.
4. **Étendre les assertions de volumétrie** : `tower === 8`,
   `watchtower === 20`, `alpha` ∈ [80, 90], `boss` ∈ [65, 75], total ≥ 440.

Consommateurs à mettre à jour avec le type élargi :
`packages/pipeline/src/search-index.ts` (union `MarkerType`, libellés),
`packages/pipeline/src/verify.ts`, `apps/web/src/lib/search/tokens.ts`,
`apps/web/src/lib/search/engine.ts` (le filtre `mk !== "relic"` doit devenir
« cochable »), `apps/web/src/lib/components/CommandPalette.svelte`,
`apps/web/src/lib/map/markerController.ts` (glyphes), `LeafletMap.svelte`
(couleurs `.mk-*`), `MarkerPopup.svelte`, `apps/web/src/lib/server/progress.ts`,
`apps/web/src/lib/server/import.ts`, `apps/web/src/routes/s/[slug]/+page.server.ts`
(compteur du tableau de bord).

### Internationalisation

Tout libellé de la barre passe par Paraglide (FR + EN), y compris les nouveaux :
un libellé et un libellé court par catégorie (`map_cat_relic`,
`map_cat_relic_short`, … `map_cat_resource`), la mention « bientôt » des
catégories futures, les contrôles (`map_search_in`, `map_level_min`,
`map_hide_tracked`, `map_visible_on_map`, `map_copy_link`, `map_results_count`,
`map_group_found`), l'état vide et les libellés d'éléments. Les noms de marqueurs
eux-mêmes restent résolus par `gameName()` sur les données de jeu localisées
(`pal:*`, `ft:*`) ; les boss humains n'ont pas d'entrée L10N et gardent leur nom
de spawner normalisé.

## Gestion des erreurs

| cas | comportement |
| --- | --- |
| `localStorage` indisponible | valeurs par défaut, aucune exception (comportement actuel) |
| URL de filtres invalide (clé inconnue, niveau hors bornes) | on ignore les champs illisibles, on garde les défauts pour eux |
| `POST /progress` en échec | annulation optimiste déjà en place dans `ProgressStore` |
| `fetch` de zones de spawn en échec | aucune zone dessinée, le reste de la barre fonctionne (comportement actuel) |
| id périmé en localStorage après régénération des données | filtré par le garde-fou d'ids valides |
| presse-papiers refusé (copier le lien) | l'URL est affichée sélectionnable en repli |

## Tests

**Unitaires (sans DOM)** — `query.test.ts` : chaque dimension de filtre
isolément, puis combinées ; `hideTracked` ; recherche insensible à la casse et
aux accents ; catégorie future toujours vide. `categories.test.ts` : les volumes
attendus par catégorie, et la somme égale au nombre de marqueurs.

**Pipeline** — assertion d'unicité des ids ; volumétrie par catégorie ;
les 8 ids de tours présents et classés `tower`.

**Régression du bug d'ids** — un test qui charge `markers.json` et échoue si un
id apparaît deux fois. C'est le garde-fou qui empêche la liste de résultats de se
casser à la prochaine régénération.

**Composants** — `ResultList` : clic émet l'id attendu ; coche émet le bon
`entityId` ; état vide rendu. `CategoryRail` : la tuile sélectionnée porte
`aria-current`, une catégorie masquée son marquage.

**Existants à ne pas casser** — `markerController.test.ts` (glyphes par type),
`engine.test.ts` (recherche de marqueurs).

## Hors périmètre

- Ressources / minerais (aucune donnée — voir `docs/decisions.md`).
- Donjons (pas de positions fixes en DataTable).
- Auto-remplissage du suivi depuis les saves pour boss et voyages rapides.
- Zones de spawn multi-Pals ou agrégées par élément / aptitude.
- Coffres, POI de l'Arbre-Monde (carte séparée).
