# Phase 6 — Carte interactive : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> USER ACTIONS : création du store Vercel Blob si le CLI ne suffit pas,
> validation visuelle de la calibration. Exécution inline recommandée
> (calibration itérative). Invoquer `interface-design` avant l'UI carte.

**Goal:** La carte du monde interactive : tuiles de la vraie texture du jeu, 153 effigies **cochables et partagées** (auto-cochées par l'import de save), 159 boss Alpha et les points de voyage rapide en repères, filtres, popups avec avatars du groupe.

**Architecture:** Une **seule carte** (la texture 8192×8192 couvre toutes les îles — pas de multi-cartes, simplification vs spec). Pipeline : `markers.ts` (effigies depuis le dataset communautaire, boss depuis `DT_BossSpawnerLoactionData`, voyage rapide depuis TeleportCoordinates.json de MapCollectablesMod) géoréférencés en **pixels de texture** via les bornes monde documentées ; `tile-map.ts` (sharp → pyramide webp z0-5) uploadée sur **Vercel Blob** versionnée. Web : `/map` avec Leaflet `CRS.Simple`, contrôleur de marqueurs impératif (pont `$effect`), popups montées via `mount()`, kind `marker` au registre, `ProgressStore` réutilisé. Import : `raw:relic` fusionne désormais vers `kind='marker'` (`relic_<guid>`).

**Tech Stack:** existant + `leaflet` (+ types) et `@vercel/blob` (pipeline).

## Global Constraints

- Géoréférencement : bornes monde de la texture (communauté, à CALIBRER visuellement) : `MIN = (-999940, -738920)`, `MAX = (447900, 708920)` (X/Y monde UE). Pixel = `px = (worldY - MIN.y) / (MAX.y - MIN.y) * 8192`, `py = (worldX - MIN.x) / (MAX.x - MIN.x) * 8192` — axes UE inversés vs image, orientation à vérifier à la calibration (Task 4) et constantes centralisées dans `game-data/maps.json`
- IDs de marqueurs STABLES : effigies `relic_<guid minuscule sans tirets>` (= normalisation des snapshots `raw:relic`), boss `alpha_<SpawnerID>`, voyage rapide `ft_<id du dataset>`
- Seules les **effigies** sont cochables (`kind: marker`) ; boss et voyage rapide sont des repères — le registre ne valide QUE les ids d'effigies
- Import strictement additif, comme toujours ; AUCUN test d'écriture sur des comptes réels (leçon Phase 5) — utiliser des données de test synthétiques nettoyées ensuite
- Tuiles : Blob public `tiles/{tileSetId}/{z}/{x}/{y}.webp`, `tileSetId` = hash court de la texture source ; URL de base dans `maps.json` ; jamais dans git
- Datasets communautaires : `effigies.json` (save-pal) et `TeleportCoordinates.json` (MapCollectablesMod) téléchargés dans `raw/community/` (gitignoré) par un script, avec attribution dans `docs/decisions.md`
- **Reports assumés** : donjons (pas de positions fixes en DataTable), tours de boss (absentes des assets), notes/journaux (pas de dataset) — consignés
- Couverture effigies : 153/605 (dataset pré-DLC) — accepté, mécanisme d'abord ; régénération complète = phase données future
- i18n FR/EN ; design system existant ; densité et patterns des pages actuelles
- Branche : `feature/phase-6-carte`

---

### Task 1: Pipeline — markers.json + maps.json

**Files:**
- Create: `packages/pipeline/src/fetch-community.ts` (téléchargements raw/community/)
- Create: `packages/pipeline/src/transform/markers.ts`
- Modify: `packages/pipeline/src/all.ts`, `package.json`
- Modify: `packages/pipeline/src/verify.ts` (comptages markers)

**Interfaces:**
- Consumes: `raw/community/effigies.json`, `raw/community/TeleportCoordinates.json`,
  `DT_BossSpawnerLoactionData` (exports)
- Produces: `game-data/markers.json` :
  `[{ id, type: "relic"|"alpha"|"ft", px, py, nameId?, meta? }]`
  (px/py en pixels de texture 0-8192, 1 décimale) ;
  `game-data/maps.json` : `{ tileBaseUrl, tileSetId, sizePx: 8192, maxZoom,
  world: { min: [x,y], max: [x,y] } }` (tileBaseUrl/tileSetId remplis en Task 2)
- Boss : `meta: { palId: CharacterID sans BOSS_, level }` ; ft : `nameId` si
  disponible dans le dataset

- [ ] **Step 1: fetch-community.ts** — télécharge (si absents) les deux datasets
  vers `raw/community/` (URLs raw.githubusercontent ; effigies.json déjà présent).
  Vérifier le format de TeleportCoordinates.json à l'exécution et documenter.
- [ ] **Step 2: markers.ts** — transformation monde→pixels avec les constantes
  des Global Constraints ; assertions : 140 ≤ relics ≤ 200, 150 ≤ alphas ≤ 200,
  ft > 50 ; ids stables selon la convention ; tri par id.
- [ ] **Step 3:** `all.ts` + `verify.ts` (comptages + stabilité IDs pour
  markers.json), run complet `VERIFY OK`, commit.

---

### Task 2: Tuiles — tiling sharp + upload Vercel Blob

**Files:**
- Create: `packages/pipeline/src/tile-map.ts`
- Modify: `packages/pipeline/package.json` (script `tiles`)
- Modify: `game-data/maps.json` (tileBaseUrl + tileSetId réels)

**Interfaces:**
- Consumes: `T_WorldMap.png` (export, ~8192²), `BLOB_READ_WRITE_TOKEN` (env)
- Produces: pyramide `tiles/{tileSetId}/{z}/{x}/{y}.webp` (256 px, z0-5,
  qualité 80) sur Blob public ; `maps.json` finalisé

- [ ] **Step 1: USER ACTION si nécessaire** — créer le store Blob : d'abord
  tenter `vercel blob store add palworld-tiles` puis `vercel env pull` ;
  sinon dashboard → Storage → Blob. `BLOB_READ_WRITE_TOKEN` doit finir dans
  `apps/web/.env` (et rester hors git).
- [ ] **Step 2: tile-map.ts** — localiser le PNG dans les exports (TEXTURE_ROOTS),
  padding au carré 8192 si besoin, `tileSetId` = 8 hex du sha256 du fichier,
  génération z5 (32×32) → z0 (1×1) par réductions successives, upload
  `@vercel/blob` (`put`, `access: "public"`, `addRandomSuffix: false`,
  concurrence ~8), écriture de `maps.json`. Idempotent : si `tileSetId`
  inchangé et déjà présent (HEAD sur la tuile 0/0/0), skip l'upload.
- [ ] **Step 3:** run réel (~1365 tuiles), vérifier une URL de tuile en HTTPS,
  commit (maps.json + script).

---

### Task 3: Registre marker + extension de l'import aux effigies

**Files:**
- Modify: `apps/web/src/lib/server/progress.ts` (+ test)
- Modify: `packages/pipeline/src/import-save.ts` (fusion `raw:relic` → `marker`)
- Modify: `apps/web/src/lib/server/import.ts` (`claimGuid` idem)

**Interfaces:**
- Produces: `isValidEntity("marker", "relic_<guid>")` ; les deux fusions
  (CLI + claim) mappent `raw:relic` → `('marker', 'relic_' || entity_id)`
  UNIQUEMENT pour les guids présents dans markers.json (les 452 effigies
  hors dataset restent en attente dans les snapshots)

- [ ] **Step 1: TDD registre** — test : `relic_<guid connu>` valide, guid
  inconnu invalide, `alpha_*` invalide (repère non cochable).
- [ ] **Step 2: fusions** — dans les DEUX requêtes SQL de fusion, ajouter un
  second SELECT (union) : `select u.id, 'marker', 'relic_' || s.entity_id from
  save_snapshots s ... where s.kind = 'raw:relic' and ('relic_' || s.entity_id)
  in (<ids relics de markers.json>)` — passer la liste en paramètre (elle est
  courte : ~153). Idempotence et additivité inchangées.
- [ ] **Step 3:** tests + vérification à blanc : créer un GUID de test
  synthétique en snapshots, un user de test, claim simulé en local, vérifier
  la fusion marker, PUIS TOUT SUPPRIMER (données de test uniquement). Commit.

---

### Task 4: Page /map — Leaflet + calibration (interface-design d'abord)

**Files:**
- Create: `apps/web/src/lib/map/LeafletMap.svelte`, `markerController.ts`,
  `mapState.svelte.ts`
- Create: `apps/web/src/routes/(app)/map/+page.server.ts`, `+page.svelte`
- Modify: messages FR/EN

**Interfaces:**
- Consumes: `maps.json`, `markers.json`, leaflet (nouvelle dep web)
- Produces: `/map` plein écran (moins le topbar) : tuiles Blob en
  `CRS.Simple` (bounds `[[0,8192],[8192,0]]` à ajuster), zoom molette/pinch,
  marqueurs par type (icônes divIcon distinctes : effigie = sphère verte
  Lifmunk, alpha = crâne/niveau, ft = statue bleue), `markerController.sync()`
  diffé par id (pattern spec : Leaflet possède le DOM, Svelte l'état)

- [ ] **Step 1:** `pnpm --filter web add leaflet && add -D @types/leaflet` ;
  import dynamique client-only (`onMount`), CSS leaflet importé localement.
- [ ] **Step 2:** LeafletMap + tuiles + **calibration** : afficher 3 effigies
  et 3 boss connus, comparer visuellement (Playwright + session de test —
  session à créer/nettoyer comme en Phase 3/4) avec les positions attendues
  sur les îles ; ajuster orientation/offsets dans maps.json si décalage
  (c'est l'étape à risque du plan — itérer jusqu'à ce que les marqueurs
  tombent sur les îles, pas dans l'océan).
- [ ] **Step 3:** contrôleur complet (LayerGroup par type, divIcons, état
  coché = classe CSS), commit.

---

### Task 5: Filtres, popups, progression partagée

**Files:**
- Create: `apps/web/src/lib/map/MarkerPopup.svelte`, `popupBridge.ts`,
  `FilterPanel.svelte`
- Modify: page /map, messages

**Interfaces:**
- Consumes: `ProgressStore` (kind `marker`), `GroupAvatars`, popups Leaflet
- Produces: panneau de filtres (toggle par type + « masquer mes trouvées » +
  compteur effigies X/153 moi · Y/153 groupe, persisté localStorage) ; popup
  par marqueur : nom (effigie : « Effigie Lifmunk » + coordonnées ; alpha :
  nom du pal via `gameName(pal:…)` + niveau, lien fiche ; ft : nom localisé
  si dispo), bouton cocher (effigies seulement) + avatars du groupe ;
  `popupBridge` : `mount(MarkerPopup, …)` dans la popup Leaflet, `unmount`
  au `popupclose`

- [ ] **Step 1:** FilterPanel + mapState (`$state` filtres + `$derived`
  visibles) branchés au contrôleur via `$effect`.
- [ ] **Step 2:** popupBridge + MarkerPopup + toggle optimiste + polling
  (startSync/stopSync).
- [ ] **Step 3:** vérification Playwright (cocher/décocher, filtre, compteur),
  nettoyage des données de test, commit.

---

### Task 6: Déploiement + vérification de sortie de phase

- [ ] **Step 1:** suite complète (vitest pipeline+web, check, build) verte ;
  `pnpm --filter @palworld-companion/pipeline all` → `VERIFY OK`.
- [ ] **Step 2:** `vercel deploy --prod --yes` ; vérifier /map en prod
  (tuiles servies par Blob, pas d'erreur console).
- [ ] **Step 3: USER ACTION** — validation en jeu : ouvrir /map à côté du jeu,
  vérifier que 2-3 effigies que tu connais sont au bon endroit ; cocher une
  effigie à la main ; vérifier qu'un joueur lié voit ses effigies de save
  auto-cochées après le prochain run du cron (ou `gh workflow run import-saves`).
- [ ] **Step 4:** skill finishing-a-development-branch.
