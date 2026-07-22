import { getLocale } from "$lib/paraglide/runtime";
import namesFr from "@palworld-companion/game-data/l10n/names.fr.json";
import namesEn from "@palworld-companion/game-data/l10n/names.en.json";
import descFr from "@palworld-companion/game-data/l10n/descriptions.fr.json";
import descEn from "@palworld-companion/game-data/l10n/descriptions.en.json";

const N = { fr: namesFr, en: namesEn } as Record<string, Record<string, string>>;
const D = { fr: descFr, en: descEn } as Record<string, Record<string, string>>;

/** nsId ex. "pal:Anubis", "item:Wood". Repli : EN puis l'id brut. */
export function gameName(nsId: string): string {
  const loc = getLocale();
  return N[loc]?.[nsId] ?? N.en[nsId] ?? nsId.split(":").pop()!;
}

export function gameDesc(nsId: string): string | undefined {
  const loc = getLocale();
  return D[loc]?.[nsId] ?? D.en[nsId];
}
