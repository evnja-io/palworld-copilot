# Fiches de Pal — descriptions actives/passives + socle d'effets

**Date** : 2026-07-23
**Statut** : design validé, prêt pour plan d'implémentation

## Contexte

Les fiches de Pal (`/s/[slug]/paldex/[palId]`) affichent les passifs (nom seul) et les
attaques actives (nom + élément + puissance). Objectifs :

1. Afficher la **description** des compétences actives et passives.
2. Poser le **socle de données des effets de passifs** dont le futur team builder aura besoin
   pour cumuler les stats.

### Constat d'exploration

- Les **actives sont déjà affichées** ; le manque réel, ce sont les descriptions.
- Aucune description n'existe encore dans `game-data`. L'accesseur `gameDesc()`
  (`apps/web/src/lib/game/names.ts`) existe et fonctionnera dès que le pipeline peuplera les
  clés `skill:`/`passive:`.
- **Descriptions actives** : `DT_SkillDescText` fournit 335 entrées `ACTION_SKILL_`,
  texte propre sans placeholder → exploitables directement (les entrées « en Text » non
  traduites sont déjà filtrées par `isL10nPlaceholder`).
- **Descriptions passives** : 104 entrées `PASSIVE_`, à placeholders `{EffectValue1..4}`
  (ex. `Defense +{EffectValue1}%`). Les valeurs viennent de `DT_PassiveSkill_Main`.

### Résolution de la donnée d'effets (initialement absente, corrigée)

`DT_PassiveSkill_Main(_Common)` (struct `PalPassiveSkillDatabaseRow`) était **exportée vide**
dans le dump initial — cause : assets non correctement chargés/exportés par FModel. Un
**ré-export FModel corrigé** du dossier `PassiveSkill/` l'a **peuplée : 1905 rows**. La donnée
d'effets est donc désormais **autoritaire (issue du jeu)** — pas de fichier curé à la main.

Structure d'une row (clé = ID du passif, ex. `Deffence_up2_2`) :
`EffectType1..4` (enum `EPalPassiveSkillEffectType::…`), `EffectValue1..4` (nombre),
`TargetType1..4` (`ToSelf`…), `TargetElementType`, `Rank`, `Category`.

Vérifié : les **23 IDs de passifs innés** utilisés par les Pals sont **tous couverts**, valeurs
conformes à paldb (`Deffence_up2_2` → Défense 20 + anti-projection ; `Legend` → ATK/DEF/Vitesse 20 ;
`Nushi`/Lunker → Water/Ice/Défense 20). Placeholder unique dans les templates : `{EffectValueN}`
→ `EffectValueN` de la row. Balises rich-text à nettoyer : `<NumRed_x>`, `<NumBlue_x>`, `</>`,
`<Status_Up>`, `<uiCommon>`.

### Décisions produit

- **Affichage** : description en ligne, texte atténué, toujours visible sous chaque nom.
- **Source des effets** : extraction autoritaire depuis `DT_PassiveSkill_Main` (pas de curage).
- **Séquencement** : un seul lot (actives + passifs + effets + UI).
- **Périmètre** : ciblé. Partner skill et buildup de statut des actives = itérations futures
  (données désormais disponibles, mais hors scope ici).

## Architecture

Trois unités reliées par les clés de localisation existantes (`skill:<id>`, `passive:<id>`).

### A. Extraction des effets passifs (socle) — `packages/pipeline/src/transform/passive-effects.ts` *(nouveau)*

- Fonction **pure** `parsePassiveRow(row)` → `{ rank, effects: [{type,value,target}], values: [n1..n4] }`
  (`type`/`target` = enum déballé via `enumName`, `values` = `EffectValue1..4` positionnels).
- Côté effet : `buildPassiveEffects(rows, isNamed)` ne retient que les passifs ayant un nom
  localisé (`passive:<id>` présent → écarte `TestSkill*` et internes) et écrit
  `game-data/passive-effects.json` : `{ "<id>": { rank, effects: [{type,value,target}] } }`.
- Enregistré dans `packages/pipeline/src/all.ts`.

### B. Descriptions — `packages/pipeline/src/transform/l10n.ts` *(modif)*

1. `DESC_SOURCES` += `[/DT_SkillDescText/, "ACTION_SKILL_", "skill:"]` et
   `[/DT_SkillDescText/, "PASSIVE_", "passive:"]`.
2. Post-traitement **scopé aux namespaces `skill:` et `passive:`** (pour ne pas régresser
   item/pal/tech) : substituer `{EffectValueN}` depuis les `values` de la row passive
   correspondante, puis nettoyer les balises rich-text ; **écarter** toute description dont
   un `{EffectValueN}` reste non résolu (l'UI retombe sur le nom seul).
3. Helpers **purs** dans `lib.ts` : `resolveEffectPlaceholders(text, values)` et
   `stripRichTags(text)` — unit-testables sans `RAW_DIR`.

### C. UI web — `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte` *(modif)*

- **Bloc passifs** (l.93-100) : sous chaque nom, `{#if gameDesc(\`passive:${p}\`)}` → `<span class="pdesc">`.
- **Bloc attaques** (l.116-129) : sous chaque nom de move, `{#if gameDesc(\`skill:${mv.skillId}\`)}` → `<span class="pdesc">`.
- Nouveau style `.pdesc` (gris, petit), aligné sur `.desc` existant.
- `passive-effects.json` est branché comme donnée prête pour le futur team builder ;
  aucun affichage d'effets/chips sur la fiche dans cette itération.

## Périmètre / YAGNI

- **Inclus** : descriptions actives + passives (placeholders résolus), `passive-effects.json`,
  affichage en ligne.
- **Exclu** : team builder ; chips d'effets ; partner skill ; buildup de statut des actives ;
  levée du filtre `.filter(mv => skills[mv.skillId])` (conservé).

## Fichiers touchés

- `packages/pipeline/src/transform/passive-effects.ts` *(nouveau)*
- `packages/pipeline/src/transform/l10n.ts` *(modif)*
- `packages/pipeline/src/lib.ts` *(modif — helpers purs)* + `lib.test.ts` *(tests)*
- `packages/pipeline/src/all.ts` *(modif — enregistrement)*
- `packages/pipeline/src/verify.ts` *(modif — planchers passive-effects + couverture desc)*
- `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte` *(modif)*
- `packages/game-data/{passive-effects.json, l10n/descriptions.{en,fr}.json}` *(régénérés)*

## Vérification (bout en bout)

1. Régénérer : `pnpm --filter @palworld-companion/pipeline all` (nécessite `RAW_DIR`).
2. `packages/game-data/l10n/descriptions.{en,fr}.json` gagnent des clés `skill:*` (~335) et
   `passive:*` (résolues, **sans** `{EffectValue…}` résiduel) ; `passive-effects.json` existe
   et couvre les 23 IDs innés (`grep`).
3. `pnpm --filter @palworld-companion/pipeline verify` + `vitest run` (helpers purs verts).
4. Lancer le web, ouvrir une fiche de Pal avec passifs (ex. un Pal légendaire) et confirmer
   l'affichage des descriptions **actives** et **passives** en ligne sous chaque nom.
