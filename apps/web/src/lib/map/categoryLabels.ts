// Libellés i18n des catégories, séparés de categories.ts pour que les modules
// purs (et leurs tests) n'aient pas à charger le runtime Paraglide.
import { m } from "$lib/paraglide/messages";
import type { CatKey } from "./categories";

export function catLabel(key: CatKey): string {
  switch (key) {
    case "relic":
      return m.map_cat_relic();
    case "alpha":
      return m.map_cat_alpha();
    case "boss":
      return m.map_cat_boss();
    case "tower":
      return m.map_cat_tower();
    case "watchtower":
      return m.map_cat_watchtower();
    case "ft":
      return m.map_cat_ft();
    case "resource":
      return m.map_cat_resource();
    case "spawn":
      return m.map_cat_spawn();
  }
}

export function catShort(key: CatKey): string {
  switch (key) {
    case "relic":
      return m.map_cat_relic_short();
    case "alpha":
      return m.map_cat_alpha_short();
    case "boss":
      return m.map_cat_boss_short();
    case "tower":
      return m.map_cat_tower_short();
    case "watchtower":
      return m.map_cat_watchtower_short();
    case "ft":
      return m.map_cat_ft_short();
    case "resource":
      return m.map_cat_resource_short();
    case "spawn":
      return m.map_cat_spawn_short();
  }
}
