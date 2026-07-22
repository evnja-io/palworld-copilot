// Résolution d'une entrée d'index vers sa destination dans l'app.
// Les compétences n'ont pas de page : leur sélection pose un token "skill"
// dans la palette (géré par le composant), d'où href absent.
import { buildingByMapObjectId, tech } from "../game/indexes.js";
import { palIcon, itemIcon } from "../game/icons.js";
import { entryNs, rawId, type SearchEntry } from "./engine.js";

const techByNameId = new Map(tech.map((t) => [t.nameId, t]));

export type Resolved = { href?: string; icon?: string };

export function resolve(e: SearchEntry): Resolved | null {
  const id = rawId(e);
  switch (entryNs(e)) {
    case "pal":
      return { href: `/paldex/${id}`, icon: palIcon(id) };
    case "item":
      return { href: `/items/${id}`, icon: itemIcon(id) };
    case "tech": {
      const t = techByNameId.get(id);
      return t ? { href: `/tech#${t.id}` } : null;
    }
    case "building": {
      const b = buildingByMapObjectId.get(id);
      return b ? { href: `/buildings/${b.id}` } : null;
    }
    case "skill":
    case "passive":
      return {};
    case "marker":
      return { href: `/map?focus=${id}`, icon: e.pal ? palIcon(e.pal) : undefined };
    default:
      return null;
  }
}
