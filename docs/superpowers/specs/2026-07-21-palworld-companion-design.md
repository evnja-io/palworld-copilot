# Palworld Companion — Design produit complet (encyclopédie + carte, progression partagée)

Date : 2026-07-21 (révisé le même jour : périmètre étendu au compagnon complet)
Statut : validé en brainstorming, en attente de revue finale

## Contexte et objectif

Outil compagnon **privé** pour un groupe d'amis jouant à Palworld sur un serveur commun.
Bilingue **FR/EN**. Pas de SEO, pas de public externe.

Produit **complet** : encyclopédie du jeu (Paldex, items, craft, arbre technologique,
constructions) **et** carte interactive du monde, avec **progression partagée** dans
tout l'outil — chaque membre coche ce qu'il a capturé/trouvé/débloqué et voit la
progression des autres ("capturé par 3/5").

Ordre de construction décidé : **encyclopédie d'abord** (pages de données, valeur
immédiate, techniquement simple), **carte ensuite** (plus complexe : tuiles, Leaflet).

## Décisions de cadrage (brainstorming)

| Sujet | Décision |
|---|---|
| Objectif | Outil privé de groupe (pas un site public) |
| Périmètre | Compagnon complet : Paldex, items, craft, tech/niveaux, constructions, carte |
| Ordre | Encyclopédie → carte |
| Progression | Partagée, généralisée : Pals capturés, technos débloquées, marqueurs carte |
| Breeding | Combos simples sur chaque fiche Pal (parents/enfants) ; solveur complet = plus tard |
| Auth | Discord OAuth + allowlist d'invités |
| Stack | SvelteKit (Svelte 5) + Vercel + Neon Postgres (Drizzle) |
| Données | Extraction depuis les fichiers du jeu (FModel), l'utilisateur possède Palworld |
| i18n | Paraglide (UI) + noms/descriptions du jeu issus des L10N officiels FR/EN du pak |

## Contraintes de données (recherche vérifiée juillet 2026)

- **Aucun dataset ouvert n'existe** (ni tuiles Leaflet, ni coordonnées de marqueurs ;
  les APIs Paldex publiques sont obsolètes ou anglophones uniquement). Les sites
  existants (paldb.cc, mapgenie, th.gl) gardent leurs données fermées.
- Tout est extractible du `Pal-Windows.pak` avec **FModel** (mappings UE 5.1 + clés
  AES : github.com/elliotks/Palworld-FModel) : DataTables (Pals, items, recettes,
  tech tree, constructions, POI), textures (carte du monde, icônes de Pals/items),
  dossiers L10N FR + EN. Pipelines de référence : blaynem/paldex, palcalc GenDB.
- Transformation coordonnées carte documentée (MIT, github.com/palworldlol/palworld-coord) :
  `map_x = (world_y − 158000)/459`, `map_y = (world_x + 123888)/459` (île principale).
- Légal : guidelines Pocketpair permissives pour les outils de fans non commerciaux.
- Environnement vérifié : Palworld installé sous
  `/mnt/c/Program Files (x86)/Steam/steamapps/common/Palworld/` (pak 38 Go),
  Node 22, pnpm 11, dev sous WSL2.

## Architecture

Monorepo pnpm, 3 packages :

```
apps/web/               SvelteKit (Svelte 5), adapter-vercel
packages/game-data/     Artefacts générés COMMITTÉS : pals.json, items.json,
                        recipes.json, tech.json, buildings.json, breeding.json,
                        markers/*.json, l10n/{names,descriptions}.{en,fr}.json,
                        maps.json, data-version.json
packages/pipeline/      Scripts Node : transforms (DataTables→JSON), icônes
                        (PNG→webp), tiling carte (sharp), upload Blob.
                        raw/ et out/ gitignorés.
docs/extraction-runbook.md   Procédure FModel manuelle (côté Windows)
```

**Stockage des artefacts** :
- JSON de données + L10N + config cartes → **committés** (quelques Mo, diffs
  revoyables à chaque MAJ du jeu, app buildable sans pipeline).
- Icônes Pals/items/tech (petites, ~centaines) → converties en webp par le pipeline
  et **committées** dans `apps/web/static/icons/` (volume faible, change rarement).
- Tuiles de carte → **Vercel Blob**, préfixe versionné
  `tiles/{tileSetId}/{mapId}/{z}/{x}/{y}.webp` (~120 Mo+ pour 3 cartes). Bascule
  atomique via `tileSetId` dans `maps.json`, rollback instantané.
- Exports FModel bruts → jamais committés (reproductibles via le runbook).

## Pipeline de données

1. **Extraction manuelle** (runbook, FModel sous Windows) : DataTables (Pals, items,
   recettes, tech, constructions, POI carte), L10N fr/en, icônes, textures de carte
   → exports JSON/PNG dans `packages/pipeline/raw/`.
