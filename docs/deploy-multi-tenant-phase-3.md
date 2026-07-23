# Rollout multi-tenant phase 3 — ingestion self-service (ordre impératif)

Objectif : basculer l'import legacy des secrets GH globaux vers la config SFTP
chiffrée en base, sans interruption de l'historique de tracking.

## Prérequis

- Migration `0005_*` (table `server_import_configs`) appliquée en prod :
  `DATABASE_URL=<prod> pnpm --filter web db:migrate`.
- **Générer la clé maîtresse** (une seule fois, à conserver hors repo) :
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
- Poser cette valeur :
  - Vercel : variable d'environnement `SAVE_CREDS_KEY` (chiffrement à la saisie +
    endpoint de test SFTP).
  - GitHub → Settings → Secrets → Actions : secret `SAVE_CREDS_KEY` (déchiffrement
    à l'import). Doit être **identique** à celle de Vercel.
- ⚠️ **Perte de `SAVE_CREDS_KEY`** = tous les tenants doivent ressaisir leur mot
  de passe SFTP (les ciphertext deviennent indéchiffrables). Sauvegarder la clé
  dans le gestionnaire de secrets personnel.

## Bascule du serveur legacy

1. **Geler l'import** : GitHub → Actions → `import-saves` → « Disable workflow »
   (le cron 6 h ne doit pas tourner avec l'ancien code pendant la bascule).
2. **Déployer le code phase 3** (merge de la branche → Vercel build). L'ancien
   workflow est déjà gelé ; le nouveau lit `server_import_configs`.
3. **Saisir le SFTP legacy dans l'UI** : se connecter en owner du serveur
   `legacy`, aller sur `/s/legacy/settings`, section « Import SFTP » : renseigner
   hôte/port/utilisateur/mot de passe (les mêmes valeurs que les anciens secrets
   GH `SFTP_HOST`/`SFTP_USER`/`SFTP_PASSWORD`), laisser « Dossier de save » vide
   (auto-découverte) **ou** recopier l'ancien `SAVE_REMOTE_DIR`, cocher « Import
   activé », Enregistrer. Le mot de passe est chiffré avec `SAVE_CREDS_KEY`.
4. **Tester la connexion** (si le bouton est présent — spike ssh2 GO) : doit
   renvoyer OK + le dossier de monde. Si le spike était NO-GO, passer à l'étape 5
   (la validation vient du premier run).
5. **Dégeler l'import** (« Enable workflow ») puis lancer un run manuel
   (`workflow_dispatch`). Vérifier dans le log : `1 tenant(s) activé(s)`, statut
   `OK`, compteurs (pals/techs/effigies/pseudos) cohérents avec le dernier run de
   l'ère legacy. Sur `/s/legacy/settings`, `lastImportStatus = ok` et
   `lastImportAt` récent.
6. **Contrôles finaux** : sur `/s/legacy`, paldex/tech/map/import identiques à
   avant ; un GUID revendiqué (« Rain ») toujours lié ; si `remoteDir` était vide,
   il est désormais rempli en base (auto-découverte persistée).

## Purge des anciens secrets (uniquement après un run OK)

7. GitHub → Settings → Secrets → Actions : **supprimer** `SFTP_HOST`,
   `SFTP_USER`, `SFTP_PASSWORD`, `SAVE_REMOTE_DIR`, `LEGACY_SERVER_ID`.
   `DATABASE_URL` et `SAVE_CREDS_KEY` restent.

## Rollback

- Avant l'étape 7 : réactiver l'ancien workflow depuis un revert du code, les
  anciens secrets étant toujours présents.
- Après l'étape 7 : recréer les secrets `SFTP_*`/`SAVE_REMOTE_DIR`/
  `LEGACY_SERVER_ID` à partir de la sauvegarde avant de revert.
