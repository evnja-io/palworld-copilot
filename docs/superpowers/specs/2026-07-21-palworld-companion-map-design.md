# Palworld Companion — Design v1 (carte interactive à progression partagée)

Date : 2026-07-21 · Statut : validé en brainstorming, en attente de revue finale

## Contexte et objectif

Outil compagnon **privé** pour un groupe d'amis jouant à Palworld sur un serveur commun.
Bilingue **FR/EN**. Pas de SEO, pas de public externe.

La v1 est la **carte interactive du monde** avec progression partagée : chaque membre
coche ce qu'il a trouvé (effigies Lifmunk, coffres, notes/journaux) et voit la
progression des autres ("récupéré par 3/5"). Les boss de tour, Pals Alpha, entrées de
donjons et statues de voyage rapide sont affichés comme repères.

Phases ultérieures (hors v1, anticipées à coût nul) : Paldex, items & craft.

## Décisions de cadrage (brainstorming)

| Sujet | Décision |
|---|---|
| Objectif | Outil privé de groupe (pas un site public) |
| Feature v1 | Carte interactive |
| Progression | Partagée par groupe — backend + BDD |
| Marqueurs v1 | Effigies, coffres, notes (cochables) + boss, Alphas, donjons, voyage rapide (repères) |
| Auth | Discord OAuth + allowlist d'invités |
| Stack | SvelteKit (Svelte 5) + Vercel + Neon Postgres (Drizzle) |
| Données | Extraction depuis les fichiers du jeu (FModel), l'utilisateur possède Palworld |
| i18n | Paraglide (UI) + noms du jeu issus des L10N officiels FR/EN du pak |

## Contraintes de données (recherche vérifiée juillet 2026)

- **Aucun dataset ouvert n'existe** (ni tuiles Leaflet, ni coordonnées de marqueurs).
  Les sites existants (paldb.cc, mapgenie, th.gl) gardent leurs données fermées.
- La texture de carte `Pal/Content/Pal/Texture/UI/Map/T_WorldMap` et les DataTables
  POI sont extractibles du `Pal-Windows.pak` avec **FModel** (mappings UE 5.1 + clés
  AES : github.com/elliotks/Palworld-FModel).
- Transformation coordonnées documentée (MIT, github.com/palworldlol/palworld-coord) :
  `map_x = (world_y − 158000)/459`, `map_y = (world_x + 123888)/459` (île principale).
- Le pak contient les traductions FR + EN de tous les noms (dossiers L10N).
- Légal : guidelines Pocketpair permissives pour les outils de fans non commerciaux.
- Environnement vérifié : Palworld installé sous
  `/mnt/c/Program Files (x86)/Steam/steamapps/common/Palworld/` (pak 38 Go),
  Node 22, pnpm 11, dev sous WSL2.

## Architecture

Monorepo pnpm, 3 packages :

```
apps/web/               SvelteKit (Svelte 5), adapter-vercel
packages/game-data/     Artefacts générés COMMITTÉS : markers/*.json,
                        l10n/names.{en,fr}.json, maps.json, data-version.json
packages/pipeline/      Scripts Node : transform (DataTables→JSON), tiling (sharp),
                        upload Blob. raw/ et out/ gitignorés.
docs/extraction-runbook.md   Procédure FModel manuelle (côté Windows)
```

**Stockage des artefacts** :
- Marqueurs + noms + config cartes → **committés** (quelques Mo, diffs revoyables à
  chaque MAJ du jeu, app buildable sans pipeline).
- Tuiles de carte → **Vercel Blob**, préfixe versionné `tiles/{tileSetId}/{mapId}/{z}/{x}/{y}.webp`
  (~120 Mo+ pour 3 cartes, régénérées à chaque MAJ : pas leur place dans git).
  Bascule atomique via `tileSetId` dans `maps.json`, rollback instantané.
- Exports FModel bruts → jamais committés (reproductibles via le runbook).

