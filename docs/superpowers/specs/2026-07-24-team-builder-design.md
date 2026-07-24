# Team Builder — Design (2026-07-24)

## Objectif

Un constructeur d'équipes de Pals pour les membres d'un serveur : composer des
équipes de combat (5 slots) en theorycraft libre — Pal, passifs, skills actifs,
partner skill — les sauvegarder, et les partager en lecture avec le groupe.
Indicateurs « capturé » au niveau espèce depuis les données `progress`
existantes (pas de Pals individuels de la save en v1).

## Décisions validées

- **Modes** : theorycraft libre sur tout le Paldex + indicateurs de capture au
  niveau espèce (avatars du groupe, filtre « capturés par moi »). Les instances
  individuelles de Pals (vrais passifs/moves de la save) sont hors périmètre v1.
- **Visibilité** : équipes partagées au serveur en lecture ; seul l'auteur
  modifie **et** supprime ses équipes (pas de suppression-modération par
  l'owner du serveur).
- **Format** : une équipe = nom + notes libres + 5 slots max (slots vides
  autorisés), taille de l'équipe en jeu.
- **Par slot** : 1 Pal + jusqu'à 4 passifs (n'importe lesquels) + jusqu'à
  3 skills actifs (learnset par défaut, toggle « fruits » pour tout skill).
  Partner skill affiché automatiquement, dérivé du Pal (non stocké).
- **UI** : direction visuelle choisie via une session **design-lab**
  (5 variations) avant l'implémentation des pages, dans le respect du design
  system « expédition nocturne » (`apps/web/src/app.css`,
  `.interface-design/system.md`).

## Faits de données (vérifiés dans les exports du jeu)

- **Aucune régénération pipeline nécessaire.** `OverridePartnerSkillNameTextID`
  est `None` pour ~751 lignes des exports : le champ `partnerSkillNameId`
  serait vide pour tous les Pals réels. Les noms de partner skills suivent la
  convention `partnerskill:<palId>` et le l10n livré couvre déjà les 288 Pals
  en FR et EN (`packages/game-data/l10n/names.{en,fr}.json`).
- **Les descriptions de partner skills n'existent pas** dans les fichiers L10N
  du jeu (seuls les noms existent). Affichage = nom seul, définitivement.
- `skills.json` : 384 entrées dont 6 `*_PartnerSkill` et 52 sans nom EN
  (skills PNJ/junk) → ensemble éligible « skills actifs » = 384 − 6 − 52.
- `passive-effects.json` : 475 passifs (registre de validation et du picker).
- `pal-moves.json` : 4 clés divergent en casse de `pals.json`
  (GhostAnglerfish, LazyCatfish et variantes) → lookup insensible à la casse ;
  `WorldTreeDragon` n'a **aucun learnset** → toggle fruits auto-activé.

## Modèle de données

Table unique `teams` (migration **0008**, purement additive), dans
`apps/web/src/lib/server/db/schema.ts` :

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid PK defaultRandom | clé surrogate (URLs) |
| `server_id` | uuid NOT NULL → servers.id cascade | + index `(server_id)` |
| `author_id` | uuid NOT NULL → users.id cascade | |
| `name` | text NOT NULL | 1–80 chars (trim) |
| `notes` | text NOT NULL default '' | ≤ 2000 chars |
| `slots` | jsonb NOT NULL default [] | `TeamSlot[]`, normalisé à 5 entrées |
| `created_at` / `updated_at` | timestamptz | |

```ts
// apps/web/src/lib/types.ts
export type TeamSlot = { palId: string; passives: string[]; actives: string[] } | null;
```

**Pourquoi jsonb et pas une table enfant** : le driver neon-http n'a pas de
transactions ; une équipe (≤ 5 petits slots) doit s'enregistrer en une seule
écriture atomique. Aucune requête v1 n'a besoin des slots en SQL.

**Écart assumé à la convention PK composite** : `teams` a une PK surrogate
(nécessaire pour les URLs), mais `server_id` figure dans **chaque** clause
WHERE (défense en profondeur, comme `revokeInvite`).

