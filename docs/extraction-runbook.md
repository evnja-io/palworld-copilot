# Runbook d'extraction — FModel (Windows)

Statut : v0 (Phase 0). Les chemins d'assets exacts seront confirmés pendant le
spike et corrigés ici.

## Installation (une fois)

1. Installer le runtime « .NET Desktop Runtime 8 » si absent.
2. Télécharger FModel : https://fmodel.app → dézipper, lancer `FModel.exe`.
3. Au premier lancement, ajouter le jeu : Directory selector →
   `C:\Program Files (x86)\Steam\steamapps\common\Palworld`.
4. Settings → General : UE Versions = `GAME_UE5_1`.
5. Récupérer sur https://github.com/elliotks/Palworld-FModel :
   - le fichier `.usmap` (mappings) → Settings → Advanced → Mappings file path ;
   - la clé AES → Directory → AES Keys → coller la clé principale.
6. Créer `C:\PalExports`. Settings → General → Output Directory = `C:\PalExports`.
7. Charger l'archive : onglet Archives → double-clic sur `Pal-Windows.pak`.
   ⚠️ Le pak fait 38 Go : la première indexation prend plusieurs minutes.

## Exporter une DataTable en JSON

Naviguer dans l'arborescence (onglet Folders) → clic droit sur l'asset →
**Save Properties (.json)**. Le JSON atterrit sous
`C:\PalExports\Exports\Pal\Content\...` en miroir du chemin d'asset.

## Exporter une texture en PNG

Clic droit sur l'asset texture → **Save Texture (.png)**.

## Où chercher (à confirmer pendant le spike)

- DataTables : `Pal/Content/Pal/DataTable/` (sous-dossiers par domaine).
  Croiser avec les noms d'assets cités dans le code de
  https://github.com/oMaN-Rod/palworld-save-pal et
  https://github.com/blaynem/paldex si un nom ne saute pas aux yeux.
- Localisation : `Pal/Content/L10N/en/` et `Pal/Content/L10N/fr/`
  (DataTables de texte : noms de Pals, d'items, descriptions…).
- Carte du monde : `Pal/Content/Pal/Texture/UI/Map/T_WorldMap`.
  Chercher aussi les textures des îles DLC (Sakurajima, Feybreak) dans le même
  voisinage — noter leurs chemins exacts ici.

## Rapatrier vers WSL

Rien à copier : le dépôt lit directement `/mnt/c/PalExports`. Les scripts du
projet pointent dessus via la variable d'environnement `RAW_DIR`
(défaut : `/mnt/c/PalExports/Exports`).

## À chaque mise à jour du jeu

1. Steam met à jour le pak → relancer FModel, recharger l'archive.
2. Refaire les exports listés ci-dessus (mêmes assets).
3. Côté WSL : relancer le pipeline (voir README du package pipeline, Phase 2).
