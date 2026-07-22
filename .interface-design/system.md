# Palworld Companion — système d'interface

Direction : « expédition nocturne » — sombre uniquement, une seule teinte de base
(ardoise 222°), accent unique bleu Sphère (`--accent`). Plat, profondeur par
bordures + paliers de surface (`--surface-1/2/3`), **jamais d'ombres**.
Typo : Space Grotesk Variable (`--font-display`) pour titres/valeurs, system-ui
pour le corps. Base d'espacement 4px. Rayons `--r-sm 6 / --r-md 10 / --r-lg 14`.
Transitions 140ms `cubic-bezier(.23,1,.32,1)`, press `scale(0.97)`.

## Rôles de couleur (au-delà des tokens app.css)

- `--accent` = points/technologie **normale** (bleu Sphère).
- `--el-dark` (#a06bd6) = **Technologie ancienne** (colonne de droite du jeu).
- `--el-fire` = exigence boss / verrou.
- États toujours en `color-mix(in srgb, <couleur> N%, transparent|surface)` —
  jamais de hex en dur dans les composants.

## Page Technologies (`(app)/tech/+page.svelte`) — réplique de l'écran du jeu

- **Rangée = niveau** : grille `40px minmax(0,1fr) 104px` — rail « Lv N »
  (display 19px/600 text-2, libellé 10px caps text-4), grille de tuiles,
  colonne ancienne (1 tuile de large max, liseré gauche violet 35%).
  Séparation entre niveaux : `border-top: 1px solid var(--border)`.
- **Ordre des nœuds = ordre du jeu** : tech.json préserve l'ordre des lignes de
  la DataTable (tri stable par niveau seulement — ne pas re-trier côté client).
- **Tuile** = `<button>` bascule (toute la tuile clique, comme en jeu) :
  minmax(92px,1fr), min-height 104, padding 20px 6px 8px, `--r-sm`.
  Icône 40px centrée, nom 10.5px/500 clamp 2 lignes, coût « ◆N » 10px/600 en
  haut-droite, ✓ (débloquée) ou cadenas rouge (boss requis) en haut-gauche.
- **États** : verrouillée = icône opacity .55 saturate(.7), nom text-3 ;
  débloquée = fond mix accent 10% + bordure accent 45%, icône pleine, nom
  text-1. Ancienne : mêmes règles avec `--el-dark` (fond 12%, bordure 55%).
- **Infobulle façon jeu** : sibling `.tip` de la tuile, `position:fixed`
  posée par l'action `tipPlacer` (bornée viewport, bascule au-dessus si
  manque de place, pont hover ::before 8px). Contenu : nom 13px/600 + badge
  ancienne, description `white-space:pre-line` text-2, exigences en
  `--el-fire`, liens des unlocks (icônes 18px), GroupAvatars. Cachée < 700px.
- **Chips de points** (entête) : pill 999, gem = carré 8px rotate(45deg) en
  `currentColor`, texte 12px/500, couleur/fond/bordure en mix 10/30 % de la
  couleur du type de point.
- **Repli de nom** : si la clé l10n `tech:<nameId>` manque, utiliser le label
  du premier unlock résolu (`unlockTarget`).
- Mobile < 700px : rail 34px, colonne ancienne repasse sous la grille
  (masquée si vide), infobulles désactivées.

## Icônes

- `techIcon(iconName)` : `item:<iconName>` puis `build:<iconname>` (namespace
  en minuscules, fichiers `/icons/build/*.webp`). Cube SVG neutre en repli
  tant que les textures BuildObject ne sont pas exportées (runbook).

## Motifs transverses

- Progression partagée : `ProgressStore` (init dans `$effect`, toggle
  optimiste + rollback), avatars de groupe via `GroupAvatars`.
- Cartes : `--surface-1` + `border` + `--r-md` (voir RecipeCard) ; les tuiles
  denses type jeu utilisent `--r-sm`.
- Nombres dynamiques : `.tnum` obligatoire.
