// Aptitudes de travail : tri des pals par niveau, libellés localisés et icônes.
// Module pur (testable sans Svelte), à l'exception de workIcon (données statiques).

import { WORK_LABELS, type Locale } from "../search/tokens";
import { itemIcon } from "./icons";

/** Trie par niveau décroissant de l'aptitude (les pals sans l'aptitude en fin).
 *  Tri stable : l'ordre d'entrée (n° Paldex) départage les niveaux égaux.
 *  `work` est typé `object` car les entrées de pals.json ont des clés figées. */
export function sortByWorkLevel<T extends { work: object }>(pals: T[], work: string): T[] {
  if (!work) return pals;
  const lvl = (p: T) => (p.work as Record<string, number>)[work] ?? 0;
  return [...pals].sort((a, b) => lvl(b) - lvl(a));
}

export function workLabel(work: string, locale: Locale): string {
  return WORK_LABELS[work]?.[locale] ?? work;
}

export function workIcon(work: string): string | undefined {
  return itemIcon(`WorkSuitability_AddTicket_${work}`);
}
