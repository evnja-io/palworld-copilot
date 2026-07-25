# Carte — icônes de Pal et zones de spawn (2026-07-25)

## Contexte

Deux demandes liées, formulées ensemble :

1. sur la carte, voir le **portrait du Pal** plutôt qu'une pastille colorée ;
2. sur la fiche d'un Pal, un bouton **« Voir sur la carte »** menant à l'endroit
   où on le trouve.

En l'état, le seul lien Pal → carte passe par les 152 marqueurs Alpha
(`markers.json`, `meta.palId`), qui ne couvrent que **83 Pals sur 288** — un
bouton bâti là-dessus resterait muet pour 205 fiches. La question posée pendant
la conception (« peut-on récupérer les emplacements ailleurs ? ») a été
tranchée : oui, et depuis les fichiers du jeu.

`docs/decisions.md` documentait l'absence de DataTable pour les **coffres** ;
cette conclusion avait été étendue à tort aux spawns de Pals. Trois tables
existent en réalité, dont `UI/DT_PaldexDistributionData` — celle que le jeu
utilise pour son propre Paldex.

Résultat visé : chaque fiche de Pal mène à ses zones de spawn sur la carte, et
les marqueurs Alpha se lisent d'un coup d'œil.

## Décisions de conception

| Sujet | Décision |
|---|---|
| Portée des icônes | Marqueurs **Alpha uniquement**. Reliques (✦) et voyages rapides (◆) gardent leur glyphe : aucun Pal ne leur est associé. |
| Source des zones | **`UI/DT_PaldexDistributionData`**, extraite par le runbook FModel existant. Pas de dépendance tierce, version alignée sur le jeu, aucune question de licence. |
| Rendu | **Régions translucides** : un cercle par point, le chevauchement produit les dégradés de densité. Pas de dépendance heatmap. |
| Jour / nuit | **Bascule segmentée**, une phase à la fois. 132 Pals sur 149 ont des zones distinctes ; les superposer donnerait une bouillie. |
| Pals sans donnée | Section masquée. Pas de promesse non tenue. |

### Ce que contient la table (mesuré)

Dump réel de référence : `blaynem/paldex`, `data-provider/palworld-assets/UI/DT_PaldexDistributionData.json`
(v0.1, janvier 2024 — périmé pour la production, valide pour établir la forme).

```
149 entrées · 80 396 points · rayon uniforme 15000 · 132 Pals ont jour ET nuit
31 clés BOSS_*, dont 10 sans espèce de base (Boss_Anubis, BOSS_JetDragon, …)
```

Forme d'une ligne :

```json
{ "Anubis": {
    "dayTimeLocations":   { "Locations": [{ "X": 0, "Y": 0, "Z": 0 }], "Radius": 15000 },
    "nightTimeLocations": { "Locations": [{ "X": 0, "Y": 0, "Z": 0 }], "Radius": 15000 }
} }
```

Après clustering à demi-rayon : 28 244 zones pour 149 Pals (réduction ×2,8),
soit ~190 zones et ~4 Ko par Pal — pire cas mesuré `HawkBird`, 1022 zones
(~22 Ko). Extrapolé à 288 Pals : ~1,2 Mo au total, d'où le **découpage en un
fichier par Pal chargé à la demande** plutôt qu'un artefact monolithique.

Rayon en pixels : `15000 / 725 / 2000 × 8192` ≈ **85 px** sur la carte 8192 px,
soit environ 1 % de sa largeur.

### Clés `BOSS_*`

Fusionnées dans l'espèce de base après retrait du préfixe (insensible à la
casse — `Boss_Anubis` porte une casse mixte). Sans cette fusion, Anubis,
JetDragon, Umihebi et sept autres n'auraient aucune zone : ils n'apparaissent
qu'en boss de terrain. Le jeu lui-même les range sous la distribution de
l'espèce.

## Lot 1 — Icônes de Pal sur les marqueurs Alpha

Indépendant du pipeline, livrable seul.

**`apps/web/src/lib/map/markerController.ts`** — `#icon()` produit aujourd'hui
un glyphe texte par type. Ajouter une branche : si `type === 'alpha'` et que
`meta.palId` résout vers une icône via `palIcon()` (`$lib/game/icons`), le `html`
devient un `<img>` dans la même pastille de 22 px. Bordure `--el-fire` et badge
de niveau conservés. Repli sur `▲` pour les 69 marqueurs `palId: "None"` et
pour toute icône absente.

La signature de `sync()` et le diffing par id ne changent pas ; le drapeau
`__checked` continue de piloter les `setIcon()`.

**`apps/web/src/lib/map/LeafletMap.svelte`** — ajouter à côté des règles `.mk`
existantes :

```css
.mk-pal { padding: 1px; }
.mk-pal img { width: 18px; height: 18px; object-fit: contain; display: block; }
```

`:hover { transform: scale(1.25) }` et `.mk-checked` restent valables sans
retouche.

