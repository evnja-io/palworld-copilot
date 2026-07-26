# Registre de décisions

## 2026-07-21 - Coffres sur la carte

**Constat** : les coffres ne sont dans aucune DataTable - ce sont des acteurs
spawners placés dans ~10 000 cellules World Partition, par biome et grade
(`BP_PalMapObjectSpawner_Treasure_Forest_Grade_01`, `_Volcano_Grade_02`, etc.),
à réapparition périodique. Aucun dataset communautaire ouvert de leurs
positions (contrairement aux effigies). Sources : catrenelle/PalDex NOTES.md,
arkive-games/arkive `maps/extract.py`.
**Décision** : (c) **reportés hors v1**. Réévaluable plus tard via un scan des
cellules umap avec l'outillage arkive si le besoin se confirme.
**Conséquence** : la carte v1 affiche effigies, boss Alpha, donjons, voyage
rapide, tours. `transform/markers.ts` (Phase 2) n'a pas de type `chest`.

## 2026-07-21 - Format des clés L10N

**Constat** : tables de texte sous `Pal/Content/L10N/{en,fr}/Pal/DataTable/Text/`,
clés préfixées par domaine (ex. `PAL_NAME_<CodeName>` dans
`DT_PalNameText_Common`), texte dans `TextData.LocalizedString`. Les variantes
de Pals (RAID_, SUMMON_, GYM_…) n'ont pas d'entrée propre : 309 Pals nommés
pour 753 lignes dans `DT_PalMonsterParameter`.
**Conséquence** : règle de jointure de `transform/l10n.ts` (Phase 2) :
`<PREFIXE>_<id>` → `TextData.LocalizedString`, par table et par locale.

## 2026-07-21 - Tables v1.0+ éclatées (CompositeDataTable)

**Constat** : beaucoup de tables existent en deux assets `DT_Xxx` (composite,
Rows parfois vide) + `DT_Xxx_Common` (données). Les exports nécessitent des
mappings `.usmap` à jour (source : PalworldModding/UsefulFiles - ceux
d'elliotks/Palworld-FModel, pré-1.0, produisent des Rows vides).
**Conséquence** : le pipeline fusionne les Rows de toutes les variantes d'une
table (implémenté dans `spike/lib.ts`, à reprendre en Phase 2). Runbook mis à
jour avec la source de mappings.

## 2026-07-21 - IDs stables des boss Alpha

**Constat** : `DT_BossSpawnerLoactionData` (la faute « Loaction » est dans le
nom réel) a des lignes indexées `0..158` - l'index n'est PAS stable. Chaque
ligne porte `SpawnerID` (ex. `yamijima_IceLand_pink_D_BOSS`), `CharacterID`,
`Location{X,Y,Z}`, `Level`.
**Conséquence** : `transform/markers.ts` (Phase 2) utilise `SpawnerID` comme ID
de marqueur, jamais l'index de ligne.

## 2026-07-21 - Effigies : source communautaire

**Constat** : les effigies sont des acteurs de level (pas de DataTable).
oMaN-Rod/palworld-save-pal publie `data/json/effigies.json` : 153 entrées
GUID (`LevelObjectInstanceId`) → coordonnées monde. 109 sur l'île principale,
44 hors bornes de base (îles DLC) - la grille monde est unique, les constantes
de transformation `worldToMap` s'appliquent partout.
**Conséquence** : Phase 2 importe ce dataset (vérifier la licence du repo et
créditer) ; les GUID sont ceux que les saves référencent → corrélation d'import
de save attendue directe (à confirmer en Task 7).

## 2026-07-21 - Format de save PlM et outillage de conversion

**Constat** : les saves du serveur (v1.0+) portent le magic `PlM` (Oodle) ;
`palworld-save-tools` PyPI/GitHub (PlZ, zlib) échoue. Le fork `palsav` de
deafdudecomputers/PalworldSaveTools + `palooz` (ooz compilé localement)
convertit correctement (runbook, section « Convertir une save serveur »).
**Conséquence** : le parseur TS « maison » prévu en Phase 5 est redimensionné -
décompression Oodle non triviale en pur TS. Options pour la Phase 5 : (a)
sous-processus Python (palsav) derrière l'endpoint d'import - impossible sur
Vercel, donc import exécuté côté opérateur (script CLI local qui POST le
résultat), ou (b) portage/binding ooz en WASM. Décision à prendre au plan de
Phase 5 ; le spike valide en tout cas le contenu.

## 2026-07-21 - Contenu de RecordData (save joueur) et corrélation

**Constat** (save réelle du serveur) : `RecordData` contient notamment
`PaldeckUnlockFlag` (41), `PalCaptureCount`/`PalCaptureBonusCount` (compteurs
10/10), `RelicObtainForInstanceFlag` (GUIDs - **2/2 retrouvés dans
effigies.json : corrélation directe confirmée**),
`NoteObtainForInstanceFlag`, `FastTravelPointUnlockFlag`,
`TowerBossDefeatFlag`, `NormalBossDefeatFlag`, compteurs de donjons. Les
technologies débloquées sont ailleurs : `SaveData.UnlockedRecipeTechnologyNames`.
**Conséquence** : l'import de save peut couvrir Paldex, technos ET collectibles
carte (effigies/notes/voyages rapides/boss) - le repli « pals+technos seulement »
n'est pas nécessaire.

## 2026-07-21 - Couverture du dataset d'effigies

**Constat** : effigies.json (save-pal) = 153 entrées ; le wiki annonce 605
effigies en v1.0+ (toutes îles). Le dataset est donc partiel (probablement
île principale, pré-DLC).
**Conséquence** : Phase 2 doit regénérer le dataset complet via un scan des
cellules umap (outillage type arkive) ou une source plus récente. Les 153
suffisent pour développer la mécanique.

## 2026-07-21 - Validation visuelle des coordonnées : différée en Phase 3

**Constat** : aucune source publique de coordonnées d'effigies pour un
recoupement numérique (carte interactive du wiki = stub vide). Validation
interne : 109/153 effigies dans les bornes de l'île principale, le reste en
zones DLC - cohérent ; grille monde unique confirmée par les positions des
boss DLC.
**Conséquence** : la validation fine se fera en Phase 3 au premier rendu des
marqueurs sur les tuiles réelles (un décalage systématique y serait flagrant).
Risque résiduel : faible. Au passage : MapCollectablesMod publie
`TeleportCoordinates.json` (voyages rapides, open source) - utile en Phase 2.

## 2026-07-21 - Divers Phase 0

- `T_TreeMap` (carte Arbre-Monde) non exporté - à faire à la prochaine session
  FModel, non bloquant.
- Le script `spike:chests` prévu au plan n'a pas été écrit : la table qu'il
  devait inspecter n'existe pas (constat établi par recherche communautaire,
  décision coffres prise sans lui).