2. **Transforms** (Node/WSL), un module par domaine :
   - `pals.ts` → stats, éléments, skills, aptitudes de travail, drops, où le trouver
     (zone), combos de breeding (parents/enfants directs).
   - `items.ts` → catégorie, où l'obtenir (drops de Pals, zones, marchands),
     "utilisé dans" (recettes inverses).
   - `recipes.ts` → ingrédients, station de craft requise, techno prérequise.
   - `tech.ts` → arbre technologique par niveau (points, prérequis).
   - `buildings.ts` → constructions : matériaux, techno requise, effets.
   - `markers.ts` → POI carte : `{ id, type, map, pos, nameId?, meta? }`.
   - `l10n.ts` → noms + descriptions FR/EN pour toutes les entités.
   - Les **IDs sont stables** (row names des DataTables, jamais d'index) — contrat
     avec la BDD de progression. `verify.ts` échoue si un re-run change des IDs sans
     fichier de remap explicite, et vérifie des comptages attendus (~200+ Pals,
     ~116 effigies) + des valeurs connues en spot-check.
3. **Icônes** : conversion PNG→webp (sharp), nommage par ID d'entité.
4. **Tiling carte** : sharp — pyramide webp 256 px, zoom 0..N, upload Blob.
5. **MAJ du jeu** : re-export → `pnpm --filter pipeline run all` → revue du
   `git diff` de game-data → upload tuiles si besoin → bump `data-version.json`
   → deploy. Les progressions orphelines restent en BDD sans effet.

## Base de données (Drizzle + Neon, driver neon-http)

Les données du jeu restent **hors BDD** (statiques, identiques pour tous, versionnées
en git). La BDD ne stocke que le généré-par-humain. Groupe unique implicite en v1.

```
users        id uuid pk, discordId unique, username, avatarUrl, createdAt
sessions     id text pk (hash du token), userId fk cascade, expiresAt
allowlist    discordId pk, addedBy fk null, note
progress     (userId, kind, entityId) pk, checkedAt ; index sur (kind, entityId)
             kind ∈ { pal_caught, tech_unlocked, marker }  (extensible)
```

La table `progress` est **générique** : elle sert le Paldex (Pals capturés), le tech
tree (technos débloquées) et plus tard la carte (marqueurs cochés). Une seule API
(`POST /api/progress`), un seul mécanisme d'agrégation groupe
(`GROUP BY kind, entity_id`), joint en mémoire avec le JSON statique. Validation
serveur : tout `entityId` entrant doit exister dans le dataset du `kind` concerné.

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

## Frontend — encyclopédie

Navigation principale : **Paldex · Items · Craft · Technologies · Constructions · Carte**.
Le skill `interface-design` (installé dans le projet) guide le travail visuel.

- **Paldex** : grille filtrable (élément(s), aptitudes de travail, recherche texte
  FR/EN) → fiche Pal : stats, éléments, skills (actifs/passifs/partenaire),
  aptitudes, drops (liens vers items), zone d'apparition, combos de breeding
  (parents possibles / enfants possibles, liens croisés), bouton "capturé" +
  avatars du groupe.
- **Items** : liste filtrable par catégorie → fiche item : description, comment
  l'obtenir (drops, zones, marchands), "entre dans les recettes de…" (liens).
- **Craft** : vue par recette et par station ; chaque recette affiche ingrédients
  (avec liens), station et techno requises. Recherche "comment crafter X" =
  la recherche globale pointe vers la fiche de X qui expose sa recette.
- **Technologies** : arbre par niveau (points requis, prérequis), tracking
  partagé "débloqué" par membre.
- **Constructions** : liste par catégorie : matériaux, techno requise, effets.
- **Recherche globale** (header) : sur les noms FR + EN de toutes les entités,
  côté client (index léger généré par le pipeline).
- Listes rendues côté serveur depuis les JSON workspace (pas d'API de données) ;
  seuls les appels de progression touchent le réseau.

## Frontend — carte (phase ultérieure, design inchangé)

Leaflet `CRS.Simple` + tuiles Blob ; **Leaflet possède le DOM, Svelte possède
l'état** (pont `$effect` → contrôleur impératif, pas un composant par marqueur).
`markerController.sync()` diffe par ID ; popups montées via `mount/unmount`
(nom localisé, check-off, avatars) ; filtres par type + "masquer le collecté"
persistés en localStorage ; multi-cartes `/map/[mapId]` avec `{#key}` ;
marqueurs v1 carte : effigies, coffres, notes (cochables — `kind: marker`) +
boss de tour, Alphas, donjons, voyage rapide (repères). Les fiches Pal pourront
pointer vers la carte (zones d'apparition) dans une itération ultérieure.

## i18n : Paraglide, deux canaux séparés

- Stratégie `["cookie", "preferredLanguage", "baseLocale"]` — pas d'URLs localisées.
  Toggle FR/EN dans le header.
- Canal 1 : chaînes d'UI (messages Paraglide, rédigées à la main).
- Canal 2 : noms **et descriptions** du jeu via `{names,descriptions}.{locale}.json`
  générés depuis les L10N officiels — jamais traduits à la main. Helpers
  `gameName(id)` / `gameDesc(id)`. Si le volume descriptions devient lourd,
  passage en import dynamique par locale.

## Sync de progression : simple

Update optimiste + refetch au focus de la fenêtre + polling 60 s si onglet visible
(sur les pages qui affichent de la progression). Payload par kind :
`{ mine: string[], group: Record<entityId, discordId[]> }`. Pas de websockets/SSE
(≤6 joueurs) ; déclencheur isolé pour évoluer plus tard.

## Plan par phases

- **Phase 0 — Spike d'extraction (avant tout code app)** : FModel installé ;
  vérifier qu'on obtient : (a) DataTables Pals/items/recettes/tech exploitables
  avec IDs stables, (b) L10N FR/EN joignables aux IDs, (c) icônes exportables,
  (d) carte PNG + une DataTable POI avec 5 effigies dont les coordonnées
  transformées collent au wiki, (e) **décision coffres** (fixes vs spawners).
  S'aider des noms d'assets de oMaN-Rod/palworld-save-pal et blaynem/paldex.
  Runbook rédigé. *Sortie : chaque domaine de données prouvé sur un échantillon.*
- **Phase 1 — Squelette + auth** : scaffold SvelteKit workspace, Vercel + Neon,
  schéma Drizzle + migration (table `progress` générique), OAuth Discord +
  allowlist + guard, Paraglide, nav principale (sections en placeholder).
  *Sortie : preview déployée, login Discord OK, non-invité rejeté.*
- **Phase 2 — Pipeline encyclopédie** : transforms pals/items/recipes/tech/
  buildings/l10n + icônes webp + index de recherche + `verify.ts`.
  *Sortie : JSON committés, re-run = diff vide (IDs stables).*
- **Phase 3 — Paldex** : grille + filtres + recherche, fiche Pal complète
  (breeding combos inclus), tracking "capturé" partagé (première utilisation de
  l'API progress). *Sortie : test à 2 comptes, A coche → B voit.*
- **Phase 4 — Items, Craft, Technologies, Constructions** : les quatre sections,
  liens croisés (item ↔ recette ↔ techno ↔ construction), tracking technos.
  *Sortie : "comment crafter X" trouvable en <10 s depuis la recherche.*
- **Phase 5 — Carte (Palpagos)** : tiling + upload Blob, `maps.json`, LeafletMap,
  contrôleur, filtres, popups, progression `kind: marker`.
  *Sortie : test multi-comptes comme Phase 3.*
- **Phase 6 — Cartes DLC + polish + ship** : Sakurajima/Feybreak (calibration de
  transform **par carte**, fit sur points de voyage rapide connus), switch de
  carte, polish mobile (les amis consulteront sur téléphone en jouant), prod.
- **Plus tard (hors périmètre)** : solveur de breeding complet, liens fiche Pal →
  zones sur la carte, admin UI allowlist, import de sauvegardes.

## Risques

| Risque | Prob. | Mitigation |
|---|---|---|
| Volume/complexité des DataTables (recettes/tech éclatées sur plusieurs tables) | Moyenne | Phase 0 échantillonne chaque domaine avant d'écrire les transforms ; référence : blaynem/paldex, palcalc GenDB |
| Coffres = spawners aléatoires, incompatibles avec le check-off | Haute | Décision Phase 0 ; repli = "spots de spawn" ou report |
| Offsets de coordonnées différents sur les îles DLC | Haute | Params de transform par carte, calibration empirique Phase 6 |
| POI dans des assets de level/blueprint plutôt que des DataTables propres | Moyenne | Précédent paldb.cc/save-pal ; pire cas : bootstrap depuis wiki.gg (CC BY-SA, attribution) |
| FModel/mappings cassés par une MAJ moteur | Moyenne | Artefacts committés → l'app tourne sur données figées en attendant |
| IDs instables entre MAJ du jeu | Moyenne | Gate `verify.ts` + fichier de remap obligatoire |
| Pak 38 Go lent sous FModel | Certaine, bénigne | Attentes posées dans le runbook |

## Hors périmètre v1 (délibéré)

Table groups, admin UI, temps réel, import de sauvegardes, solveur de breeding,
SEO, comptes non-Discord.
