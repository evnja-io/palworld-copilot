# Rollout multi-tenant phase 1 (ordre impératif)

L'ordre compense l'absence de transactions runtime : l'ancien code écrit sans
server_id, le nouveau l'exige — la fenêtre entre les deux doit être maîtrisée.

**Prérequis** : `db:migrate` et `backfill:legacy` tournent via `node
--env-file=.env` — un fichier `apps/web/.env` doit exister (sinon `ENOENT`). Le
préfixe `DATABASE_URL=<prod>` en tête de chaque commande ci-dessous surcharge la
valeur du `.env` (l'inline gagne) et cible explicitement la prod ; le garder sur
**toutes** les étapes qui touchent la base, backfill compris.

1. **Geler l'import** : GitHub → Actions → workflow `import-saves` → « Disable
   workflow » (le cron 6 h ne doit pas tourner pendant la fenêtre).
2. **Migration A** (additive, sans risque pour le code en prod) — `drizzle-kit
   migrate` applique toutes les migrations en attente dans une seule
   transaction ; or 0003 (additive) et 0004 (contraintes) sont toutes deux en
   attente à ce stade, donc un `db:migrate` brut échouerait sur le `SET NOT
   NULL` de 0004 (server_id encore NULL partout) et annulerait aussi 0003.
   Basculer le dossier de migrations à l'état « 0003 seul » avant d'appliquer,
   puis le restaurer :
   ```bash
   git checkout ae8ccda -- apps/web/drizzle    # dossier migrations à l'état A (0003 seul, journal cohérent)
   DATABASE_URL=<prod> pnpm --filter web db:migrate
   git checkout HEAD -- apps/web/drizzle       # restaure 0004 (et le journal complet)
   ```
   Signe qu'on a oublié la bascule : erreur `null value in column "server_id"
   ... violates not-null constraint` — la base est laissée intacte par le
   rollback (0003 n'est pas non plus appliquée, transaction unique), il suffit
   de reprendre l'étape avec la bascule.
3. **Backfill** : `DATABASE_URL=<prod> pnpm --filter web backfill:legacy 106026755659145216`
   (Discord ID de Sephi ; renommable ensuite). Vérifier la sortie (membres > 0).
4. **Déployer le code** (merge de la branche → Vercel build).
5. **Re-backfill** (rattrape les lignes écrites par l'ancien code entre 3 et 4,
   idempotent) : `DATABASE_URL=<prod> pnpm --filter web backfill:legacy 106026755659145216`
6. **Pré-check migration B** — les trois requêtes doivent renvoyer 0 :
   `select count(*) from progress where server_id is null;` (idem
   save_snapshots, save_players)
7. **Migration B** : `DATABASE_URL=<prod> pnpm --filter web db:migrate` — pas de
   bascule ici, seule 0004 est en attente à ce stade.
8. **Secret** : GitHub → Settings → Secrets → Actions → `LEGACY_SERVER_ID` =
   `select id from servers where slug = 'legacy';`
9. **Dégeler l'import** (« Enable workflow ») puis lancer un run manuel
   (workflow_dispatch) ; comparer les compteurs du log au run précédent.
10. **Contrôles finaux** : `/` redirige vers `/s/legacy` ; paldex/tech/map/
    import identiques à avant ; coche/décoche OK ; GUID « Rain » toujours lié.

Rollback avant l'étape 7 : l'ancien code reste compatible (colonnes nullables
ignorées). Après l'étape 7 : restaurer la branche Neon de sauvegarde (en créer
une juste avant l'étape 2 depuis la console Neon).
