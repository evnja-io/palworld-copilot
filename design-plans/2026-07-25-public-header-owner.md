# Un seul en-tête gouverne la surface publique, en mode invité comme en mode membre

Written against: e80e645

## Evidence chain

- Surface: `apps/web/src/routes/s/[slug]/+layout.svelte` (`header.topbar`, états invité et membre) · `apps/web/src/routes/+page.svelte` (`header.top`) · `apps/web/src/routes/docs/+page.svelte` (`header.top`)
- Problem: un même visiteur anonyme traverse trois en-têtes différents dans une seule tâche (parcourir le produit public). Mesuré sur le rendu :
  - `/` : `header.top` ne contient **que** `<LangSwitch />`, en `position: absolute`. Aucune marque cliquable, aucune navigation, aucune action de connexion. Un seul lien vers une fonctionnalité dans toute la page (`/paldex`).
  - `/docs` : `header.top` contient `← Retour à l'accueil` + `<LangSwitch />`. **Un seul lien interne dans toute la page : `/`.** Page pourtant publiée au sitemap avec canonical et hreflang (cf. `routes/sitemap.xml/+server.ts`), donc porte d'entrée depuis la recherche — et cul-de-sac.
  - `/paldex` (coquille invité) : `header.topbar` complet — marque + puce « Invité », 8 liens de nav, bouton de recherche, lien Discord, `LangSwitch`, CTA « Se connecter avec Discord ».
- Design evidence (mesures sur le rendu, dev server, invité déconnecté) :
  - **1280 × 800** : `nav.scrollWidth` = 613 px pour `clientWidth` = 524 px → **89 px de navigation principale tronquée** sur un portable standard. Contributions mesurées des autres enfants : `.brand-home` 199 px, `.search-btn` 180 px, `.user` 271 px.
  - **1440 × 800** : dépassement = 0. Le seuil de rupture se situe donc entre 1280 et 1440.
  - **390 × 844** : `header.topbar` fait **146 px de haut, soit 17 % de la hauteur du viewport**, en `position: sticky` — donc consommés en permanence. Réparti sur **3 rangées**, et la nav déborde encore de **262 px**. Le CTA de connexion mesure 188 px, soit ~48 % de la largeur d'écran.
  - Poids visuel du CTA de connexion mesuré (`.cta-login`) : `background rgba(37,178,244,0.14)`, `color rgb(37,178,244)`, `font 500 13px system-ui`. Le bouton de recherche voisin (`.search-btn`) : `400 13px system-ui`, fond `rgb(11,13,20)`. La primitive d'action primaire de l'application (`.exp-btn` / `.exp-glossy`, `apps/web/src/app.css:168-195`) est en revanche `font-weight 600`, `font-family var(--font-display)`, dégradé `--accent`, `color var(--accent-ink)` — et elle est employée pour « créer un serveur » dans `routes/servers/+page.svelte`, c'est-à-dire **l'étape suivante du même tunnel de conversion**. L'action qui ouvre tout le tunnel est donc présentée plus discrètement que celle qui le poursuit.
- Owner: `apps/web/src/routes/s/[slug]/+layout.svelte` (seul en-tête complet existant ; à extraire)
- Scope and affected surfaces: `apps/web/src/routes/s/[slug]/+layout.svelte`, `apps/web/src/routes/+page.svelte`, `apps/web/src/routes/docs/+page.svelte`, nouveau `apps/web/src/lib/components/AppHeader.svelte`
- Uncertainty: **l'état membre n'a pas pu être mesuré** — il exige une session Discord, indisponible dans cet environnement. Les valeurs ci-dessus concernent l'état invité. La branche membre partage la même grille flex et le même `.topbar`, et remplace `.cta-login` (188 px) par `.discord-link` + `/import` + `LangSwitch` + avatar + `.username` (masqué sous 640 px) + bouton de déconnexion : le dépassement de nav à 1280 px doit être **revérifié connecté** avant de considérer la densité comme résolue.

