import { prefersReducedMotion } from "svelte/motion";
import { cubicOut } from "svelte/easing";

/** Paramètres de `transition:fly` pour l'apparition d'un item de rang `i`.
 *
 *  Deux précautions :
 *
 *  1. Le palier à 12. Le Paldex rend 288 cartes — un décalage non borné
 *     étalerait l'entrée sur 11,5 s. Au-delà du douzième item, tout arrive
 *     ensemble.
 *
 *  2. `prefersReducedMotion`. Le bloc `@media (prefers-reduced-motion)` de
 *     app.css neutralise DÉJÀ le mouvement — `fly` est une transition CSS
 *     (Svelte injecte un @keyframes et pose `animation:` en style inline, et
 *     une déclaration auteur `!important` l'emporte sur une inline normale).
 *     Mais il ne raccourcit pas le minuteur interne de Svelte, et il repose
 *     sur une subtilité de cascade. On coupe donc aussi à la source.
 *
 *  À utiliser avec `in:` et jamais `transition:` : sinon un changement de
 *  filtre anime la sortie de chaque carte retirée et fige la liste. */
export function reveal(i: number) {
  return prefersReducedMotion.current
    ? { y: 0, duration: 0, delay: 0 }
    : { y: 12, duration: 400, delay: Math.min(i, 11) * 40, easing: cubicOut };
}
