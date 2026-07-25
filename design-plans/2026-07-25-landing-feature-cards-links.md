# Les cartes de fonctionnalité de la landing mènent aux fonctionnalités qu'elles annoncent

Written against: e80e645

## Evidence chain

- Surface: `apps/web/src/routes/+page.svelte:112-120` (`section.features`, 9 `article.feature`)
- Problem: la landing annonce 9 fonctionnalités ; **6 d'entre elles sont désormais des routes publiques atteignables sans compte**, et **aucune des 9 cartes n'est cliquable**. Mesuré sur le rendu de `/` : `document.querySelectorAll('.features a').length === 0`, et l'ensemble de la page ne contient **qu'un seul** lien vers une fonctionnalité (`/paldex`, le CTA « Essayer sans compte » du hero). Une carte qui décrit une capacité disponible et ne l'ouvre pas contredit son propre contenu.
- Design evidence: `apps/web/src/lib/guest.ts` — `GUEST_FEATURES` déclare `/paldex`, `/breeding`, `/teams`, `/items`, `/craft`, `/tech`, `/buildings`, `/map` comme accessibles sans compte, et le reroute (`apps/web/src/hooks.ts`) les résout effectivement (vérifié : `/paldex`, `/breeding`, `/teams`, `/items`, `/craft`, `/tech`, `/buildings`, `/map` répondent 200 en anonyme). Les cartes `servers`, `import` et `local` décrivent en revanche la synchronisation de sauvegarde, qui reste derrière la connexion par décision explicite (`docs/decisions.md`, entrée du 2026-07-25 « Mode invité ») — elles n'ont pas de cible publique.
- Owner: `apps/web/src/routes/+page.svelte` (le tableau `features` et le `{#each}` qui le rend)
- Scope and affected surfaces: `apps/web/src/routes/+page.svelte` uniquement
- Uncertainty: aucune pour les 6 cartes à cible publique. Les 3 cartes de synchronisation (`servers`, `import`, `local`) **n'ont volontairement pas de cible** dans ce plan : leur destination naturelle serait `/login/discord` ou `/servers/new`, mais rien dans les sources ne détermine laquelle — décision produit, hors périmètre.

## Design decision

Rendre cliquables les 6 cartes dont la fonctionnalité a une route publique, en les pointant sur cette route. Les 3 cartes de synchronisation restent des `article` non cliquables : elles décrivent ce que débloque la connexion, et le CTA Discord du hero est déjà la porte d'entrée de ce tunnel.

Ce mélange n'est pas une incohérence mais la traduction fidèle d'une décision produit déjà prise : tout est public **sauf** la synchronisation. La grille rend donc visible, sans copie supplémentaire, ce qui est essayable tout de suite et ce qui demande un compte.

## Reuse

- `localizeHref()` — `apps/web/src/lib/paraglide/runtime`. Déjà importé dans ce fichier (utilisé par le CTA « Essayer sans compte » et le lien `/docs`). Les cibles doivent passer par lui pour rester en `/en/...` en anglais.
- `GUEST_FEATURES` — `apps/web/src/lib/guest.ts`. À importer comme **garde** plutôt que de recopier les chemins : voir la vérification ci-dessous.
- Exemplar (carte entièrement cliquable, avec `.card-link` couvrant le contenu et le survol qui remonte à la carte) : `apps/web/src/routes/s/[slug]/teams/+page.svelte:41-59`
- Exemplar (lien public localisé depuis cette même page) : le CTA `.cta-guest` de `apps/web/src/routes/+page.svelte`

## Changes

1. `apps/web/src/routes/+page.svelte`
   - Change: ajouter un champ `href` optionnel aux entrées du tableau `features` (lignes 26-36) — `'/paldex'`, `'/breeding'`, `'/teams'`, `'/map'`, `'/tech'`, `'/craft'` pour les 6 cartes concernées ; **aucun** `href` pour `servers`, `import` et `local`. Dans le `{#each}` (lignes 113-119), rendre `<a href={localizeHref(f.href)} class="feature">` quand `f.href` existe, et conserver `<article class="feature">` sinon. Le contenu interne (icône, `h3`, `p`) et l'animation `--delay` restent identiques dans les deux cas.
   - Preserve: la grille `.features` (ligne 461) et le style `.feature` inchangés — la carte cliquable doit être **visuellement identique** à la carte statique au repos ; l'ordre actuel des 9 cartes ; l'animation d'apparition échelonnée `--delay`.
   - Verify: sur `/`, `document.querySelectorAll('.features a').length === 6` et les 3 restantes sont des `article`. En EN, les 6 `href` valent `/en/...`.

## Scope

- Inherit: `/` et `/en/` uniquement.
- Verify: aucun autre consommateur — le tableau `features` est local à ce fichier.
- Exclude: l'ajout d'une cible aux 3 cartes de synchronisation ; toute retouche de la copie des cartes (`landing_feat_*`) ; l'en-tête de la landing (couvert par `2026-07-25-public-header-owner.md`) ; les statistiques codées en dur du hero.

## Validation

- Product: un visiteur qui lit « Reproduction » sur la landing peut ouvrir le calculateur d'un clic, sans repasser par le CTA du hero.
- Interface: `/` et `/en/`, viewports 390 et 1280. Vérifier l'état de survol d'une carte cliquable face à une carte statique voisine (elles doivent rester indiscernables au repos), et que le focus clavier atteint les 6 liens.
- System: confirmer qu'aucune seconde liste de chemins publics n'apparaît — les `href` doivent être des membres de `GUEST_FEATURES`, pas des chaînes divergentes.
- Repository: `pnpm --filter web check` → 0 erreur, 0 avertissement. Ajouter une assertion au test existant `apps/web/src/lib/guest.test.ts` **ou** un test local vérifiant que chaque `href` de `features` appartient à `GUEST_FEATURES` — c'est la garde qui empêche la grille de dériver si `GUEST_FEATURES` change.

## Stop conditions

- Stop si rendre la carte cliquable impose de modifier `.feature` autrement que par `display`/`color` héritables : la carte statique et la carte cliquable doivent rester identiques au repos, sinon la grille se lit comme deux composants différents.
- Stop si le produit décide que les 3 cartes de synchronisation doivent aussi être cliquables — la cible devient alors une décision produit et ce plan doit être repris.

## Design documentation

- After acceptance and validation: none. La règle applicable est déjà consignée (`docs/decisions.md`, entrée « Mode invité » du 2026-07-25 : tout est public sauf la synchronisation de sauvegarde) ; ce changement l'applique sans l'étendre.

---

## Statut : exécuté le 2026-07-25

Mesuré sur `/` après exécution : **6 cartes rendues en `<a>`** (`/paldex`, `/breeding`, `/teams`, `/map`, `/tech`, `/craft`), **3 en `<article>`** (serveurs, import, parties locales). Comparaison des styles calculés entre une carte cliquable et une carte statique au repos : `backgroundImage`, `borderTopColor`, `borderRadius`, `padding` et `color` identiques. Navigation vérifiée par clic sur « Reproduction » → `/breeding`.

### Écart assumé

`display: block` et `color: inherit` ajoutés à `.feature`. La règle globale `a:hover { color: var(--accent) }` (`app.css:82-84`) aurait sinon coloré la carte entière au survol, rendant les deux variantes distinguables — ce que le plan interdisait explicitement.

Garde de non-régression : `apps/web/src/routes/landing-features.test.ts` (3 tests) vérifie que chaque `href` appartient à `GUEST_FEATURES` et que les trois cartes de synchronisation restent sans cible.
