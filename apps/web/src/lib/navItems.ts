import { m } from "$lib/paraglide/messages";
import { GUEST_FEATURES } from "$lib/guest";

export type NavItem = {
  href: string;
  label: () => string;
  /** Glyphe de la barre d'onglets mobile (relevés dans le HTML, 4a l.191-195). */
  glyph: string;
};

/** Les 9 fonctionnalités, dans l'ordre de la barre de navigation desktop.
 *  Source unique partagée par TopNav, TabBar et MobileNav. */
export const NAV: readonly NavItem[] = [
  { href: "/paldex", label: m.nav_paldex, glyph: "◉" },
  { href: "/teams", label: m.nav_teams, glyph: "▣" },
  { href: "/breeding", label: m.nav_breeding, glyph: "❋" },
  { href: "/bases", label: m.nav_bases, glyph: "⌂" },
  { href: "/items", label: m.nav_items, glyph: "◈" },
  { href: "/craft", label: m.nav_craft, glyph: "⚒" },
  { href: "/tech", label: m.nav_tech, glyph: "⬡" },
  { href: "/buildings", label: m.nav_buildings, glyph: "▤" },
  { href: "/map", label: m.nav_map, glyph: "✦" },
];

/** Les 4 fonctionnalités épinglées dans la barre d'onglets mobile ; la
 *  cinquième case est « Plus », qui ouvre la feuille.
 *
 *  Le handoff (4a) y met Paldex · Équipes · Craft · Objets · Carte, mais il ne
 *  connaît que 5 fonctionnalités au total. Avec 9, il faut en sacrifier une :
 *  c'est Objets qui descend dans « Plus » plutôt que Carte — la carte a son
 *  propre écran mobile dessiné (5b) et sert de second écran pendant la partie,
 *  là où le catalogue d'objets reste une référence, atteignable depuis le Craft
 *  et depuis ⌘K. */
export const TAB_HREFS = ["/paldex", "/teams", "/craft", "/map"] as const;

/** Un invité ne voit que les fonctionnalités ouvertes. GUEST_FEATURES est la
 *  même source que le reroute et le sitemap : pas de seconde liste. */
export function navFor(mode: "guest" | "member"): NavItem[] {
  return mode === "guest"
    ? NAV.filter((i) => (GUEST_FEATURES as readonly string[]).includes(i.href))
    : [...NAV];
}

export function tabsFor(mode: "guest" | "member"): NavItem[] {
  const allowed = navFor(mode);
  return TAB_HREFS.map((h) => allowed.find((i) => i.href === h)).filter(
    (i): i is NavItem => !!i
  );
}
