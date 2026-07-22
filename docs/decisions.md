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

## 2026-07-21 — Format de save PlM et outillage de conversion

**Constat** : les saves du serveur (v1.0+) portent le magic `PlM` (Oodle) ;
`palworld-save-tools` PyPI/GitHub (PlZ, zlib) échoue. Le fork `palsav` de
deafdudecomputers/PalworldSaveTools + `palooz` (ooz compilé localement)
convertit correctement (runbook, section « Convertir une save serveur »).
**Conséquence** : le parseur TS « maison » prévu en Phase 5 est redimensionné —
décompression Oodle non triviale en pur TS. Options pour la Phase 5 : (a)
sous-processus Python (palsav) derrière l'endpoint d'import — impossible sur
Vercel, donc import exécuté côté opérateur (script CLI local qui POST le
résultat), ou (b) portage/binding ooz en WASM. Décision à prendre au plan de
Phase 5 ; le spike valide en tout cas le contenu.

## 2026-07-21 — Contenu de RecordData (save joueur) et corrélation

**Constat** (save réelle du serveur) : `RecordData` contient notamment
`PaldeckUnlockFlag` (41), `PalCaptureCount`/`PalCaptureBonusCount` (compteurs
10/10), `RelicObtainForInstanceFlag` (GUIDs — **2/2 retrouvés dans
effigies.json : corrélation directe confirmée**),
`NoteObtainForInstanceFlag`, `FastTravelPointUnlockFlag`,
`TowerBossDefeatFlag`, `NormalBossDefeatFlag`, compteurs de donjons. Les
technologies débloquées sont ailleurs : `SaveData.UnlockedRecipeTechnologyNames`.
**Conséquence** : l'import de save peut couvrir Paldex, technos ET collectibles
carte (effigies/notes/voyages rapides/boss) — le repli « pals+technos seulement »
n'est pas nécessaire.

## 2026-07-21 — Couverture du dataset d'effigies

**Constat** : effigies.json (save-pal) = 153 entrées ; le wiki annonce 605
effigies en v1.0+ (toutes îles). Le dataset est donc partiel (probablement
île principale, pré-DLC).
**Conséquence** : Phase 2 doit regénérer le dataset complet via un scan des
cellules umap (outillage type arkive) ou une source plus récente. Les 153
suffisent pour développer la mécanique.

## 2026-07-21 — Validation visuelle des coordonnées : différée en Phase 3

**Constat** : aucune source publique de coordonnées d'effigies pour un
recoupement numérique (carte interactive du wiki = stub vide). Validation
interne : 109/153 effigies dans les bornes de l'île principale, le reste en
zones DLC — cohérent ; grille monde unique confirmée par les positions des
boss DLC.
**Conséquence** : la validation fine se fera en Phase 3 au premier rendu des
marqueurs sur les tuiles réelles (un décalage systématique y serait flagrant).
Risque résiduel : faible. Au passage : MapCollectablesMod publie
`TeleportCoordinates.json` (voyages rapides, open source) — utile en Phase 2.

## 2026-07-21 — Divers Phase 0

- `T_TreeMap` (carte Arbre-Monde) non exporté — à faire à la prochaine session
  FModel, non bloquant.
- Le script `spike:chests` prévu au plan n'a pas été écrit : la table qu'il
  devait inspecter n'existe pas (constat établi par recherche communautaire,
  décision coffres prise sans lui).

## 2026-07-22 — Préfixes L10N réels (Phase 2)

**Constat** : `DT_SkillNameText` mélange `ACTION_SKILL_`, `PASSIVE_`,
`PARTNERSKILL_`, `COOP_` ; technologies sous `NAME_`/`DESC_` (ids de la forme
`RECIPE_XXX`) ; constructions sous `MAPOBJECT_NAME_` ; descriptions de Pals
dans `DT_PalLongDescriptionText` (sans variante _Common), préfixe
`PAL_LONG_DESC_`.
**Conséquence** : namespaces de sortie `skill:`, `passive:`, `partnerskill:`
en plus de `pal:`/`item:`/`tech:`/`building:` (transform/l10n.ts).

## 2026-07-22 — Stations de craft : report

**Constat** : `DT_MapObjectItemProductDataTable` ne couvre que la production
automatique (16 lignes) ; l'attribution recette→station vit dans les
blueprints des stations, non extractible proprement.
**Décision** : la section Craft groupe par niveau de technologie. Station
ajoutable plus tard si une source fiable émerge.