## Pipeline de données

1. **Extraction manuelle** (runbook, FModel sous Windows) : DataTables POI (`DT_*`),
   dossiers L10N fr/en, textures de carte → exports JSON/PNG dans `packages/pipeline/raw/`.
2. **Transform** (Node/WSL) : parsing des DataTables, transformation de coordonnées
   par carte, émission de marqueurs normalisés :
   `{ id, type, map, pos: [x,y], nameId?, meta? }`.
   Les **IDs sont stables** (dérivés des row names des DataTables, jamais d'index) —
   c'est le contrat avec la BDD. `verify.ts` échoue si un re-run change des IDs
   existants sans fichier de remap explicite, et vérifie des comptages attendus
   (~116 effigies) + des coordonnées connues.
3. **Tiling** : sharp (pas de dépendance GDAL) — pyramide webp 256 px, zoom 0..N,
   upload Blob via `@vercel/blob`.
4. **MAJ du jeu** : re-export → `pnpm --filter pipeline run all` → revue du
   `git diff` de game-data → upload tuiles si textures changées → bump
   `data-version.json` → deploy. Les progressions orphelines (marqueurs supprimés)
   restent en BDD sans effet.

## Base de données (Drizzle + Neon, driver neon-http)

Les marqueurs restent **hors BDD** (statiques, identiques pour tous, versionnés en
git). La BDD ne stocke que le généré-par-humain. Groupe unique implicite en v1
(pas de table groups ; migration facile si besoin un jour).

```
users            id uuid pk, discordId unique, username, avatarUrl, createdAt
sessions         id text pk (hash du token), userId fk cascade, expiresAt
allowlist        discordId pk, addedBy fk null, note
marker_progress  (userId, markerId) pk, checkedAt ; index sur markerId
```

Agrégation groupe = un `GROUP BY marker_id`, joint en mémoire avec le JSON statique.
Validation côté serveur : tout `markerId` entrant doit exister dans le set chargé.

## Auth : Arctic + sessions maison (pattern Lucia)

Auth.js écarté (adapter SvelteKit de second rang, personnalisation de session pénible
pour un seul provider). Arctic v3 gère le flow OAuth Discord (scope `identify` seul).

- `/login/discord` → state + redirect Discord.
- `/login/discord/callback` → validation, échange du code, **gate allowlist** (refus
  poli si Discord ID inconnu), upsert user (pseudo/avatar rafraîchis), session cookie
  httpOnly 30 j glissants.
- `hooks.server.ts` : `sequence(paraglide, auth)` → `event.locals.user`.
- Groupe de routes `(app)` protégé par `+layout.server.ts` ; `/login` seule route publique.
- Allowlist gérée par script CLI (`allowlist:add <discordId> <note>`) ; admin UI = plus tard.

## Frontend carte (Leaflet + Svelte 5)

Principe : **Leaflet possède le DOM de la carte, Svelte possède l'état**. Pont via
`$effect` → contrôleur impératif ; jamais un composant Svelte par marqueur (~500+).

- `LeafletMap.svelte` : `L.map({ crs: L.CRS.Simple })` + tileLayer Blob ; import
  dynamique de Leaflet en `onMount` (client-only).
- `markerController.ts` : LayerGroup par type, `sync(visibleMarkers)` diffe par ID ;
  `divIcon` SVG par type ; état "collecté" = classe CSS (désaturé + badge).
- `MarkerPopup.svelte` monté dans la popup Leaflet via `mount/unmount` (Svelte 5) :
  nom localisé, bouton cocher/décocher, rangée d'avatars Discord (grisé = pas trouvé).
- `mapState.svelte.ts` : `$state` filtres + progression, `$derived` visibleMarkers ;
  filtres persistés en localStorage.
- Multi-cartes : `/map/[mapId]` (palpagos | sakurajima | feybreak) validé contre
  `maps.json` ; `{#key mapId}` force la recréation propre. `/map` → redirect palpagos.
- Chargement des marqueurs + progression en `+page.server.ts` (pas de waterfall client).
- Cocher/décocher : POST `/api/progress`, update optimiste, rollback si échec.

## i18n : Paraglide, deux canaux séparés

- Stratégie `["cookie", "preferredLanguage", "baseLocale"]` — pas d'URLs localisées.
  Toggle FR/EN dans le header.
- Canal 1 : chaînes d'UI (messages Paraglide, rédigées à la main).
- Canal 2 : noms du jeu via `names.{locale}.json` générés depuis les L10N officiels —
  jamais traduits à la main. Helper `gameName(id)`. Réutilisé tel quel par le futur Paldex.

## Sync de progression : simple

Update optimiste + refetch au focus de la fenêtre + polling 60 s si onglet visible.
Payload : `{ mine: string[], group: Record<markerId, discordId[]> }`. Pas de
websockets/SSE en v1 (≤6 joueurs) ; la fonction de fetch est isolée pour pouvoir
changer de déclencheur plus tard.

## Plan par phases

- **Phase 0 — Spike d'extraction (avant tout code app)** : FModel installé, carte PNG
  exportée, DataTables POI identifiées (s'aider des noms d'assets dans
  oMaN-Rod/palworld-save-pal), 5 effigies transformées et comparées au wiki,
  **décision coffres** (fixes vs spawners → inclure/adapter/reporter), runbook rédigé.
  *Sortie : ≥3 types de marqueurs avec coordonnées visuellement justes.*
- **Phase 1 — Squelette + auth** : scaffold SvelteKit workspace, Vercel + Neon,
  schéma Drizzle + migration, OAuth Discord + allowlist + guard, Paraglide.
  *Sortie : preview déployée, login Discord OK, non-invité rejeté.*
- **Phase 2 — Pipeline complet + tuiles** : transforms réels, L10N, tiler sharp,
  upload Blob, `maps.json`, `verify.ts`. *Sortie : re-run pipeline = diff vide (IDs stables).*
- **Phase 3 — Carte v1 (Palpagos)** : LeafletMap, contrôleur, filtres, popups,
  progression optimiste + polling, panneau de stats. *Sortie : test à 2 comptes/2
  navigateurs, A coche → B voit au cycle suivant.*
- **Phase 4 — Cartes DLC + ship** : tuiles Sakurajima/Feybreak, **calibration de
  transform par carte** (fit sur 2-3 points de voyage rapide connus — ne pas supposer
  les constantes de l'île principale), switch de carte, polish mobile, prod.
- **Phase 5 (hors v1)** : Paldex, items/craft — le pipeline exporte déjà les
  DataTables complètes ; routes `(app)/paldex` et `(app)/items` réservées.

## Risques

| Risque | Prob. | Mitigation |
|---|---|---|
| Coffres = spawners aléatoires, incompatibles avec le check-off | Haute | Décision Phase 0 ; repli = "spots de spawn" ou report |
| Offsets de coordonnées différents sur les îles DLC | Haute | Params de transform par carte, calibration empirique Phase 4 |
| POI dans des assets de level/blueprint plutôt que des DataTables propres | Moyenne | Précédent paldb.cc/save-pal ; pire cas : bootstrap depuis wiki.gg (CC BY-SA, page d'attribution) |
| FModel/mappings cassés par une MAJ moteur | Moyenne | Artefacts committés → l'app tourne sur données figées en attendant |
| IDs de marqueurs instables entre MAJ | Moyenne | Gate `verify.ts` + fichier de remap obligatoire |
| Pak 38 Go lent sous FModel | Certaine, bénigne | Attentes posées dans le runbook |

## Hors périmètre v1 (délibéré)

Table groups, admin UI, temps réel, import de sauvegardes, Paldex/items, SEO,
comptes non-Discord.
