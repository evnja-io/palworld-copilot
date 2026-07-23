# Industrialisation multi-tenant — Design

Date : 2026-07-22 · Statut : validé (brainstorming Sephi + Claude)

## Problème

L'app sert aujourd'hui UN serveur Palworld (le groupe de Sephi) : allowlist
plate, tracking global mis en commun, un seul jeu de secrets SFTP dans GitHub
Actions. Objectif : **libre-service ouvert** — n'importe qui se connecte via
Discord, crée son « serveur », configure l'accès SFTP de son hébergeur, invite
ses amis, et obtient les mêmes fonctionnalités que le groupe d'origine
(Paldex partagé, technos, carte avec collectibles, import de save) sur son
propre monde.

## Décisions produit (validées)

1. **Libre-service ouvert** : tout utilisateur Discord peut créer un serveur,
   sans intervention manuelle. L'allowlist globale disparaît.
2. **Ingestion = SFTP géré par nous** : l'utilisateur saisit hôte/port/login/
   mot de passe SFTP + dossier de save ; credentials chiffrés au repos ; notre
   worker va chercher les saves périodiquement.
3. **Adhésion par lien d'invitation** révocable (pattern Discord).
4. **Multi-serveurs par utilisateur** avec sélecteur ; le GUID de joueur est
   lié au couple (utilisateur, serveur).
5. **Worker d'import : GitHub Actions en fan-out séquentiel** (v1, suffisant
   jusqu'à quelques dizaines de serveurs ; bascule matrix documentée).

## Constat structurant

Les données de jeu (`packages/game-data/*.json`, tuiles de carte Vercel Blob,
`tileSetId` = hash de la texture officielle) sont **universelles** : aucune
tenantisation nécessaire. Seuls sont mono-tenant aujourd'hui :

- 4 tables : `allowlist`, `progress`, `save_snapshots`, `save_players`
  (+ `users.palPlayerGuid`) ;
- le pipeline d'import (secrets SFTP globaux, `SAVE_REMOTE_DIR` unique) ;
- la vue « groupe » (`getProgress()` agrège toutes les lignes sans filtre).

Limite assumée : cartes moddées non supportées (maps.json universel), hors
scope v1.

## Schéma de données

Nouvelles tables (`apps/web/src/lib/server/db/schema.ts`) :

| Table | Colonnes clés |
|---|---|
| `servers` | id uuid PK, name, slug (10 car. base62, unique, URLs), ownerId → users, createdAt |
| `server_members` | PK (serverId, userId), role `owner`\|`member`, palPlayerGuid (nullable, index unique partiel par serveur), joinedAt |
| `invites` | code PK (`randomBytes(16).toString('base64url')`, 128 bits), serverId, createdBy, expiresAt, revokedAt, maxUses, useCount |
| `server_import_configs` | serverId PK, sftpHost, sftpPort, sftpUser, sftpPasswordEnc, remoteDir (nullable ⇒ auto-découverte `SaveGames/0/*/`), enabled, lastImportAt, lastImportStatus, lastImportError, lastImportStats jsonb |

Tables modifiées :

- `progress`, `save_snapshots`, `save_players` : + `serverId` NOT NULL, intégré
  aux PK composites ; l'index de la vue groupe devient `(serverId, kind)`.
- `users` : `palPlayerGuid` supprimé (migré vers `server_members`).
- `allowlist` : supprimée (option future : table `bans` globale).

Les credentials vivent dans une table séparée pour qu'aucun load de page ne
sélectionne du ciphertext par accident.

## Chiffrement des credentials

