# Runbook d'extraction — FModel (Windows)

Statut : v0 (Phase 0). Les chemins d'assets exacts seront confirmés pendant le
spike et corrigés ici.

## Installation (une fois)

1. Installer le runtime « .NET Desktop Runtime 8 » si absent.
2. Télécharger FModel : https://fmodel.app → dézipper, lancer `FModel.exe`.
3. Au premier lancement, ajouter le jeu : Directory selector →
   `C:\Program Files (x86)\Steam\steamapps\common\Palworld`.
4. Settings → General : UE Versions = `GAME_UE5_1`.
5. Récupérer le fichier `.usmap` (mappings) et la clé AES :
   - source à jour : https://github.com/PalworldModding/UsefulFiles (les mappings
     de https://github.com/elliotks/Palworld-FModel sont antérieurs à la v1.0 et
     peuvent échouer sur les tables récentes) ;
   - `.usmap` → Settings → Advanced → Mappings file path ;
   - clé AES → Directory → AES Keys → coller la clé principale.
6. Créer `C:\PalExports`. Settings → General → Output Directory = `C:\PalExports`.
7. Charger l'archive : onglet Archives → double-clic sur `Pal-Windows.pak`.
   ⚠️ Le pak fait 38 Go : la première indexation prend plusieurs minutes.

## Exporter une DataTable en JSON

Naviguer dans l'arborescence (onglet Folders) → clic droit sur l'asset →
**Save Properties (.json)**. Le JSON atterrit sous
`C:\PalExports\Exports\Pal\Content\...` en miroir du chemin d'asset.

## Exporter une texture en PNG

Clic droit sur l'asset texture → **Save Texture (.png)**.

## Liste des assets à exporter (vérifiée — recherche communautaire juillet 2026)

Note v1.0+ : beaucoup de tables existent en deux exemplaires, `DT_Xxx` et
`DT_Xxx_Common` (CompositeDataTable). **Exporter les deux quand les deux existent.**

### DataTables (`Pal/Content/Pal/DataTable/…`) — Save Properties (.json)

| Domaine | Asset |
|---|---|
| Pals | `Character/DT_PalMonsterParameter` |
| Items | `Item/DT_ItemDataTable` |
| Icônes d'items | `Item/DT_ItemIconDataTable` |
| Recettes de craft | `Item/DT_ItemRecipeDataTable` |
| Arbre technologique | `Technology/DT_TechnologyRecipeUnlock` |
| Icônes de technos | `Technology/DT_TechnologyIconData` |
| Constructions | `MapObject/Building/DT_BuildObjectDataTable` |
| Objets de map (master) | `MapObject/DT_MapObjectMasterDataTable` |
| Boss Alpha (positions !) | `UI/DT_BossSpawnerLoactionData` — la faute « Loaction » est dans le vrai nom |
| Donjons | `Dungeon/DT_DungeonLevelDataTable`, `Dungeon/DT_DungeonSpawnAreaDataTable` |
| Skills actifs | `Waza/DT_WazaDataTable`, `Waza/DT_WazaMasterLevel` |
| Bornes de la carte | `WorldMapUIData/DT_WorldMapUIData` (landScapeRealPositionMin/Max) |

### L10N (`Pal/Content/L10N/{en,fr}/Pal/DataTable/Text/…`) — Save Properties (.json)

⚠️ Utiliser les copies sous `L10N/` — les tables du même nom sous
`Pal/Content/Pal/DataTable/Text/` sont le texte source japonais.

`DT_PalNameText_Common`, `DT_ItemNameText_Common`, `DT_ItemDescriptionText_Common`,
`DT_SkillNameText_Common`, `DT_TechnologyNameText_Common`,
`DT_MapObjectNameText_Common`, `DT_MapRespawnPointInfoText`
(+ descriptions longues si présentes : `DT_PalLongDescriptionText_Common`,
`DT_TechnologyDescText_Common`, `DT_BuildObjectDescText_Common`).

### Textures — Save Texture (.png)

- Icônes (textures, clic droit dossier → Save Folder.s Packages Textures) :
  `Pal/Content/Pal/Texture/PalIcon/Normal` et
  `Pal/Content/Others/InventoryItemIcon/Texture`.
- `Pal/Content/Pal/Texture/UI/Map/T_WorldMap` — carte unique 8192×8192 :
  **Sakurajima et Feybreak sont peints dedans**, il n'existe pas de textures
  DLC séparées.
- `Pal/Content/Pal/Texture/UI/Map/T_TreeMap` — carte de l'Arbre-Monde (v1.0).

### Ce qui ne s'exporte PAS depuis FModel (et d'où ça vient à la place)

