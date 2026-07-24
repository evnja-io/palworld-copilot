# Team Builder — Direction UI (design-lab, 2026-07-24)

Direction retenue : **Variante B — « banc de touche »** (choix utilisateur), sans
modification structurelle, avec deux précisions d'édition.

## Principe

Un slot à la fois, mise en scène « team builder de jeu ». Référence du lab :
`apps/web/src/routes/__design_lab/VariantB.svelte` (supprimé au nettoyage, mais
la structure ci-dessous en est la transcription — s'y reporter dans l'historique
git au commit du lab si besoin).

## Anatomie (éditeur `TeamEditor.svelte`)

1. **Bandeau** (`.topbar`, flex wrap) :
   - Nom d'équipe = **champ texte inline discret** (édité directement dans le
     bandeau, pas de section formulaire séparée), lié à `store.name`.
   - Méta : `par {auteur} · lecture seule pour les autres membres` (en lecture
     seule côté non-auteur, cf. `m.teams_readonly_hint`).
   - Badge dirty `● {m.teams_unsaved()}` en couleur `--el-electricity`, visible
     seulement si `store.dirty`.
   - Bouton **Enregistrer** (`.save`, `--accent`/`--accent-ink`), libellés selon
     `store.status` (`teams_save`/`teams_saving`/`teams_saved`/`teams_save_error`),
     désactivé si `!store.dirty || status === 'saving'`.
   - **Notes** = zone `<textarea>` **dépliable sous le bandeau** (repliée par
     défaut, un bouton « Notes » la déplie), liée à `store.notes`,
     `m.teams_notes_label` / `m.teams_notes_placeholder`.

2. **Banc** (`.bench`, `role="tablist"`) : grille de 5 sièges
   (`repeat(5, minmax(0,1fr))`, mobile = `minmax(76px,1fr)` + `overflow-x:auto`).
   Chaque siège (`.seat`, `role="tab"`, `aria-selected`) :
   - numéro de slot `.seat-num` (display font, `.tnum`) ;
   - portrait `palIcon(palId)` 64px, **désaturé si `!caught.mine.includes(palId)`**
     (convention Paldex : filtre grayscale, cf. `PalCard.svelte` / `paldex`) ;
   - nom `gameName('pal:'+palId)` tronqué ; `ElementBadge` par élément ;
   - siège vide : cercle pointillé `+` + « Vide » / « choisir » ;
   - siège actif : bordure + fond `color-mix(--accent 8%, --surface-1)`.
   - **`GroupAvatars`** (qui du serveur a capturé l'espèce) affiché sur le siège
     ou dans le panneau — depuis `caught.group[palId]`.

3. **Panneau de détail** (`.detail`, `role="tabpanel"`) du slot sélectionné :
   - En-tête : portrait 88px, `Slot N` (display), nom (display 20px),
     `ElementBadge`, **ruban partenaire** `Partenaire — gameName('partnerskill:'+
     palId)` (lecture seule, pas de description — elle n'existe pas dans le jeu).
   - Actions (auteur seul) : **Remplacer** (ouvre le picker mode `pal`),
     **Retirer** (`.danger`, `--el-fire`, `store.clearSlot(i)`).
   - Deux colonnes (`1fr 1fr`, mobile `1fr`) :
     - **Passifs · N/4** : chips retirables (`×`), rang ≥ 4 en
       `--el-electricity` ; bouton « + » masqué à 4 (ouvre picker mode `passive`).
     - **Actifs · N/3** : nom + `ElementBadge` (élément du skill) + power `.tnum`
       + CT `.tnum` ; bouton « + » masqué à 3 (picker mode `active`).
   - Slot vide : « Slot N vide » + bouton « Choisir un Pal… » (picker `pal`).

## Édition

- **Édition via overlay** (choix utilisateur) : Remplacer / Choisir un Pal / les
  boutons « + » ouvrent `TeamPicker.svelte` (overlay 3 modes cloné de
  `CommandPalette.svelte`) ; pas d'édition inline dans le panneau.
- Le picker écrit dans le store (`store.setSlot`) ; le panneau reflète l'état.

## Contraintes reprises du design system

Tokens `app.css` uniquement, `color-mix` (aucun hex), flat + bordures, ombres
réservées aux overlays, `.tnum` sur numéros/power/CT/compteurs, transitions
140ms, display font sur titres/numéros. Responsive mobile-first (banc scrollable,
colonnes en une seule sur < 700px) — le brief exige desktop ET mobile à égalité.

## Ce que la maquette n'implémentait pas (à faire en Task 9)

- Pickers réellement fonctionnels (mode pal avec grayscale + `GroupAvatars` +
  filtre « capturés par moi » ; mode actif avec learnset `learnsetFor` + toggle
  fruits ; mode passif trié par nom + rang).
- Câblage complet au `TeamEditorStore` (dirty, save, setSlot/clearSlot).
- Champ notes dépliable + nom inline (la maquette montrait un bandeau statique).
- Mode lecture seule (aucune affordance d'édition rendue, pas seulement désactivée).