**Correctif d'icônes** — `icons.json` ne résout pas `VolcanicMonster`,
`KingAlpaca_Ice` ni `BadCatgirl` : les fichiers existent sous une casse
différente (`Volcanicmonster.webp`, `KingAlpaca_ice.webp`, `BadCatGirl.webp`).
Résoudre insensiblement à la casse dans `packages/pipeline/src/icons.ts`, via le
mécanisme d'alias déjà présent dans le manifeste. Corrige du même coup leurs
fiches Paldex, où le portrait manque aujourd'hui.

## Lot 2 — Pipeline : zones de spawn

**Runbook** — ajouter `UI/DT_PaldexDistributionData` à la liste d'assets à
exporter de `docs/extraction-runbook.md`, section DataTables.

**`packages/pipeline/src/transform/coord.ts`** (nouveau) — `markers.ts`
s'exécute intégralement à l'import (il écrit `markers.json` au chargement) :
importer `worldToPixel` depuis un autre transform déclencherait tout son
traitement. Déplacer `worldToGame`, `worldToPixel` et les constantes `SIZE`,
`SCALE`, `TRANSL_X`, `TRANSL_Y`, `RANGE` dans ce module pur, et les importer
depuis `markers.ts`. Aucun autre fichier ne les référence : bascule sans risque.
Y ajouter `radiusToPx(worldRadius)`.

**`packages/pipeline/src/transform/spawns.lib.ts`** (nouveau, pur — convention
de `passive-effects.lib.ts`) :

- `resolvePalId(rawKey, palIds)` — retire `^BOSS_` insensiblement à la casse,
  puis résout la casse contre les ids de `pals.json` ; renvoie `null` si aucune
  correspondance ;
- `clusterPoints(points, cellSize)` — grille au demi-rayon, un représentant par
  cellule, ordre déterministe ;
- `buildSpawns(rows, palIds)` — orchestration : résolution, fusion `BOSS_*`,
  projection via `coord.ts` (les points hors plage relèvent de l'Arbre-Monde,
  écartés et comptés comme dans `markers.ts`), clustering, arrondi à une
  décimale.

**`packages/pipeline/src/transform/spawns.ts`** (nouveau, I/O) — charge la table
via `loadDataTableRows(/PaldexDistributionData/)`, appelle `buildSpawns`, écrit :

| Sortie | Contenu |
|---|---|
| `apps/web/static/spawns/<PalId>.json` | `{ "r": 85, "day": [[px, py]], "night": [[px, py]] }` |
| `packages/game-data/spawns-index.json` | `{ "<PalId>": { "day": n, "night": n } }` |

L'index sert à la fiche Pal pour décider d'afficher ou non la section, sans
`fetch`. Il est petit et importé statiquement, comme les autres artefacts.

Ajouter `SPAWNS_OUT` à `packages/pipeline/src/paths.ts`, sur le modèle exact de
`ICONS_OUT` (`apps/web/static/spawns/`, commité au dépôt).

Nettoyer le répertoire de sortie avant écriture, pour qu'un Pal disparaissant
d'une version du jeu ne laisse pas un fichier orphelin.

**`packages/pipeline/src/all.ts`** — insérer `./transform/spawns.js` après
`./transform/markers.js` et avant `./search-index.js`.

**`packages/pipeline/src/verify.ts`** — assertions plancher : au moins 100 Pals
couverts, tous les ids présents dans `pals.json`, toutes les coordonnées dans
`[0, 8192]`, rayon strictement positif.

## Lot 3 — Carte : couche de zones

**`apps/web/src/lib/map/spawnLayer.ts`** (nouveau) — jumeau impératif de
`markerController.ts`, même style (pas de composant Svelte par cercle) :
un `L.layerGroup` dédié. API `setPal(palId, phase)` / `clear()` ; le `fetch` de
`/spawns/<id>.json` est mémoïsé dans une `Map` locale.

Un `L.circle` translucide par point — et non `L.circleMarker`, dont le rayon en
pixels ne suivrait pas le zoom. En `CRS.Simple`, le rayon s'exprime dans l'unité
projetée, pas en pixels de texture : le convertir une fois par
`toLatLng(r, 0).lng - toLatLng(0, 0).lng`, avec le `toLatLng` déjà passé par
`LeafletMap`. Aucun réglage d'ordre de couches n'est nécessaire : les vecteurs
atterrissent dans l'`overlayPane` (z 400), sous le `markerPane` (z 600), donc
les Alpha restent cliquables.

**`apps/web/src/lib/map/mapState.svelte.ts`** — ajouter `spawnPal: string | null`
et `spawnPhase: 'day' | 'night'` à `MapFilters`, valeurs par défaut `null` et
`'day'`. **Les deux sont persistés** comme les filtres existants, pour que la
couche survive à un rechargement ; le bouton d'effacement remet `spawnPal` à
`null`. Incrémenter la clé localStorage en `map-filters-v2`, sinon un état
enregistré en v1 se restaure sans ces deux champs.