## 2026-07-22 — Trou de données : WindChimes (Hangyu) — RÉSOLU

**Constat** (spike d'import Phase 5) : le pal `WindChimes` (Hangyu) est présent
dans les saves et dans icons.json/l10n mais absent de pals.json — le filtre du
transform (ZukanIndex>0 + nom + IsPal) l'exclut à tort. Sa capture ne peut donc
pas être fusionnée par l'import.
**Cause** : divergence de casse entre l'id paramètre (`WindChimes`) et la clé de
nom (`PAL_NAME_Windchimes`). **Corrigé** : comparaison insensible à la casse
dans transform/pals.ts + recopie des clés l10n `pal:` sous la casse du paramètre
(transform/l10n.ts). pals.json passe de 286 à 288 entrées (WindChimes,
WindChimes_Ice). Les captures seront fusionnées au prochain passage du cron
import-saves. Note : le Paldex du jeu compte 204 numéros / ~303 formes — un
total « 400+ » compte les doublons boss/raid/tour/plateforme, pas des pals.

## 2026-07-22 — Pseudos in-game : Level.sav plutôt que l'API REST

**Constat** : l'hébergeur (OuiHeberg) n'expose pas le port REST 8212 (seul le
port de jeu est mappé) ; et le Level.sav du serveur ne pèse que 2 Mo (~2 s de
conversion palsav), contenant les pseudos de TOUS les joueurs
(CharacterSaveParameterMap → IsPlayer → NickName + PlayerUId).
**Décision** : les pseudos sont extraits de Level.sav (téléchargé en SFTP avec
les saves), pas de l'API REST. Normalisation GUID : UUID → 32 hex majuscules
sans tirets (format des noms de fichiers Players/).

## 2026-07-22 — Transform de coordonnées v1.0 et périmètre carte

**Constat** : les constantes /459 (Phase 0) sont le transform PRÉ-1.0. Le
transform actuel (source : PalworldSaveTools/palworld_coord, variante « new ») :
`gameX = (worldY + 18) / 725`, `gameY = (worldX + 375247) / 725` ; la texture
T_WorldMap couvre la plage in-game [-1000, 1000]². Les POI hors plage (39 :
Arbre-Monde/remains) relèvent de T_TreeMap — carte séparée, hors v1.
**Sources marqueurs** : effigies = save-pal effigies.json (138 sur carte
principale) ; boss = DT_BossSpawnerLoactionData (152) ; voyage rapide =
PalworldSaveTools fast_travel_points.json (157, noms via
DT_MapRespawnPointInfoText → ft:). TeleportCoordinates.json (MapCollectablesMod)
écarté : grille artificielle, pas des statues réelles. Donjons : pas de
positions fixes en DataTable — hors v1.

## 2026-07-22 — Icônes d'items par IconName + purge des placeholders L10N

**Constat** : seuls 806/1965 items résolvaient une icône — le web cherchait
`item:<id>` alors que icons.json est indexé par ligne de DT_ItemIconDataTable
(= IconName) : les variantes (Accessory_AquaResist_1/_2/_3…) partagent l'icône
de leur base. Par ailleurs les entrées L10N non traduites portent le
placeholder littéral `fr_Text`/`en Text`, qui court-circuitait le fallback
FR→EN→id (des items affichaient « fr_Text »).
**Décisions** :
- icons.ts (pipeline) ajoute une passe d'alias `item:<id> -> <basename .webp>`
  (valeur **string** dans icons.json, `true` sinon) : lookup IconName insensible
  à la casse + renvois manuels par id (cannes à pêche → FishingRod_1/2/4/6).
  Le web (lib/game/icons.ts) suit les alias. 1866/1875 items résolus ; les 9
  restants (Antibiotic_*, LightzHelmet, NightVisionGoggles, Potage, Propellant,
  SkyHeavyBullet/SkyLightBullet) n'ont AUCUNE texture dans l'export — tolérés.
- l10n.ts ignore les placeholders `xx_Text`/`xx Text` (helper isL10nPlaceholder
  dans lib.ts) ; items.ts exclut les items dont le nom EN est un placeholder
  (90 ids debug/inutilisés retirés d'items.json, régénéré avec
  ALLOW_ID_REMOVALS=1 — aucun n'est matériau de recette ni drop de pal).
