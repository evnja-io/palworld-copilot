# Mémoire design

Préférences confirmées en session de design, à réutiliser sans les redemander.
Les jetons font foi : `apps/web/src/app.css`.

## Direction

« Expédition nocturne » : thème sombre uniquement (`color-scheme: dark`), une
teinte de base bleu-ardoise 222°, un seul accent (bleu Pal Sphere
`hsl(199 90% 55%)`). **La profondeur vient des bordures et des paliers de
surface, pas des ombres** (`--surface-1/2/3`, `--border`, `--border-strong`).

Sur les surfaces produit, deux registres cohabitent :

- **outil discret** pour les écrans denses (paldex, items, tech) — surfaces
  plates, bordures filaires, couleur réservée aux éléments de jeu ;
- **HUD de jeu** pour les surfaces d'exploration (carte, onboarding) — lueur
  radiale `exp-hero`, portraits de Pals, badges de niveau, teinte d'élément par
  ligne. Retenu explicitement pour la barre latérale de la carte.

## Densité

Confortable : lignes de ~34-36 px, texte 13 px, 12 px pour les métadonnées,
10-11 px pour les libellés capitalisés. Le tabulaire à 28 px a été écarté comme
trop peu tactile.

## Mise en page

Pour une surface à catégories multiples, **rail d'icônes + panneau** l'emporte
sur des catégories empilées : le rail sort les catégories de la colonne
défilante, la liste récupère la hauteur, et ajouter une catégorie = ajouter une
tuile (aucune reprise de mise en page). Une catégorie sans données reste visible,
grisée, libellée « bientôt ».

Distinguer **sélection** (ce qui est au premier plan) et **visibilité** (ce qui
est dessiné) plutôt que de les fusionner.

## Mobile

Obligatoire, pas un repli : feuille glissante ancrée en bas à trois positions
(poignée / moitié / plein). Dans une feuille, un rail vertical devient une bande
horizontale défilante — sinon il mange la largeur utile. Cibles tactiles 44 px.

## Couleur

- Couleurs d'éléments canoniques (`--el-fire`, `--el-water`, …) pour tout ce qui
  porte un élément de jeu ; ne pas les réassigner à autre chose.
- Une pastille de couleur + un glyphe par catégorie de marqueur.
- **Un seul accent par ligne** : un badge en `--accent` sur une ligne déjà
  teintée par son élément crée une concurrence — accorder le badge à la teinte de
  la ligne.

## Interaction

- Mises à jour optimistes avec annulation en cas d'échec (`ProgressStore`).
- Divulgation progressive pour l'affinage : n'afficher les contrôles de niveau /
  élément que pour les catégories qui portent ces données.
- Persistance en `localStorage` par défaut ; le partage se fait par un bouton
  « copier le lien » explicite, pas en écrivant l'URL à chaque case cochée.
- Chiffres en `.tnum` (`font-variant-numeric: tabular-nums`) partout où ils
  changent en place.

## Accessibilité

`aria-current` sur la tuile sélectionnée, `aria-label` explicite sur les contrôles
purement iconiques (pastilles d'élément, copier le lien), focus visible hérité de
`app.css` (`--focus-ring`), `prefers-reduced-motion` déjà neutralisé globalement.

## Pièges vérifiés

- **`mask: radial-gradient` sur un anneau de progression découpe aussi son
  contenu.** Utiliser un disque intérieur (`::after`) pour garder le chiffre
  lisible.
- **`{#each}` keyé sur des ids de `markers.json`** : 33 ids étaient dupliqués et
  levaient `each_key_duplicate` — deux variantes du lab rendaient une colonne
  vide. Toute liste keyée sur ces données exige l'unicité en amont.
- Pluriels français à écrire explicitement (`1 cible` / `2 cibles`,
  `1 coéquipier` / `2 coéquipiers`).