Concurrence : last-write-wins (seul l'auteur édite ; conflit = deux onglets du
même utilisateur). Précondition `updatedAt` → 409 = option v2.
Limite : 100 équipes par serveur (compte avant insert, comme la limite de
3 serveurs).

## Validation serveur

Module partagé `apps/web/src/lib/game/team-data.ts` (sans import paraglide,
donc importable côté serveur — précédent : `progress.ts` importe `pals.json`),
consommé par le validateur **et** les pickers, pour que le client propose
exactement ce que le serveur accepte :

- `PAL_IDS` (pals.json), `PASSIVE_IDS` (passive-effects.json),
  `ACTIVE_SKILL_IDS` (skills.json − `/PartnerSkill/i` − entrées sans nom EN) ;
- `learnsetFor(palId)` : lookup insensible à la casse dans `pal-moves.json`,
  filtré sur `ACTIVE_SKILL_IDS` (peut être vide) ;
- `partnerSkillNsId(palId)` → `` `partnerskill:${palId}` `` (rendu via
  `gameName()`, fallback FR → EN → id brut).

Règles (`apps/web/src/lib/server/teams.ts`, validation manuelle comme
`progress.ts`, pas de zod ; sûre vis-à-vis du prototype — Sets et
`hasOwnProperty`, jamais `obj[key]` sur des clés utilisateur) :

- `name` 1–80, `notes` ≤ 2000, `slots` ≤ 5 entrées, chaque entrée `null` ou
  `{palId, passives, actives}` sans clé supplémentaire ;
- `palId ∈ PAL_IDS` ; `passives` ≤ 4, uniques, `∈ PASSIVE_IDS` ;
  `actives` ≤ 3, uniques, `∈ ACTIVE_SKILL_IDS` ;
- le learnset n'est **pas** imposé côté serveur (les fruits autorisent tout
  skill ; learnset-par-défaut = pure UX).

## API

Pattern A (endpoints JSON), chaque handler ouvre par
`requireMembership(event.locals.user, event.params.slug)` :

- `POST /api/servers/[slug]/teams` → créer, 201 + team.
- `PUT /api/servers/[slug]/teams/[teamId]` → remplacement complet, auteur
  uniquement (UPDATE … WHERE `id` AND `server_id` AND `author_id` ; 0 ligne →
  re-select pour distinguer 404 de 403).
- `DELETE /api/servers/[slug]/teams/[teamId]` → auteur uniquement.
- Lectures via les `+page.server.ts` (SSR).

Helper `apps/web/src/lib/server/teams.ts` : `listTeams` (join users pour
username/avatar, tri `updatedAt` desc), `getTeam`, `createTeam`, `updateTeam`,
`deleteTeam`, `validateTeamInput` (exporté pour les tests).

**Droits** : membre = voir + créer ; auteur = tout sur ses équipes ; l'owner du
serveur n'a **aucun droit supplémentaire** sur les équipes des autres.
Erreurs : non-membre → 404 (convention `requireMembership`) ; membre agissant
sur l'équipe d'autrui → 403 ; teamId inconnu → 404 ; payload invalide → 400.

## Pages et composants

- `apps/web/src/routes/s/[slug]/teams/+page.server.ts` + `+page.svelte` —
  liste : cartes (nom, 5 vignettes `palIcon`, auteur, aperçu notes,
  `updatedAt`), bouton « Nouvelle équipe », suppression de ses équipes.
- `…/teams/new/` — brouillon en mémoire ; premier Save → POST puis
  `goto(appHref('/teams/<id>'))`. Garde `beforeunload` si dirty.
- `…/teams/[teamId]/` — charge `getTeam` + `getProgress(server.id,
  'pal_caught', user.id)` ; éditeur en lecture seule si
  `team.authorId !== user.id`.