- AES-256-GCM via `node:crypto`, zéro dépendance nouvelle.
- Clé maîtresse `SAVE_CREDS_KEY` (32 octets base64) : env Vercel (chiffrement à
  la saisie + test SFTP) et secret GitHub Actions (déchiffrement à l'import).
  Jamais dans le repo (public, GPL).
- Format stocké : `v1:` + base64(IV 12 o ‖ ciphertext ‖ tag 16 o), **AAD =
  serverId** (un ciphertext ne peut pas être rejoué sur un autre tenant).
  Préfixe de version ⇒ rotation de clé possible.
- Le mot de passe n'est jamais renvoyé au client (`passwordSet: true` ; champ
  vide à la sauvegarde = conserver l'existant).
- Module ~40 lignes dans `packages/pipeline/src/creds.ts`, miroir
  `apps/web/src/lib/server/crypto.ts` (les deux doivent rester synchrones).

## Architecture applicative

Routes :

```
/                      → redirection vers /s/[dernier slug] (cookie) ou /servers
/servers               → mes serveurs (sélecteur) ; /servers/new (max 3 créés/user)
/join/[code]           → acceptation d'invitation (login requis)
/s/[slug]/…            → l'actuel groupe (app) : paldex, tech, map, items, craft, import
/s/[slug]/settings     → owner : renommage, SFTP + test, invitations, membres
/api/servers/[slug]/…  → remplace /api/progress, contrôle d'adhésion
```

- `routes/s/[slug]/+layout.server.ts` : résout le slug, vérifie l'adhésion
  (**404** si non-membre — ne pas révéler l'existence), fournit
  `{ server, membership, myServers }`, pose le cookie `last_server`.
- Les layouts ne protègent pas les actions : chaque action/endpoint re-vérifie
  via `requireMembership()` / `requireOwner()` (nouveau
  `apps/web/src/lib/server/servers.ts`).
- `progress.ts` / `import.ts` : toutes les requêtes scopées par `serverId` ;
  `claimGuid` cible `server_members.pal_player_guid` (pattern rejouable
  conservé — neon-http sans transactions ; pièges connus : `string_to_array`
  pour les tableaux, casts `::uuid` dans les UNION).
- Test SFTP en ligne via `ssh2` depuis une fonction Vercel (spike Phase 0) ;
  fallback si bloqué : vérification au premier run Actions, statut affiché.
- i18n : remplacer les textes « demande à Sephi » (en.json:14,17 + fr.json)
  par la promesse self-service.

Onboarding cible : créer le serveur → configurer le SFTP (+ test /
auto-découverte du monde) → copier le lien d'invitation → les amis rejoignent
→ après le premier import, chacun revendique son GUID sur `/s/[slug]/import`.

## Pipeline d'import

- Refactor : les corps de `import-save.ts` / `extract-players.ts` deviennent
  des fonctions exportées `importPlayerSaves(sql, serverId, dir)` /
  `syncPlayerNames(sql, serverId, dir)` dans `packages/pipeline/src/import-lib.ts` ;
  wrappers CLI conservés (`--server-id`).
- Nouveau `packages/pipeline/src/import-all.ts` : sélectionne les configs
  `enabled`, puis par tenant en try/catch (**isolation des pannes**) :
  statut `running` → déchiffre → `fetch-saves.py` avec env par tenant
  (auto-découverte du remoteDir si vide, dossier découvert réécrit en base) →
  import scopé → statut `ok`/`error` + stats ; nettoyage de
  `/tmp/saves/<serverId>` (Level.sav JSON ≈ 170 Mo). Exit non-zéro seulement
  si tous les tenants échouent (le badge Actions signale les pannes
  systémiques).
- `.github/workflows/import-saves.yml` : secrets réduits à `DATABASE_URL` +
  `SAVE_CREDS_KEY` ; `timeout-minutes: 45` ; déclencheurs `schedule` +
  `workflow_dispatch` uniquement (repo public — jamais `pull_request`).
  Bascule matrix documentée en commentaire (seuil : durée totale ~timeout).

## Migration des données existantes

Ordre imposé par l'absence de transactions côté runtime (neon-http) ; les
migrations DDL passent par `drizzle-kit migrate` (driver `pg`, transactionnel).

1. **Migration A** (additive) : nouvelles tables + `server_id` nullable sur
   `progress`/`save_snapshots`/`save_players`. Déployable avec l'ancien code.
2. **Backfill** `apps/web/scripts/backfill-legacy-server.ts` (idempotent,
   rejouable, pattern `allowlist-add.ts`) : crée le serveur `legacy`
   (`ON CONFLICT DO NOTHING`), membres depuis `users` (Sephi owner), copie des
   GUIDs, `UPDATE … SET server_id` sur les trois tables.
3. Déploiement du code scopé (Phase 1).
4. **Migration B** : `SET NOT NULL`, PK composites, drop
   `users.pal_player_guid` + `allowlist`. Pré-condition vérifiée : zéro
   `server_id` NULL. À tester sur une branche Neon d'abord.
5. Ressaisir le SFTP legacy dans la nouvelle UI (chiffré avec
   `SAVE_CREDS_KEY`), puis purger les secrets GH `SFTP_*`.

Petite base utilisateurs ⇒ courte fenêtre de maintenance acceptable entre 2–4,
pas de double-écriture.

## Sécurité

- Autorisation systématique (adhésion/owner) sur `/s/` et `/api/servers/` ;
  404 pour les non-membres.
- SSRF : le SFTP exige un handshake SSH (pas de forge HTTP) ; risque résiduel
  = sondage de ports. Sur l'endpoint de test Vercel : résoudre le DNS, rejeter
  les plages privées/réservées, réutiliser l'IP résolue (anti-rebinding).
- Invitations : 128 bits d'entropie ; consommation par
  `UPDATE … WHERE use_count < max_uses RETURNING` (pas de course sans
  transactions) ; révocation/expiration vérifiées au join.
- Limites : max 3 serveurs créés par utilisateur (COUNT à la création).
- Kick : supprime l'adhésion **et** les lignes `progress` du membre sur ce
  serveur (l'import suivant re-remplit ce qui vient de la save s'il
  re-revendique). L'owner ne peut pas quitter sans transfert/suppression.
- Perte de `SAVE_CREDS_KEY` = tous les tenants ressaisissent leur mot de passe
  (à documenter au runbook).

## Phases (chacune livrable)

| Phase | Contenu | Vérification |
|---|---|---|
| 0 — Spikes | ssh2 depuis Vercel ; migration PK sur branche Neon | go/no-go test SFTP en ligne |
| 1 — Modèle multi-tenant invisible | Migrations A+backfill+B, routes `/s/[slug]`, requêtes scopées ; allowlist conservée ; import legacy via `--server-id` (secret provisoire `LEGACY_SERVER_ID`) | tests de scoping (2 serveurs, zéro fuite) ; run Actions manuel à compteurs identiques ; zéro `server_id` NULL |
| 2 — Ouverture | Suppression du check allowlist, création/join/invitations/sélecteur, settings owner (hors SFTP), limites, i18n | parcours complet 2ᵉ compte Discord ; invitation révoquée rejetée ; 404 sur serveur étranger |
| 3 — Ingestion self-service | Crypto, UI SFTP + test/auto-découverte, `import-all.ts`, workflow réécrit, migration du SFTP legacy en base, statuts d'import | import legacy identique via le nouveau chemin ; config cassée ⇒ `error` visible sans bloquer les autres ; round-trip chiffrement Vercel↔Actions |
| 4 — Durcissement | Filtrage IP SSRF, kick/leave/delete + nettoyage, rotation de clé, bouton « importer maintenant » (nice-to-have), audit des endpoints | revue sécurité manuelle ; accès logged-out/non-membre ; fuzzing d'invitations |

## Fichiers critiques

- `apps/web/src/lib/server/db/schema.ts`, `progress.ts`, `import.ts`,
  `servers.ts` (nouveau), `crypto.ts` (nouveau)
- `apps/web/src/routes/login/discord/callback/+server.ts`,
  `routes/s/[slug]/+layout.server.ts` (nouveau), `/servers`, `/join/[code]`
- `packages/pipeline/src/import-lib.ts`, `import-all.ts`, `creds.ts`
  (nouveaux), `scripts/fetch-saves.py`
- `.github/workflows/import-saves.yml`
