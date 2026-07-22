# Rollout multi-tenant phase 1 (ordre impératif)

L'ordre compense l'absence de transactions runtime : l'ancien code écrit sans
server_id, le nouveau l'exige — la fenêtre entre les deux doit être maîtrisée.

1. **Geler l'import** : GitHub → Actions → workflow `import-saves` → « Disable
   workflow » (le cron 6 h ne doit pas tourner pendant la fenêtre).
2. **Migration A** (additive, sans risque pour le code en prod) :
   `DATABASE_URL=<prod> pnpm --filter web db:migrate`
3. **Backfill** : `pnpm --filter web backfill:legacy 106026755659145216`
   (Discord ID de Sephi ; renommable ensuite). Vérifier la sortie (membres > 0).
4. **Déployer le code** (merge de la branche → Vercel build).
5. **Re-backfill** (rattrape les lignes écrites par l'ancien code entre 3 et 4,
   idempotent) : `pnpm --filter web backfill:legacy 106026755659145216`
6. **Pré-check migration B** — les trois requêtes doivent renvoyer 0 :
   `select count(*) from progress where server_id is null;` (idem
   save_snapshots, save_players)
7. **Migration B** : `DATABASE_URL=<prod> pnpm --filter web db:migrate`
8. **Secret** : GitHub → Settings → Secrets → Actions → `LEGACY_SERVER_ID` =
   `select id from servers where slug = 'legacy';`
9. **Dégeler l'import** (« Enable workflow ») puis lancer un run manuel
   (workflow_dispatch) ; comparer les compteurs du log au run précédent.
10. **Contrôles finaux** : `/` redirige vers `/s/legacy` ; paldex/tech/map/
    import identiques à avant ; coche/décoche OK ; GUID « Rain » toujours lié.

Rollback avant l'étape 7 : l'ancien code reste compatible (colonnes nullables
ignorées). Après l'étape 7 : restaurer la branche Neon de sauvegarde (en créer
une juste avant l'étape 2 depuis la console Neon).