- Composants `apps/web/src/lib/components/teams/` : `TeamEditor.svelte`
  (nom/notes, 5 `TeamSlotCard`, barre de sauvegarde sticky),
  `TeamSlotCard.svelte` (Pal + ruban partner skill en lecture seule + 3 chips
  actifs + 4 chips passifs, réutilise `ElementBadge`), `TeamPicker.svelte` —
  un overlay unique à trois modes (`pal` / `active` / `passive`) clonant les
  patterns de `CommandPalette.svelte` (overlay fixe, autofocus, navigation
  clavier, lock du scroll). Mode pal : portraits désaturés si non capturés,
  `GroupAvatars` depuis `progress.group`, filtre « capturés par moi ». Mode
  actif : learnset avec badges de niveau, toggle fruits (auto-on si learnset
  vide). Mode passif : tri par nom localisé, rang affiché.
- État : `apps/web/src/lib/game/team-editor.svelte.ts` — classe `$state`
  (style `ProgressStore`) : champs éditables + snapshot `saved`,
  `dirty` dérivé, `save()` → POST/PUT, états `idle|saving|saved|error`.
  **Sauvegarde explicite** (pas d'autosave : invariants inter-champs, et pas
  d'amplification d'écritures sur le textarea). Pas de polling `ProgressStore`
  dans l'éditeur : les données `{mine, group}` du load suffisent.
- Nav : entrée `{ href: '/teams', label: m.nav_teams }` dans
  `apps/web/src/routes/s/[slug]/+layout.svelte`.
- i18n : ~30 clés plates `teams_*` + `nav_teams` ajoutées **simultanément**
  dans `apps/web/messages/en.json` et `fr.json` (dérive de clés = échec de
  `check`). Copie primaire en FR.

## Séquence d'implémentation

1. Schéma + migration 0008 (`db:generate`, **relecture manuelle du SQL** —
   drizzle-kit émet parfois de mauvais noms de PK / drops parasites —
   puis `db:migrate`).
2. `team-data.ts` + tests (TDD).
3. `teams.ts` (validation + CRUD) + tests (TDD).
4. Endpoints API + `check`.
5. Tests d'intégration (`teams.integration.test.ts`, gated
   `TEST_DATABASE_URL` **et** `DATABASE_URL` sur la même branche Neon, motif
   de `scoping.integration.test.ts`).
6. i18n + nav.
7. **Session design-lab** : 5 variations d'UI sur l'anatomie fonctionnelle
   ci-dessus (liste + éditeur + picker), contraintes = tokens `app.css` +
   `.interface-design/system.md`, références = `PalCard`, page paldex,
   `CommandPalette`, signature grayscale capturé/non-capturé. Choix
   utilisateur de la direction.
8. Store éditeur + squelette des routes.
9. UI selon la direction choisie (MCP Svelte obligatoire sur tout
   `.svelte`/`.svelte.ts`).
10. Passe de vérification : suite complète, `check`, run-through manuel FR/EN
    (créer/modifier/supprimer en membre vs auteur).

## Tests

- **Unitaires validation** : équipe valide acceptée ; rejets — palId inconnu,
  id partner skill en actif, skill junk sans nom (`Human_Rolling`), > 4
  passifs / doublons, > 3 actifs, > 5 slots, clés supplémentaires, sondes
  `__proto__`, limites name/notes ; normalisation à 5 `null`.
- **Unitaires team-data** : `learnsetFor('GhostAnglerfish')` non vide
  (récupération de casse), `learnsetFor('WorldTreeDragon')` vide, nom
  `partnerskill:` présent pour chaque Pal.
- **Intégration** : CRUD complet (fidélité jsonb), scoping par serveur,
  update par non-auteur → 0 ligne, delete par autre membre (owner compris) →
  refusé, cascade à la suppression du serveur.

## Risques

- Relecture manuelle obligatoire du SQL de migration (antécédents drizzle-kit).
- Dérive de clés i18n en/fr casse `check` → éditer les deux fichiers dans la
  même tâche.
- Brouillon `new/` en mémoire seulement avant le premier save (mitigé par
  `beforeunload`).
- L'ensemble des skills éligibles évolue silencieusement avec une mise à jour
  de game-data (stable par sur-ensemble : les ids stockés ne sont revalidés
  qu'à l'écriture).
