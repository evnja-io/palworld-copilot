// Aptitudes de travail : tri des pals par niveau, libellés localisés et icônes.
// Module pur (testable sans Svelte), à l'exception de workIcon (données statiques).

import { WORK_LABELS, type Locale } from "../search/tokens";
import { itemIcon } from "./icons";

export type WorkOrder = "desc" | "asc";

/** Trie par niveau de l'aptitude - décroissant par défaut (meilleur d'abord),
 *  croissant sur demande. Tri stable : l'ordre d'entrée (n° Paldex) départage
 *  les niveaux égaux. `work` est typé `object` car les entrées de pals.json
 *  ont des clés figées. */
export function sortByWorkLevel<T extends { work: object }>(
  pals: T[],
  work: string,
  order: WorkOrder = "desc",
): T[] {
  if (!work) return pals;
  const lvl = (p: T) => (p.work as Record<string, number>)[work] ?? 0;
  return [...pals].sort((a, b) => (order === "desc" ? lvl(b) - lvl(a) : lvl(a) - lvl(b)));
}

export function workLabel(work: string, locale: Locale): string {
  return WORK_LABELS[work]?.[locale] ?? work;
}

export function workIcon(work: string): string | undefined {
  return itemIcon(`WorkSuitability_AddTicket_${work}`);
}
