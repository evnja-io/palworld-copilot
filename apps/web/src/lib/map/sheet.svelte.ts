/** Feuille glissante de la carte (mobile) : positions d'ancrage et glissement
 *  au doigt. Isolé du composant pour rester testable sans DOM — `attach()` ne
 *  reçoit que des nombres, jamais un événement.
 *
 *  La feuille est posée AU-DESSUS du canevas Leaflet (`.canvas` est en
 *  `position: absolute; inset: 0`) : changer sa hauteur ne redimensionne pas la
 *  carte, donc on peut suivre le doigt image par image sans déclencher
 *  `invalidateSize()` à chaque frame. */

export type SheetStop = "collapsed" | "half" | "full";

/** Hauteur de la position repliée, en px : poignée + ligne de résumé. */
export const COLLAPSED_PX = 68;

/** Fractions de la hauteur disponible pour les deux positions dépliées.
 *  `half` à 0.6 : sur un téléphone tactile, le chrome de la feuille (rail,
 *  en-tête de catégorie, recherche à 44 px, ligne de filtres) occupe ~200 px —
 *  en dessous, la liste de résultats tombait à trois lignes. */
const RATIO: Record<Exclude<SheetStop, "collapsed">, number> = { half: 0.6, full: 0.92 };

export const STOPS: SheetStop[] = ["collapsed", "half", "full"];

/** Hauteur en px d'une position, pour une hauteur de conteneur donnée. */
export function stopHeight(stop: SheetStop, available: number): number {
  if (stop === "collapsed") return Math.min(COLLAPSED_PX, available);
  return Math.round(available * RATIO[stop]);
}

/** Position dont la hauteur est la plus proche de `height`. Un glissement rapide
 *  (`velocity` en px/ms, positif = vers le haut) emporte la décision d'un cran :
 *  un « flick » doit ouvrir ou fermer même s'il s'arrête à mi-course. */
export function snapTo(height: number, available: number, velocity = 0): SheetStop {
  const FLICK = 0.45;
  const byDistance = STOPS.reduce((best, stop) =>
    Math.abs(stopHeight(stop, available) - height) < Math.abs(stopHeight(best, available) - height)
      ? stop
      : best,
  );
  if (Math.abs(velocity) < FLICK) return byDistance;
  const dir = velocity > 0 ? 1 : -1;
  const i = STOPS.indexOf(byDistance);
  // Un flick ne saute jamais deux crans : on reste voisin de la position visée.
  return STOPS[Math.min(STOPS.length - 1, Math.max(0, i + dir))];
}

export class SheetState {
  stop = $state<SheetStop>("half");
  /** Hauteur du conteneur (`.map-wrap`), liée par le composant. */
  available = $state(0);
  /** Hauteur suivie pendant un glissement ; `null` au repos. */
  dragging = $state<number | null>(null);

  #startY = 0;
  #startH = 0;
  /** Deux derniers échantillons : la vitesse se mesure sur le geste récent, pas
   *  sur toute sa durée (un glissement lent suivi d'un flick doit compter comme
   *  un flick). */
  #lastY = 0;
  #lastT = 0;
  #prevY = 0;
  #prevT = 0;
  /** Vrai dès que le doigt a franchi le seuil : sert à annuler le clic. */
  moved = false;
  /** Geste en cours. Le composant s'en sert plutôt que de `hasPointerCapture` :
   *  `setPointerCapture` peut échouer (pointeur déjà relâché, événement
   *  synthétique) et le glissement ne doit pas en dépendre. */
  active = false;

  /** Hauteur à appliquer, en px. */
  get height(): number {
    return this.dragging ?? stopHeight(this.stop, this.available);
  }

  /** Cycle utilisé par un simple appui sur la poignée. */
  cycle() {
    this.stop = this.stop === "full" ? "collapsed" : this.stop === "half" ? "full" : "half";
  }

  /** Décale d'un cran (clavier : flèches haut/bas). */
  step(dir: 1 | -1) {
    const i = STOPS.indexOf(this.stop);
    this.stop = STOPS[Math.min(STOPS.length - 1, Math.max(0, i + dir))];
  }

  start(y: number, now: number) {
    this.#startY = this.#lastY = this.#prevY = y;
    this.#lastT = this.#prevT = now;
    this.#startH = stopHeight(this.stop, this.available);
    this.moved = false;
    this.active = true;
  }

  move(y: number, now: number) {
    if (!this.active) return;
    // Seuil de 4 px : sans lui, le micro-tremblement d'un appui annulerait le
    // clic et la poignée deviendrait intappable.
    if (!this.moved && Math.abs(y - this.#startY) < 4) return;
    this.moved = true;
    this.#prevY = this.#lastY;
    this.#prevT = this.#lastT;
    this.#lastY = y;
    this.#lastT = now;
    const max = Math.round(this.available * RATIO.full);
    this.dragging = Math.min(max, Math.max(COLLAPSED_PX, this.#startH - (y - this.#startY)));
  }

  end(y: number, now: number) {
    this.active = false;
    if (this.dragging === null) return;
    // Vitesse positive = vers le haut (y décroît).
    const velocity = (this.#prevY - y) / Math.max(1, now - this.#prevT);
    this.stop = snapTo(this.dragging, this.available, velocity);
    this.dragging = null;
  }

  cancel() {
    this.active = false;
    this.dragging = null;
    this.moved = false;
  }
}
