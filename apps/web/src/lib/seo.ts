import { baseLocale, locales, localizeUrl, type Locale } from "$lib/paraglide/runtime";

/** Origine canonique du site. Volontairement en dur plutôt que déduite de la
 *  requête : les balises canonical/hreflang et le sitemap doivent désigner la
 *  même URL depuis un preview Vercel, en local ou en production. */
export const SITE_URL = "https://palwork.evnja.gg";

/** Locale → attribut Open Graph (`og:locale`). */
const OG_LOCALES: Record<Locale, string> = { fr: "fr_FR", en: "en_US" };

export function ogLocale(locale: Locale): string {
  return OG_LOCALES[locale] ?? locale;
}

/** URL absolue et localisée d'un chemin interne :
 *  ('/paldex/SheepBall', 'en') → 'https://palwork.evnja.gg/en/paldex/SheepBall'.
 *  Passe par localizeUrl (et non localizeHref) pour ne pas dépendre de
 *  l'origine de la requête courante. */
export function absoluteUrl(path: string, locale: Locale): string {
  return localizeUrl(new URL(path, SITE_URL), { locale }).href;
}

export type Alternate = { hreflang: string; href: string };

/** Paires hreflang d'un chemin : une par locale, plus `x-default` sur la locale
 *  de base. C'est ce qui fait exister les deux versions aux yeux de Google —
 *  sans réciprocité, il n'en indexe qu'une. */
export function alternates(path: string): Alternate[] {
  const out: Alternate[] = locales.map((locale) => ({
    hreflang: locale,
    href: absoluteUrl(path, locale),
  }));
  out.push({ hreflang: "x-default", href: absoluteUrl(path, baseLocale) });
  return out;
}