## 2026-07-22 - Préfixes L10N réels (Phase 2)

**Constat** : `DT_SkillNameText` mélange `ACTION_SKILL_`, `PASSIVE_`,
`PARTNERSKILL_`, `COOP_` ; technologies sous `NAME_`/`DESC_` (ids de la forme
`RECIPE_XXX`) ; constructions sous `MAPOBJECT_NAME_` ; descriptions de Pals
dans `DT_PalLongDescriptionText` (sans variante _Common), préfixe
`PAL_LONG_DESC_`.
**Conséquence** : namespaces de sortie `skill:`, `passive:`, `partnerskill:`
en plus de `pal:`/`item:`/`tech:`/`building:` (transform/l10n.ts).

## 2026-07-22 - Stations de craft : report

**Constat** : `DT_MapObjectItemProductDataTable` ne couvre que la production
automatique (16 lignes) ; l'attribution recette→station vit dans les
blueprints des stations, non extractible proprement.
**Décision** : la section Craft groupe par niveau de technologie. Station
ajoutable plus tard si une source fiable émerge.

## 2026-07-22 - Trou de données : WindChimes (Hangyu) - RÉSOLU

**Constat** (spike d'import Phase 5) : le pal `WindChimes` (Hangyu) est présent
dans les saves et dans icons.json/l10n mais absent de pals.json - le filtre du
transform (ZukanIndex>0 + nom + IsPal) l'exclut à tort. Sa capture ne peut donc
pas être fusionnée par l'import.
**Cause** : divergence de casse entre l'id paramètre (`WindChimes`) et la clé de
nom (`PAL_NAME_Windchimes`). **Corrigé** : comparaison insensible à la casse
dans transform/pals.ts + recopie des clés l10n `pal:` sous la casse du paramètre
(transform/l10n.ts). pals.json passe de 286 à 288 entrées (WindChimes,
WindChimes_Ice). Les captures seront fusionnées au prochain passage du cron
import-saves. Note : le Paldex du jeu compte 204 numéros / ~303 formes - un
total « 400+ » compte les doublons boss/raid/tour/plateforme, pas des pals.

## 2026-07-22 - Pseudos in-game : Level.sav plutôt que l'API REST

**Constat** : l'hébergeur (OuiHeberg) n'expose pas le port REST 8212 (seul le
port de jeu est mappé) ; et le Level.sav du serveur ne pèse que 2 Mo (~2 s de
conversion palsav), contenant les pseudos de TOUS les joueurs
(CharacterSaveParameterMap → IsPlayer → NickName + PlayerUId).
**Décision** : les pseudos sont extraits de Level.sav (téléchargé en SFTP avec
les saves), pas de l'API REST. Normalisation GUID : UUID → 32 hex majuscules
sans tirets (format des noms de fichiers Players/).

## 2026-07-22 - Transform de coordonnées v1.0 et périmètre carte

**Constat** : les constantes /459 (Phase 0) sont le transform PRÉ-1.0. Le
transform actuel (source : PalworldSaveTools/palworld_coord, variante « new ») :
`gameX = (worldY + 18) / 725`, `gameY = (worldX + 375247) / 725` ; la texture
T_WorldMap couvre la plage in-game [-1000, 1000]². Les POI hors plage (39 :
Arbre-Monde/remains) relèvent de T_TreeMap - carte séparée, hors v1.
**Sources marqueurs** : effigies = save-pal effigies.json (138 sur carte
principale) ; boss = DT_BossSpawnerLoactionData (152) ; voyage rapide =
PalworldSaveTools fast_travel_points.json (157, noms via
DT_MapRespawnPointInfoText → ft:). TeleportCoordinates.json (MapCollectablesMod)
écarté : grille artificielle, pas des statues réelles. Donjons : pas de
positions fixes en DataTable - hors v1.

## 2026-07-22 - Icônes d'items par IconName + purge des placeholders L10N

**Constat** : seuls 806/1965 items résolvaient une icône - le web cherchait
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
  SkyHeavyBullet/SkyLightBullet) n'ont AUCUNE texture dans l'export - tolérés.