**`apps/web/src/lib/map/SpawnPanel.svelte`** (nouveau) — sous le `FilterPanel`,
même traitement de surface (fond flouté, `z-index: 500`). Affiche l'icône et le
nom du Pal, une bascule segmentée ☀ / ☾ (motif `.seg` + `aria-pressed`, comme
dans `breeding/+page.svelte`), le nombre de zones de la phase active, et un
bouton d'effacement. Masqué quand `spawnPal` est `null`.

**`apps/web/src/routes/s/[slug]/map/+page.svelte`** — lire `?pal=<palId>` à côté
du `?focus=` existant : renseigner `mapState.spawnPal`, puis cadrer la vue sur
l'emprise des zones chargées. Brancher un `$effect` sur
`spawnLayer.setPal(spawnPal, spawnPhase)`, symétrique de celui qui appelle
`markerController.sync()`.

Arriver par `?pal=` **écrase la phase persistée** avec la valeur pertinente pour
ce Pal — `'night'` si son champ `nocturnal` est vrai, `'day'` sinon. Un Pal
nocturne n'a souvent rien à montrer de jour, et un défaut hérité du Pal
précédent donnerait une carte vide. La bascule manuelle reprend la main ensuite,
et sa valeur est persistée.

Au passage : `focusedId` y est un `let` nu jamais réinitialisé, donc naviguer
deux fois vers le même `?focus=` ne refait rien. Le passer en `$state` et le
remettre à `null` quand le paramètre disparaît.

## Lot 4 — Fiche Pal : section « Où le trouver »

**`apps/web/src/lib/game/indexes.ts`** — ajouter `markersByPal:
Map<palId, MapMarker[]>`, construit au niveau module comme `palsDropping`.

**`apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte`** — nouvelle
section insérée après le bloc `.hero`, avec jusqu'à deux entrées :

- **zones de spawn**, si `spawns-index.json` a une entrée pour ce Pal →
  `appHref('/map?pal=' + pal.id)`, libellé portant le nombre de zones ;
- **boss Alpha**, si `markersByPal` a une entrée → `appHref('/map?focus=' + id)`,
  libellé `Boss Alpha · Niv. N`.

Section entièrement masquée si aucune des deux. Style : lien-bouton accent, sur
le modèle de `.new` dans `teams/+page.svelte`. Toujours passer par `appHref()`,
jamais construire `/s/${slug}/…` à la main — c'est ce qui fait fonctionner le
mode invité.

**`apps/web/messages/fr.json` et `en.json`** — nouvelles clés, ajoutées aux deux
catalogues à la même position (FR est la locale de base) :

```jsonc
"pal_locations": "Où le trouver",
"pal_locations_zones": "Voir sur la carte · {count} zones",
"pal_locations_alpha": "Boss Alpha · Niv. {level}",
"map_spawn_day": "Jour",
"map_spawn_night": "Nuit",
"map_spawn_clear": "Effacer les zones",
```

## Tests

`packages/pipeline/src/transform/spawns.lib.test.ts` — résolution de casse
(`Boss_Anubis` → `Anubis`, `BadCatgirl`, clé inconnue → `null`), fusion des
clés `BOSS_*` dans l'espèce de base, clustering (deux points d'une même cellule
n'en donnent qu'un, déterminisme de l'ordre), rejet des points hors plage.

`apps/web/src/lib/game/indexes.test.ts` — étendre pour `markersByPal` : un Pal
avec marqueur, un Pal sans, et absence de la clé `"None"`.

Aucun test n'existe aujourd'hui sur `apps/web/src/lib/map/` et cette spec n'en
introduit pas l'infrastructure : `spawnLayer.ts` et `SpawnPanel.svelte` sont
vérifiés manuellement.

## Ordre de livraison

Le lot 2 exige une session FModel sous Windows pour exporter la table — le
workflow habituel de toute mise à jour de game-data, mais une étape manuelle qui
ne peut pas être automatisée depuis ce dépôt.

1. **Lot 1** + correctif d'icônes — aucune dépendance, livrable immédiatement.
2. **Lot 4, entrée Alpha seule** — s'appuie sur `markers.json`, déjà présent :
   couvre 83 Pals sans attendre l'extraction.
3. **Lot 2** — après l'export FModel.
4. **Lot 3** + entrée « zones » du lot 4 — dépendent des artefacts du lot 2.

## Vérification

```sh
pnpm --filter @palworld-companion/pipeline all      # regénère, verify inclus
pnpm --filter @palworld-companion/pipeline test
pnpm --filter web check
pnpm --filter web test
pnpm --filter web dev
```

À l'écran :

- `/map` — les marqueurs Alpha montrent un portrait ; les 69 spawners sans Pal
  gardent le ▲ ; reliques et voyages rapides sont inchangés ;
- `/paldex/Anubis` → « Voir sur la carte » → zones affichées, bascule jour/nuit
  fonctionnelle, vue cadrée ;
- `/paldex/Lamball` (ni zone ni Alpha) → section absente ;
- `/paldex/VolcanicMonster` → le portrait s'affiche enfin ;
- en mode invité (`/paldex/…` sans `/s/<slug>/`) les liens restent corrects, et
  en `/en/` aussi.
