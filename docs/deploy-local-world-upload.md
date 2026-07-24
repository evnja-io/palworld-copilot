# Rollout — upload de saves locales (mondes co-op)

Objectif : activer l'upload navigateur des saves de mondes locaux. La feature est
**entièrement additive** (nouvelle table, nouvelles routes, nouveau workflow) —
aucune bascule de données ni migration destructive.

## Prérequis (action humaine de Sephi — le harness bloque le DDL prod)

1. **Migrations 0009 + 0010** appliquées en prod :
   `DATABASE_URL=<prod> pnpm --filter web db:migrate`.
   - `0009_chunky_virginia_dare` : table `save_uploads` (isolée, additive).
   - `0010_narrow_wrecker` : index unique partiel `save_uploads_active_unique`
     (un seul upload actif par serveur). Table neuve, sans données → `CREATE
     UNIQUE INDEX` non concurrent sans risque.

2. **Token GitHub pour `repository_dispatch`** — créer un **fine-grained PAT**
   limité à ce repo, permission **Contents: Read and write** (requise pour
   `POST /repos/{owner}/{repo}/dispatches`). Le poser sur Vercel :
   - `GITHUB_DISPATCH_TOKEN` = le PAT.
   - `GITHUB_REPO` = `evnja-io/palworld-copilot` (owner/repo).
   ⚠️ Sans ces deux variables, `finalize` réussit quand même mais l'upload reste
   `pending` jusqu'au prochain sweep du cron 6 h (dégradation propre, pas d'échec).

3. **Token Blob côté Actions** — ajouter le secret GitHub → Settings → Secrets →
   Actions : `BLOB_READ_WRITE_TOKEN` = **la même valeur** que la variable Vercel
   déjà injectée dans l'app (visible via `vercel env` ou la console Blob). Le
   worker en a besoin pour télécharger puis supprimer les blobs.

## Vérification post-déploiement

1. Créer un serveur de test, ouvrir `/s/<slug>/upload`.
2. Sélectionner un dossier de monde local (contenant `Level.sav` + `Players/`),
   confirmer les uploads vers Blob et la ligne passée en `pending`.
3. Vérifier dans GitHub → Actions que `import-upload` se déclenche en ~1 min
   (repository_dispatch), puis que l'UI passe à `ok` (polling) avec les stats.
4. Sur `/s/<slug>/import`, vérifier que les snapshots sont visibles et que la
   revendication de GUID fonctionne (dont le GUID hôte `…0001`).
5. Négatif : upload d'un `.sav` corrompu → ligne `error` avec message ; ré-upload
   du même dossier → mêmes compteurs (idempotence).

## Rollback

Feature additive : désactiver le workflow `import-upload` (Actions → Disable) et
masquer/retirer la route `/s/[slug]/upload`. La table `save_uploads` peut rester
en place sans effet sur le reste.

## Notes d'exploitation

- Le sweep (`import-upload.ts` sans `UPLOAD_ID`) tourne à chaque cron
  `import-saves` (continue-on-error) et via `workflow_dispatch` manuel : il
  traite les `pending` dont le dispatch a été perdu, marque les jobs `running`
  bloqués >2 h en `error`, les `uploading` abandonnés >24 h en `error`, et purge
  les blobs orphelins >24 h.
- Un `Level.sav` volumineux est acceptable (upload client direct, pas de limite
  de corps de fonction) ; le JSON converti (~170 Mo) est nettoyé de `/tmp` par le
  worker en `finally`.