## Design decision

Extraire un composant d'en-tête unique qui gouverne toute la surface publique, et y consolider les utilitaires secondaires dans une divulgation progressive plutôt que dans la rangée principale.

Deux raisons de traiter cela comme un seul changement plutôt que trois correctifs :

1. La divergence entre `/`, `/docs` et la coquille applicative n'est pas trois oublis mais **l'absence de propriétaire** : l'en-tête complet n'existe qu'à l'intérieur du layout tenant, donc les routes publiques hors `/s/[slug]` ne pouvaient pas le réutiliser. C'est devenu visible seulement quand l'étape 1A a rendu ces routes publiques.
2. La rangée principale ne tient pas parce qu'elle mélange navigation de produit (marque, 8 liens, recherche, action primaire) et utilitaires de session (Discord, langue, compte). Séparer les deux règle le débordement à 1280 px, la hauteur de 17 % sur mobile, et la hiérarchie du CTA de connexion — d'un même geste.

## Reuse

- `<details class="switcher">` + `.menu` — motif de divulgation déjà présent dans `apps/web/src/routes/s/[slug]/+layout.svelte:38-53` (sélecteur de serveur). **Réutiliser ce motif** pour le menu utilitaire ; ne pas introduire un second mécanisme de dropdown.
- `.exp-btn` — primitive d'action primaire, `apps/web/src/app.css:168-195`. À appliquer au CTA de connexion.
- `GUEST_FEATURES` / `appHref()` / `isGuestContext()` — `apps/web/src/lib/guest.ts`, `apps/web/src/lib/nav.ts`. La nav invitée doit rester dérivée de `GUEST_FEATURES` (source unique déjà partagée avec le reroute et le sitemap), pas d'une seconde liste.
- `localizeHref()` — `apps/web/src/lib/paraglide/runtime`. Les liens publics doivent rester localisés (FR sans préfixe, EN sous `/en/`).
- Exemplar (structure d'en-tête, styles `.topbar`/`nav`/`.switcher`) : `apps/web/src/routes/s/[slug]/+layout.svelte`
- Exemplar (action primaire au poids correct) : `apps/web/src/routes/servers/+page.svelte`

Variante transparente : l'en-tête de `/` est aujourd'hui `position: absolute` et sans chrome, ce qui laisse voir l'illustration animée du hero (`.sky`, `.drift` dans `routes/+page.svelte`). C'est une décision d'identité délibérée. Le composant doit donc accepter une variante sans bordure ni fond pour la landing — **ce n'est pas une nouvelle primitive**, seulement deux valeurs de fond/bordure sur le même composant.

## Changes

1. `apps/web/src/lib/components/AppHeader.svelte` (nouveau)
   - Change: un en-tête unique, props `{ mode: 'guest' | 'member', variant?: 'solid' | 'transparent', server?, membership?, myServers?, user? }`. Rangée principale = marque (lien vers `localizeHref('/')` en invité, `<details class="switcher">` en membre) · nav dérivée de `GUEST_FEATURES` en invité et de la liste complète en membre · bouton de recherche · action primaire. Utilitaires (`LangSwitch`, lien Discord communautaire, et en membre : lien `/import`, avatar, nom, déconnexion) déplacés dans **un `<details>` calqué sur `.switcher`/`.menu`** aligné à droite. Le CTA de connexion invité prend la classe `exp-btn`.
   - Preserve: la nav reste `overflow-x: auto` (choix délibéré, cf. `nav { overflow-x: auto }` et la branche `@media (max-width: 640px)` existante) ; le comportement `class:active` via `page.url.pathname.startsWith(appHref(...))` ; le montage de `CommandPalette` reste dans le layout tenant, pas dans l'en-tête ; les styles `.topbar`, `nav`, `.switcher`, `.brand`, `.search-btn` sont déplacés tels quels, sans retouche de valeurs.
   - Verify: à 1280 × 800, `document.querySelector('header nav')` → `scrollWidth - clientWidth === 0` en mode invité. À 390 × 844, hauteur de `header` ≤ 100 px.
2. `apps/web/src/routes/s/[slug]/+layout.svelte`
   - Change: remplacer le bloc `<header class="topbar">…</header>` par `<AppHeader … />` en passant `data.mode` et les champs de l'union discriminée. Conserver `GuestImportBanner`, `.guest-notice`, `<main class:fullscreen>`, `<CommandPalette>` et le `<svelte:head>` `noindex` membre.
   - Preserve: le `$effect` `posthog.identify` gardé derrière `data.mode === 'member'` ; `class:fullscreen={page.route.id === '/s/[slug]/map'}`.
   - Verify: `/paldex` en invité et `/s/<slug>/paldex` connecté rendent le même en-tête, aux utilitaires près.
3. `apps/web/src/routes/+page.svelte`
   - Change: remplacer `<header class="top"><LangSwitch /></header>` par `<AppHeader mode="guest" variant="transparent" />`. Retirer l'import `LangSwitch` devenu inutile.
   - Preserve: `.sky` / `.drift` / `.hero` et la carte du hero inchangés ; le CTA Discord du hero et le lien « Essayer sans compte » restent en place (l'en-tête ne les remplace pas).
   - Verify: l'illustration du hero reste visible derrière l'en-tête ; la nav mène à `/paldex`, `/items`, … et en EN à `/en/paldex`.
4. `apps/web/src/routes/docs/+page.svelte`
   - Change: remplacer `<header class="top">` par `<AppHeader mode="guest" />`. Le lien « ← Retour à l'accueil » devient redondant avec la marque cliquable : le retirer, ainsi que l'import `LangSwitch`.
   - Preserve: le contenu de la documentation et le composant `<Seo>` inchangés.
   - Verify: depuis `/docs`, au moins un lien vers chaque fonctionnalité publique existe (aujourd'hui : zéro).

## Scope

- Inherit: `/` · `/docs` · toutes les routes sous `/s/[slug]/` (invité et membre), soit les 8 fonctionnalités publiques plus le tableau de bord, les réglages, l'import et l'envoi.
- Verify: `/servers` et `/servers/new` **n'utilisent pas** le layout tenant et gardent donc leur propre chrome — vérifier que leur apparence ne devient pas incohérente avec le nouvel en-tête, sans les inclure dans ce plan. `/join/[code]` de même.
- Exclude: la palette de commandes (`CommandPalette.svelte`) ; la bannière d'import (`GuestImportBanner.svelte`) ; toute modification de `GUEST_FEATURES`, du reroute ou du sitemap ; le motif de cartes de la landing (couvert par `2026-07-25-landing-feature-cards-links.md`).

## Validation

- Product: un visiteur arrivant sur `/docs` depuis un moteur peut atteindre le Paldex sans passer par la page d'accueil ; un visiteur sur `/` peut atteindre n'importe quelle fonctionnalité depuis l'en-tête ; un membre connecté conserve le sélecteur de serveur, l'accès à l'import et la déconnexion.
- Interface: `/`, `/docs`, `/paldex`, `/map` (mode plein écran), `/s/<slug>/paldex` connecté, `/s/<slug>/settings` (owner). Viewports **390**, **768**, **1280** (largeur où le défaut est mesuré) et **1440**. Locales FR et EN — vérifier que les liens de l'en-tête portent le préfixe `/en/` en anglais et pas sur les routes `/s/*` (cf. `routeStrategies` dans `vite.config.ts`). Extrême de contenu : un nom de serveur long dans `.switcher`.
- System: confirmer qu'il ne reste **qu'un** en-tête dans le dépôt (`grep -rn 'class="topbar"\|class="top"' apps/web/src/routes` ne doit plus renvoyer que le composant) et **qu'un seul** mécanisme de dropdown (`<details>`), sans second motif parallèle.
- Repository: `pnpm --filter web check` → 0 erreur, 0 avertissement (l'état actuel est propre sur 1916 fichiers, toute régression est donc imputable à ce changement). Puis `pnpm --filter web test` → 211 tests passants.

## Stop conditions

- Stop si la mesure du dépassement de nav à 1280 px **en mode membre** montre que la consolidation des utilitaires ne suffit pas : la correction devrait alors toucher le nombre d'entrées de nav, ce qui est un choix produit et sort de ce plan.
- Stop si extraire l'en-tête impose de faire descendre `data` du layout tenant vers `/` ou `/docs` : ces routes n'ont pas de load tenant, et l'en-tête doit rester alimenté par ses props plus `isGuestContext()`.
- Stop si la variante transparente sur `/` dégrade la lisibilité de la nav par-dessus l'illustration animée — remonter le constat plutôt que d'ajouter un voile non prévu ici.

## Design documentation

- After acceptance and validation: consigner dans `docs/decisions.md` que la surface publique a **un seul propriétaire d'en-tête** (`lib/components/AppHeader.svelte`), que la rangée principale est réservée à la navigation produit tandis que les utilitaires de session vivent dans une divulgation `<details>`, et que le CTA de connexion emploie la primitive `.exp-btn`. Étendre au passage le commentaire de `apps/web/src/app.css:127-129` pour inclure l'en-tête parmi les consommateurs déclarés de `.exp-btn` — aujourd'hui il ne nomme que l'onboarding et les écrans serveur, ce qui est la raison pour laquelle l'en-tête avait dérivé.

---

## Statut : exécuté le 2026-07-25

Mesures après exécution (invité, dev server) :

| Mesure | Avant | Après | Cible du plan |
| --- | --- | --- | --- |
| Débordement de nav à 1280 px | 89 px | **0 px** | 0 px ✅ |
| Hauteur d'en-tête à 390 px | 146 px (17 % du viewport) | **103 px (12 %)** | ≤ 100 px — dépassé de 3 px |
| Rangées à 390 px | 3 | **2** | — |
| Liens internes sur `/docs` | 1 | **10** | > 1 ✅ |
| Largeur du bloc utilitaires à 1280 px | 271 px | **26 px** | — |

### Écarts assumés par rapport au plan

1. **`@media (max-width: 1400px) { .search-label { display: none } }` ajouté.** La seule consolidation des utilitaires ramenait le débordement de 89 à 60 px, pas à 0 : le CTA passé en `.exp-btn` est légitimement plus large (195 px contre 188 px). Compacter la recherche entre 900 et 1400 px libère les ~95 px manquants. Les valeurs de base de `.search-btn` ne sont pas touchées — c'est une branche responsive supplémentaire, dans l'esprit du masquage déjà pratiqué à ≤ 520 px.
2. **Clé `auth_login_short` (« Se connecter » / « Sign in ») + bascule `.cta-full`/`.cta-short` à ≤ 520 px.** Non prévu. Sans libellé court, l'action primaire ne tient pas sur la rangée de la marque à 390 px et l'en-tête reste à 3 rangées (142 px). Le libellé complet est conservé en `aria-label`.
3. **Point de rupture du passage de la nav sur sa propre rangée porté de 640 à 900 px**, pour que la nav ne soit jamais tronquée dans la plage intermédiaire.
4. **Hauteur mobile à 103 px, soit 3 px au-dessus de la cible.** Deux rangées de ~44 px plus la gouttière : la cible de 100 px était indicative, l'objectif (passer de 3 à 2 rangées et sous 15 % du viewport) est atteint.

### Reste à valider

**Le mode membre n'a pas pu être mesuré** (session Discord indisponible), conformément à l'incertitude déclarée plus haut. À vérifier connecté : débordement de nav à 1280 px, sélecteur de serveur, lien d'import et déconnexion dans le menu utilitaire, et bannière d'import.