- l10n.ts ignore les placeholders `xx_Text`/`xx Text` (helper isL10nPlaceholder
  dans lib.ts) ; items.ts exclut les items dont le nom EN est un placeholder
  (90 ids debug/inutilisés retirés d'items.json, régénéré avec
  ALLOW_ID_REMOVALS=1 - aucun n'est matériau de recette ni drop de pal).

## 2026-07-22 - Variantes d'équipement par rareté : résolution OverrideName

**Constat** : les variantes `_2.._5` des armes/armures (Rarity 1..4) n'ont pas
d'entrée L10N propre - le jeu résout leur nom/description via
`OverrideName`/`OverrideDescription` (clé de l'item de base). Le pipeline les
ignorait : absentes d'items.json mais leurs recettes restaient dans
recipes.json → la page Craft affichait les ids bruts (Head005_2,
YakushimaHeadEquip002_4…).
**Décision** : l10n.ts matérialise la résolution OverrideName/Description ;
items.ts encyclopédise les variantes dont l'override résout (items.json
1875 → 2344, rareté distinctive déjà émise) ; les recettes d'un produit
toujours non nommable sont écartées (6 : FlameThrower jamais nommé + Hotmilk
sans ligne d'item). Icônes déjà couvertes par la passe d'alias IconName.

## 2026-07-25 - Mode invité : tout le produit sans compte, en URL propre

**Constat** : tout vivait sous `routes/s/[slug]/`, dont le layout redirigeait
tout anonyme vers `/login`. Or 5 pages sur 13 ne touchent jamais la base et 4
autres seulement pour une case à cocher. Conséquence : aucune page de contenu
(288 pals, 2344 objets, 498 constructions) n'était accessible ni indexable.
**Décision** : ouvrir toutes les fonctionnalités aux visiteurs, ne garder
derrière le login que la **synchro de sauvegarde** (SFTP, upload, revendication
de GUID, réglages, invitations, tableau de bord, progression *de groupe*).

**Mécanique retenue** :
- **Sentinelle `__guest` + hook `reroute`** (`src/hooks.ts`, `src/lib/guest.ts`) :
  `/paldex` est résolu en interne vers `/s/__guest/paldex`. **Un seul arbre de
  routes**, zéro fichier dupliqué, donc les deux modes ne peuvent pas diverger.
  `generateSlug()` tire dans BASE62 (sans `_`) : la sentinelle ne peut jamais
  collisionner avec un slug réel. Kit n'utilise la valeur de retour que pour
  résoudre la route (`respond.js`) : `page.url` reste l'URL affichée, donc
  `page.route.id === '/s/[slug]/map'` continue de fonctionner.
- **Liste blanche `GUEST_FEATURES`**, pas de liste noire : `/`, `/docs`,
  `/servers`, `/join`, `/api`, `/s/*` et les assets ne demandent aucune règle,
  et une future route ne peut pas devenir tenant par accident. La même constante
  pilote le reroute ET la nav du shell invité.
- **Union discriminée `mode: 'guest' | 'member'`** renvoyée par
  `s/[slug]/+layout.server.ts`, avec le même jeu de clés dans les deux branches.
  `OptionalUnion` des types générés distribue sur les unions, donc `svelte-check`
  a énuméré exactement les 8 loads à traiter. **Piège** : `Omit<union, K>` n'est
  pas distributif, donc dans un `+page.svelte` `data.mode` ne restreint pas
  `data.server` — le tableau de bord et les réglages ré-exposent `user`/`server`
  depuis leur propre load.
- **localStorage comme source de vérité invité** (`lib/game/localProgress.ts`,
  une clé par kind), branché dans `ProgressStore` sans changer son API publique :
  les 4 appelants, `MarkerPopup` et `GroupAvatars` sont intouchés. `group = {}`
  fait disparaître les avatars par construction. En mode local, `startSync()`
  écoute `storage` au lieu d'un poll 60 s (parité multi-onglets, zéro requête).
- **Croisement** : type `ParentView` partagé, auquel `PalInstance` est
  structurellement assignable. Les deux sources d'entrée (instances importées /
  saisie manuelle) alimentent le même calcul et le **même bloc de résultat**,
  sans faux `instanceId`. Le sélecteur d'espèce/passifs réutilise `TeamPicker`.
  Le mode `path` d'un invité part de ses pals cochés au Paldex.
- **Locale dans l'URL sur les pages publiques** : `strategy: ['url', …]` +
  `routeStrategies` qui rebascule `/s/*`, `/servers`, `/join` sur le cookie et
  exclut `/api`, `/ingest`. Les `urlPatterns` par défaut de Paraglide décrivaient
  déjà le découpage voulu (FR sans préfixe, EN sous `/en/`). Paraglide possédant
  `reroute` en stratégie URL, les deux se **composent** :
  `deLocalizeUrl` puis `guestTarget` — et le hook renvoie toujours le chemin
  dé-localisé, jamais `undefined`, sinon `/en/docs` ne résoudrait pas.

**Conséquences / non-objectifs** :
- Les pages tenant portent `noindex` ; les pages publiques sont les canoniques.
- **Pas de prérendu** : ces pages vivent sous le layout tenant dont le load est
  dynamique (cookies). Le SSR suffit à l'indexation ; le levier si le trafic
  invité grossit est un `Cache-Control`, pas une restructuration de routes.
- La progression invité est vide au rendu serveur et apparaît à l'hydratation
  (même comportement que `mapState.restore()`), ce qui est **souhaitable** pour
  un crawler : il voit le contenu statique, sans état utilisateur.
- `LangSwitch` n'a eu besoin d'aucune modification : `setLocale` de Paraglide 2.22
  consulte déjà `getStrategyForUrl` et navigue via `localizeUrl`.
- Étape 1B (métadonnées par page, sitemap, robots.txt) et étape 2 (équipes
  locales + import à l'inscription) restent à faire.

## 2026-07-25 - Indexabilité : métadonnées par entité, hreflang, sitemap

**Constat** : après l'ouverture aux invités, les pages de contenu étaient
accessibles mais invisibles. Aucune n'avait de `<svelte:head>` : ni titre, ni
description, ni canonical, ni Open Graph. Pas de sitemap, et `robots.txt`
autorisait tout sans rien indiquer.

**Décision** :
- **Composant unique `lib/components/Seo.svelte`** (titre, description,
  canonical, paire hreflang fr/en/x-default, Open Graph, Twitter card), posé sur
  les 9 pages liste, les 3 types de page de détail, la landing et `/docs`.
  Prop `indexable` : à `false` sur les pages tenant, où le layout émet déjà
  `noindex` — y ajouter un canonical vers la page publique enverrait un signal
  contradictoire.
- **`lib/seo.ts`** : `SITE_URL` en dur et `absoluteUrl()` via `localizeUrl`
  plutôt que `localizeHref`, pour que canonical/hreflang/sitemap désignent la
  même URL depuis un preview Vercel, en local ou en production.
- **`isGuestContext()`** (lib/nav.ts) plutôt que `data.mode` : les pages
  items/craft/buildings n'ont aucun load, donc pas de `data` — le mode se lit
  depuis l'URL.

**Descriptions par entité, et le vrai problème du contenu mince** :
- Pals : les 288 ont une description de jeu exploitable. Utilisée telle quelle.
- Objets : ~2220/2344. Une garde `usableDesc()` écarte les placeholders l10n —
  certaines entrées ne contiennent que le nom de l'objet
  (`item:AnimalSkin` → « Animal Skin »), ce qui donnerait une meta de 11
  caractères, pire qu'un gabarit.
- **Constructions : AUCUNE n'a de description** (le namespace `building:`
  n'existe pas dans l10n). La description est donc composée à partir des
  **matériaux requis**, seule donnée qui distingue réellement les 498 pages.
  Le nom se résout via `mapObjectId` et non `id` : les deux diffèrent pour 6
  constructions (CampFire → Campfire, Stone_pillar → Stone_Pillar…).
- Les variantes de rareté `_2.._5` étaient le risque de duplication supposé
  (1039 objets sur 2344), mais la plupart ont noms ET descriptions distincts.
  Après mesure, seuls **18 groupes / 87 pages** produisaient des metas
  identiques (Head001..Head001_5 partagent « Couronne royale » sans
  description) ; la rareté suffit à distinguer 17 de ces 18 groupes, donc le
  gabarit de repli la mentionne.

**Sitemap** : `routes/sitemap.xml/+server.ts`, `prerender = true` (liste
entièrement dérivée de game-data ; vit hors de `/s/[slug]`, donc aucun conflit
avec le layout tenant non prérenderable). 6 278 URLs = 3 139 chemins × 2
locales, chacune annotée de ses alternates — **le même jeu que les balises
`<head>`, x-default compris** : une divergence entre les deux invaliderait
l'annotation. 2,5 Mo, très en dessous des limites de 50 Mo / 50 000 URLs.
Se périme après une mise à jour du jeu : un redéploiement suffit.

**`robots.txt`** : `Disallow` sur `/s/`, `/api/`, `/ingest/`, `/servers`,
`/join/`, `/login`, `/logout` (les pages tenant redirigent déjà les anonymes et
portent `noindex` ; c'est du budget de crawl épargné), plus la ligne `Sitemap:`.

**Non-objectifs** : pas de JSON-LD (à réévaluer seulement si les rich results
deviennent un objectif), pas de prérendu des pages publiques (cf. l'entrée
précédente).

## 2026-07-25 - Équipes locales et reprise du travail invité

**Constat** : le mode invité couvrait la consultation et le suivi de
progression, mais le team builder restait fermé — et rien ne récupérait le
travail d'un visiteur qui finissait par créer un serveur.

**Décision** :
- **Équipes en localStorage** (`lib/game/localTeams.ts`, clé `guest-teams-v1`,
  plafond 20). Une seule clé plutôt qu'une par équipe : les écritures restent
  atomiques. Le contenu des slots n'est PAS validé à la lecture (seule la forme
  l'est) — la validation des ids est le rôle du serveur, à l'import.
- **`TeamEditorStore` gagne un backend local** dans `save()`, avec les mêmes
  contraintes (nom trimé, 1-80 caractères) et le **même réalignement
  post-sauvegarde** que la réponse serveur, pour que l'éditeur se comporte à
  l'identique dans les deux modes. `crypto.randomUUID()` produit un v4, donc
  accepté par `src/params/uuid.ts` : l'URL `/teams/<uuid>` fonctionne.
- **Résolution de l'équipe déplacée du composant vers la page.**
  `TeamEditorScreen` reçoit désormais une équipe concrète en prop ; c'est
  `+page.svelte` qui la résout (base pour un membre, localStorage au montage
  pour un invité) et ne monte l'écran que `{#if team}`, sous le `{#key teamId}`
  existant. Le store est donc instancié une seule fois, sur une équipe connue.
  Un `error(404)` côté load serait faux pour un invité : le serveur ne peut pas
  savoir. Équipe introuvable => retour à la liste.
- **`/teams` est accessible mais NON indexable** (`GUEST_NOINDEX`) : c'est un
  espace de travail personnel, vide par définition pour un visiteur. Il reste
  dans `GUEST_FEATURES` (reroute + nav) mais est exclu du sitemap et porte
  `noindex`. Sans cette distinction, le sitemap aurait pointé vers une page sans
  canonical ni hreflang.

**Reprise du travail (`/api/servers/[slug]/guest-import`)** :
- **Surface : une bannière dans la branche membre du shell**, seule à couvrir
  les DEUX entonnoirs — création (`/servers/new` → `/s/<slug>/setup`) et
  adhésion (`/join/<code>` → `/s/<slug>`) — plus « je me connecte plus tard
  depuis n'importe quelle page ». Aucun des deux assistants n'a été touché.
- **Toute la validation avant la moindre écriture**, extraite dans
  `lib/server/guestImport.ts` : ces données viennent du navigateur, donc de
  l'utilisateur. Progression filtrée au registre (`isValidEntity`), plafonnée,
  dédupliquée ; kinds hors registre ignorés (`__proto__` compris). Équipes
  passées par `validateTeamInput`, donc mêmes gardes que l'API teams (ids,
  longueurs, clés exactes, pollution de prototype). L'extraction rend ce
  périmètre **testable sans base** — 15 tests unitaires, alors que l'endpoint
  lui-même exige une session.
- **Fusion additive, jamais de suppression** : `onConflictDoNothing` par lots de
  500 (Neon HTTP n'a pas de transaction). Réexécuter l'appel est sans effet.
- Les ids locaux ne sont **jamais** réutilisés : `createTeam` réémet les siens.
- `createTeam` lève un 403 au-delà de `MAX_TEAMS_PER_SERVER` ; faute de
  transaction, on rend compte de ce qui est réellement passé (`teamsTruncated`)
  plutôt que de faire échouer tout l'appel après avoir déjà écrit la
  progression.
- Purge du stockage local **seulement après un succès confirmé** ; « Plus tard »
  mémorise le slug (`guest-import-dismissed-v1`) mais **conserve** les données,
  pour qu'un autre serveur puisse encore les recevoir.

**Non vérifié de bout en bout** : le chemin membre (bannière, endpoint réel,
redirection `/paldex` → `/s/<slug>/paldex`) demande une session Discord. Les
gardes sont confirmées (401 sans session, 405 sur GET) et la validation est
couverte par tests, mais le parcours d'import lui-même reste à valider une fois
connecté.

## 2026-07-25 - Un seul en-tête pour toute la surface publique

**Constat** (audit `improve-ui`, plans dans `design-plans/`) : l'ouverture aux
invités avait laissé trois en-têtes pour un même visiteur anonyme dans une même
tâche. Mesuré sur le rendu :
- `/` n'avait qu'un sélecteur de langue en `position: absolute` — ni marque
  cliquable, ni navigation, ni connexion ;
- `/docs`, pourtant publiée au sitemap avec canonical et hreflang donc porte
  d'entrée depuis la recherche, ne contenait **qu'un seul lien interne** (`/`) ;
- la coquille invité empilait marque + 8 liens + recherche + Discord + langue +
  CTA dans une rangée de 52 px : **89 px de navigation tronquée à 1280 px**, et
  **146 px de haut (17 % du viewport) sur 3 rangées à 390 px**.

La cause n'était pas trois oublis mais **l'absence de propriétaire** : le seul
en-tête complet vivait à l'intérieur du layout tenant, donc inaccessible aux
routes publiques hors `/s/[slug]`.

**Décision** :
- **`lib/components/AppHeader.svelte` est le propriétaire unique**, consommé par
  la coquille tenant (invité et membre), `/` et `/docs`. `LangSwitch` n'a plus
  qu'un seul point de montage dans tout le dépôt.
- **La rangée principale est réservée à la navigation produit** (marque ou
  sélecteur de serveur · nav · recherche · action primaire). Les utilitaires de
  session — Discord, langue, et en membre lien d'import, nom, déconnexion —
  passent dans une divulgation `<details>` calquée sur le sélecteur de serveur
  existant : **un seul mécanisme de menu**, pas deux.
- **Le CTA de connexion emploie `.exp-btn`** (`app.css`), la même primitive que
  « créer un serveur » sur `/servers`. L'action qui ouvre le tunnel de
  conversion était jusque-là présentée plus discrètement que celle qui le
  poursuit. Le commentaire de `app.css` déclarant le périmètre de `.exp-*`
  nomme désormais aussi l'en-tête — son silence est précisément la raison pour
  laquelle l'en-tête avait dérivé.
- **Variante `transparent`** pour la landing seule : son en-tête sans chrome
  était une décision d'identité (l'illustration animée du hero doit rester
  visible). Deux valeurs de fond/bordure sur le même composant, pas une
  seconde primitive.
- **Les 6 cartes de fonctionnalité à route publique deviennent cliquables**
  (`/paldex`, `/breeding`, `/teams`, `/map`, `/tech`, `/craft`). Les 3 cartes de
  synchronisation restent descriptives : la grille rend ainsi visible, sans
  copie supplémentaire, ce qui est essayable tout de suite et ce qui demande un
  compte. `routes/landing-features.test.ts` garde ces cibles alignées sur
  `GUEST_FEATURES`.

**Résultat mesuré** : débordement de nav à 1280 px 89 → **0 px** ; hauteur
mobile 146 → **103 px** (17 % → 12 %), 3 → **2 rangées** ; liens internes sur
`/docs` 1 → **10**.

**Deux ajustements non prévus par les plans, assumés** : une branche
`@media (max-width: 1400px)` masque le libellé du bouton de recherche (la seule
consolidation des utilitaires laissait 60 px de débordement, le CTA passé en
`.exp-btn` étant plus large), et une clé `auth_login_short` raccourcit le CTA
sous 520 px pour qu'il tienne sur la rangée de la marque — sans quoi l'en-tête
mobile restait à 3 rangées. Libellé complet conservé en `aria-label`.

**Reste à valider connecté** : le mode membre n'a pas pu être mesuré (session
Discord indisponible). À revérifier : débordement de nav à 1280 px, sélecteur de
serveur, import et déconnexion dans le menu utilitaire.

## 2026-07-26 - Catégories de marqueurs et ids uniques

**Constat** : `markers.json` mélangeait deux populations sous `alpha` (83
spawners de Pals avec `palId`, 69 entrées à `palId: "None"`) et cachait les
tours dans les points de voyage rapide - les 8 arènes de boss sont des `ft` dont
le `nameId` est connu (`FTPoint45`, `Boss_Forest`, `SkyIsland_BOSS`, `FTPoint3`,
`FTPoint9`, `FTPoint20`, `FTPoint67`, `FTPoint76`), et 20 autres sont des tours
d'observation (`WatchTower_*`). Par ailleurs 33 des 69 entrées à `palId: "None"`
étaient des **doublons exacts** : `DT_BossSpawnerLoactionData` contient chaque
boss PNJ deux fois (même `SpawnerID`, même position, même niveau) - pas deux
spawners à des emplacements différents comme on l'a d'abord cru. L'id étant
dérivé du `SpawnerID`, 33 entrées portaient donc le même id que leur jumelle :
`MarkerController` (indexé par id) les
fusionnait déjà silencieusement, correctement pour cette donnée, mais tout
`{#each}` Svelte keyé par id lève `each_key_duplicate` sur le même doublon.
**Décisions** : (a) la classification vit dans le pipeline
(`transform/markers.lib.ts`), `type` prend six valeurs : `relic`, `alpha`,
`boss`, `tower`, `watchtower`, `ft` ; (b) deux entrées identiques en
`(type, position, méta)` sont dédoublonnées (une seule conservée, sans
suffixe) - le vrai boss n'existe qu'une fois côté jeu ; (c) un même id à deux
positions réellement différentes reçoit toujours un suffixe `_2`, `_3` —
déterministe (tri avant affectation) et idempotent, garantie conservée pour
une collision qui n'existe pas aujourd'hui mais pourrait apparaître ; (d)
comme les DataTables du jeu ne sont pas dans le dépôt, un script
`pnpm --filter @palworld-companion/pipeline markers:normalize` répare le fichier
commité sans réextraction ; (e) `verify.ts` échoue désormais sur un id dupliqué.
**Conséquence** : `boss` passe de 69 à 36 entrées (69 brutes, 36 positions
distinctes) et le total de `markers.json` de 447 à 414. Aucune migration de
base : les entrées fusionnées sont toutes des boss PNJ, jamais cochés, absents
de la table `progress`.
**Limite connue de la clé de fusion** : elle ne comprend ni `id` ni `nameId`.
Deux entités réellement distinctes du même `type` tombant sur le même pixel
arrondi seraient donc fusionnées à tort, la première dans l'ordre de tri
gagnant. Inoffensif aujourd'hui — aucune des 414 entrées ne partage de position
avec une autre (la paire la plus proche est à 6,9 px, et un pixel arrondi vaut
~18 cm de monde) — mais le risque se matérialiserait à une future
régénération, sans qu'aucune borne de volumétrie ne le signale. Ajouter
`nameId` (et `id` hors `boss`) à la clé refermerait la porte : à faire à la
prochaine intervention sur le pipeline.

## 2026-07-26 - Tous les marqueurs cochables

**Constat** : seules les effigies étaient cochables (`REGISTRY.marker` limité aux
ids `relic_*`), or la barre latérale répond à « que me reste-t-il ? » pour les
alphas, les boss et les tours.
**Décision** : élargir le kind `marker` existant à tous les ids de
`markers.json` plutôt que créer un kind par catégorie. Pas de migration, pas de
changement de schéma, les lignes `relic_*` restent valides, les deux fusions
d'import (pipeline + revendication de GUID) restent inchangées, un seul
`ProgressStore` et un seul aller-retour d'API. Les compteurs par catégorie se
dérivent côté client (`countsByCategory`).
**Conséquence** : la tuile carte du tableau de bord porte sur l'ensemble des
marqueurs (414) et non plus sur les seules effigies. L'auto-remplissage depuis
les saves (`FastTravelPointUnlockFlag`, `NormalBossDefeatFlag`,
`TowerBossDefeatFlag`) reste à faire : le format de clé des drapeaux de boss n'est
pas vérifié. `ResultList`/`CategoryRail` n'ont pas de test au niveau composant :
il n'y a ni jsdom/happy-dom ni testing-library dans ce dépôt et en ajouter un
sort du périmètre - ce comportement a été vérifié en navigateur à la place.

## 2026-07-26 - Ce qu'une URL de carte a le droit d'écraser

**Constat** : `/map?pal=<palId>` est un lien profond existant, généré depuis
chaque fiche de Pal, et il préserve les filtres de l'utilisateur. En faisant de
`pal` une clé de filtre parmi d'autres, la restauration depuis l'URL remettait
toute la vue (catégories, niveau, élément, « masquer les faits », recherche) aux
valeurs par défaut au simple clic sur « voir les zones ». Symétriquement, tester
la *présence* des clés plutôt que leur validité laissait `?sel=` ou
`?sel=licorne` écraser les préférences enregistrées.
**Décision** : deux familles de clés. Les **clés de vue** (`sel`, `vis`, `lvl`,
`el`, `todo`, `q`) décrivent une vue et seules elles autorisent l'URL à primer
sur localStorage ; `pal` et `phase` n'en décrivent pas une. `fromSearchParams`
rend `null` tant qu'aucune clé de vue n'a **validé** — la présence ne suffit pas.
**Conséquence** : un lien ne portant que `?pal=&phase=` est ignoré par la
restauration ; l'effet `?pal=` de la page relaie alors la phase partagée
lui-même. Le payload localStorage est validé champ par champ au même titre que
l'URL (un `visible` stocké en chaîne empoisonnait l'état et faisait lever
`.join(",")`).

## Backlog / Évolutions

- Multi-tenant phase 1 : rollout selon `docs/deploy-multi-tenant.md` ;
  spec `docs/superpowers/specs/2026-07-22-multi-tenant-design.md`.
- Multi-tenant phase 3 : ingestion SFTP self-service, rollout selon
  `docs/deploy-multi-tenant-phase-3.md` (clé `SAVE_CREDS_KEY`, migration du
  SFTP legacy en base, purge des secrets `SFTP_*`).
