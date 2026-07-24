# Design — Support des mondes locaux (co-op) par upload navigateur

## Contexte

L'app ne supportait que les serveurs dédiés : chaque tenant tire ses saves par
SFTP (phase 3), parsées par le cron GitHub Actions. Ce design ajoute le support
des **mondes locaux / co-op** (« multi avec code de partage »).

Décisions actées lors du brainstorming :

- Un monde local est un **tenant ordinaire** : créé via `/servers/new`, les amis
  rejoignent par les **liens d'invitation existants** (`/join/[code]`), les
  membres revendiquent leur GUID in-game sur `/s/[slug]/import`. Aucun nouveau
  mécanisme de partage — le « code de partage » est l'invitation déjà en place.
- **Ingestion = upload navigateur** par l'hôte (sélecteur de dossier / fichiers
  de `Level.sav` + `Players/*.sav` depuis
  `%LOCALAPPDATA%\Pal\Saved\SaveGames\<SteamID>\<WorldID>\`).
- **Plomberie = upload direct vers Vercel Blob** (client-upload, évite la limite
  de taille des fonctions ; un `Level.sav` local peut faire des dizaines de Mo)
  puis **`repository_dispatch`** pour qu'un job Actions traite l'upload en ~1 min.
  Latence de l'ordre de la minute acceptée ; statut affiché dans l'UI.
- Les saves locales utilisent le **même format binaire** ; le cœur de parsing est
  réutilisé **inchangé** : `importPlayerSaves()` / `syncPlayerNames()` de
  `packages/pipeline/src/import-lib.ts` prennent un dossier plat local.

## Choix de conception (validés contre le code)

- **Upload réservé au propriétaire** via `requireOwner()` existant (aligné sur le
  précédent des réglages SFTP ; empêche un invité d'écraser les données de la
  tribu).
- **`server_import_configs` inchangé** — SFTP et upload coexistent comme sources
  alternatives écrivant dans les mêmes tables `save_snapshots` / `save_players`.
- **Ne pas dépendre de `onUploadCompleted`** (inatteignable en localhost /
  derrière la protection de déploiement) : le client appelle explicitement
  l'action `finalize` une fois les uploads terminés.
- **Échec de dispatch non fatal** : la ligne reste `pending` ; le sweep du cron
  6 h la rattrape.
- **Unicité atomique** : un seul upload actif par serveur, garanti par l'index
  unique partiel `save_uploads_active_unique` + `INSERT ... ON CONFLICT DO
  NOTHING` (le driver neon-http n'a pas de transactions).
- Le GUID hôte `…0001` des saves locales ne nécessite aucun changement de code
  (filtre de nom de fichier, `normalizeGuid`, `claimGuid` sont tous à base de
  chaînes).
- Ré-upload idempotent (delete+reinsert par GUID).
- Blobs supprimés après traitement (ok ET erreur) ; message d'erreur conservé
  dans la ligne.

## Architecture livrée

1. **Table `save_uploads`** (migrations 0008 + 0009) — une ligne par tentative
   d'upload ; cycle `uploading → pending → running → ok|error` ; `stats` jsonb au
   même format que `last_import_stats`.
2. **Librairies serveur** `apps/web/src/lib/server/uploads.ts` (validation de
   pathname Blob, `createUpload`/`finalizeUpload`/`listUploads`/`cancelUpload`) +
   `github.ts` (`dispatchImportUpload`). Limites partagées client/serveur dans
   `$lib/upload-limits.ts`.
3. **Endpoint token** `POST /api/servers/[slug]/upload` (`handleUpload` de
   `@vercel/blob/client`, garde propriétaire, validation stricte du pathname,
   erreurs différenciées 400/409).
4. **Page `/s/[slug]/upload`** (propriétaire) — sélecteur de dossier + repli
   multi-fichiers, filtrage client vers `Level.sav` + `Players/<GUID>.sav`,
   upload direct vers Blob (`access: "public"`), finalisation, historique avec
   badges de statut et polling tant qu'un upload est non terminal.
5. **Worker `packages/pipeline/src/import-upload.ts`** — modes ciblé (UPLOAD_ID
   d'un dispatch) et sweep (rattrapage cron). Télécharge les blobs vers un
   dossier plat `/tmp/uploads/<uploadId>/`, réutilise le cœur de parsing, écrit
   statut/stats, supprime les blobs, nettoie `/tmp`.
6. **Workflows** `.github/workflows/import-upload.yml` (dispatch + sweep manuel) +
   un pas de sweep ajouté à `import-saves.yml` (continue-on-error).

## Contrat des blobs

- Pathname exact : `uploads/<serverId>/<uploadId>/Level.sav` et
  `uploads/<serverId>/<uploadId>/Players/<32 hex>.sav`. La validation rejette
  tout le reste (traversée, imbrication, autres noms) — c'est une frontière de
  sécurité (le worker télécharge tout ce qui est sous le préfixe).
- `access: "public"` (API client `@vercel/blob` v2.6.1) : le pathname embarque un
  `uploadId` UUIDv4 non devinable et les blobs sont supprimés en quelques minutes
  par le worker.

## Hors périmètre

Durcissement (SSRF etc.), outil de sync desktop, liens de partage publics en
lecture seule, modifications de `server_import_configs`.