- **Effigies Lifmunk, coffres, voyage rapide** : acteurs placés dans ~10 000
  cellules World Partition (`Maps/MainWorld_5/PL_MainWorld5/_Generated_/*.umap`)
  — inexploitable à la main. Source utilisée : datasets dérivés open source de
  https://github.com/oMaN-Rod/palworld-save-pal (`data/json/effigies.json`,
  GUID → coordonnées — les mêmes GUID que ceux des saves) et outillage
  https://github.com/arkive-games/arkive pour regénérer au besoin.
- **Positions des tours de boss** : absentes des assets (prouvé par
  catrenelle/PalDex) — coordonnées HUD relevées à la main (elles sont peu
  nombreuses et fixes).
- Référence de datamining la plus complète :
  https://github.com/catrenelle/PalDex/blob/master/NOTES.md

## Rapatrier vers WSL

Rien à copier : le dépôt lit directement `/mnt/c/PalExports`. Les scripts du
projet pointent dessus via la variable d'environnement `RAW_DIR`
(défaut : `/mnt/c/PalExports/Exports`).

## Convertir une save serveur en JSON (import de progression)

Les saves v1.0+ sont au format `PlM` (compression Oodle) : l'outil PyPI
`palworld-save-tools` (0.24.0, format `PlZ`) ne les lit PAS. Utiliser le fork
`palsav` + `palooz` du repo PalworldSaveTools :

```bash
cd packages/pipeline
python3 -m venv .venv
git clone --depth 1 https://github.com/deafdudecomputers/PalworldSaveTools /tmp/pst
.venv/bin/pip install /tmp/pst/src/palsav/palooz   # compile ooz (g++ requis)
.venv/bin/pip install /tmp/pst/src/palsav
.venv/bin/python -m palsav.commands.convert raw/save/<GUID>.sav --to-json -o raw/save/player.sav.json
```

Copier depuis le serveur dédié uniquement les `Players/<GUID>.sav`
(quelques centaines de Ko) — jamais `Level.sav`.

## Importer les saves du serveur (CLI `import-save`)

Le CLI `import-save` automatise la conversion + extraction + écriture en base
pour un dossier entier de `.sav` (un par joueur). Il utilise le même venv
`palsav` que ci-dessus (aucune installation supplémentaire si la section
précédente a déjà été suivie).

1. Récupérer sur le serveur dédié le dossier `Players/` (uniquement les
   fichiers `<GUID>.sav`, jamais `Level.sav`) et le copier quelque part en WSL,
   par exemple `packages/pipeline/raw/save/` (les autres membres peuvent y
   déposer leur propre `.sav`).
2. Lancer, depuis `packages/pipeline` (le script résout les chemins relatifs
   à ce dossier) :
   ```bash
   pnpm --filter @palworld-companion/pipeline import-save raw/save
   ```
   (`DATABASE_URL` est chargé automatiquement depuis `apps/web/.env` via
   `--env-file` ; le dossier `.venv` doit exister — cf. section précédente.)
3. Le CLI imprime, pour chaque `.sav` traité :
   - `<GUID> : n pals, n techs, n effigies (snapshot)` ;
   - à la fin, `fusion : n nouvelles coches appliquées` (nombre total de
     nouvelles lignes ajoutées à `progress`, tous GUIDs confondus) ;
   - une ligne `non revendiqué : <GUID> (n entrées) — page /import` pour
     chaque GUID qui ne correspond à aucun compte (le joueur doit renseigner
     son GUID sur la page `/import` du site pour déclencher la fusion).

### Sémantique (additive, idempotente)

- Le CLI **remplace** intégralement le snapshot `save_snapshots` du GUID
  traité (delete + insert de ce GUID uniquement) — relancer le CLI sur la même
  save produit exactement le même résultat (idempotent).
- La fusion vers `progress` est **strictement additive** :
  `INSERT ... ON CONFLICT DO NOTHING`, jamais de suppression. Une case déjà
  cochée manuellement ne peut pas être « décochée » par un import de save, et
  relancer l'import ne duplique rien (`fusion : 0` au deuxième passage).
- Seuls les kinds `pal_caught` et `tech_unlocked` sont fusionnés vers
  `progress`. Les effigies (`raw:relic`) restent dans `save_snapshots` sans
  fusion — elles alimenteront la Phase 7 (carte).
- La fusion ne s'applique qu'aux GUIDs déjà revendiqués (table `users`,
  colonne `pal_player_guid`) : un joueur non revendiqué voit son snapshot
  stocké mais pas fusionné tant qu'il n'a pas renseigné son GUID via
  `/import`.

## À chaque mise à jour du jeu

1. Steam met à jour le pak → relancer FModel, recharger l'archive.
2. Refaire les exports listés ci-dessus (mêmes assets).
3. Côté WSL : relancer le pipeline (voir README du package pipeline, Phase 2).
