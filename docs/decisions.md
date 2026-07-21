# Registre de décisions

## 2026-07-21 — Coffres sur la carte

**Constat** : les coffres ne sont dans aucune DataTable — ce sont des acteurs
spawners placés dans ~10 000 cellules World Partition, par biome et grade
(`BP_PalMapObjectSpawner_Treasure_Forest_Grade_01`, `_Volcano_Grade_02`, etc.),
à réapparition périodique. Aucun dataset communautaire ouvert de leurs
positions (contrairement aux effigies). Sources : catrenelle/PalDex NOTES.md,
arkive-games/arkive `maps/extract.py`.
**Décision** : (c) **reportés hors v1**. Réévaluable plus tard via un scan des
cellules umap avec l'outillage arkive si le besoin se confirme.
**Conséquence** : la carte v1 affiche effigies, boss Alpha, donjons, voyage
rapide, tours. `transform/markers.ts` (Phase 2) n'a pas de type `chest`.

## 2026-07-21 — Format des clés L10N

**Constat** : tables de texte sous `Pal/Content/L10N/{en,fr}/Pal/DataTable/Text/`,
clés préfixées par domaine (ex. `PAL_NAME_<CodeName>` dans
`DT_PalNameText_Common`), texte dans `TextData.LocalizedString`. Les variantes
de Pals (RAID_, SUMMON_, GYM_…) n'ont pas d'entrée propre : 309 Pals nommés
pour 753 lignes dans `DT_PalMonsterParameter`.
**Conséquence** : règle de jointure de `transform/l10n.ts` (Phase 2) :
`<PREFIXE>_<id>` → `TextData.LocalizedString`, par table et par locale.

## 2026-07-21 — Tables v1.0+ éclatées (CompositeDataTable)

**Constat** : beaucoup de tables existent en deux assets `DT_Xxx` (composite,
Rows parfois vide) + `DT_Xxx_Common` (données). Les exports nécessitent des
mappings `.usmap` à jour (source : PalworldModding/UsefulFiles — ceux
d'elliotks/Palworld-FModel, pré-1.0, produisent des Rows vides).
**Conséquence** : le pipeline fusionne les Rows de toutes les variantes d'une
table (implémenté dans `spike/lib.ts`, à reprendre en Phase 2). Runbook mis à
jour avec la source de mappings.

## 2026-07-21 — IDs stables des boss Alpha

**Constat** : `DT_BossSpawnerLoactionData` (la faute « Loaction » est dans le
nom réel) a des lignes indexées `0..158` — l'index n'est PAS stable. Chaque
ligne porte `SpawnerID` (ex. `yamijima_IceLand_pink_D_BOSS`), `CharacterID`,
`Location{X,Y,Z}`, `Level`.
**Conséquence** : `transform/markers.ts` (Phase 2) utilise `SpawnerID` comme ID
de marqueur, jamais l'index de ligne.

## 2026-07-21 — Effigies : source communautaire

**Constat** : les effigies sont des acteurs de level (pas de DataTable).
oMaN-Rod/palworld-save-pal publie `data/json/effigies.json` : 153 entrées
GUID (`LevelObjectInstanceId`) → coordonnées monde. 109 sur l'île principale,
44 hors bornes de base (îles DLC) — la grille monde est unique, les constantes
de transformation `worldToMap` s'appliquent partout.
**Conséquence** : Phase 2 importe ce dataset (vérifier la licence du repo et
créditer) ; les GUID sont ceux que les saves référencent → corrélation d'import
de save attendue directe (à confirmer en Task 7).
