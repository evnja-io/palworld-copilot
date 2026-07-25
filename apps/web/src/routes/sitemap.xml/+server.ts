import pals from "@palworld-companion/game-data/pals.json";
import items from "@palworld-companion/game-data/items.json";
import buildings from "@palworld-companion/game-data/buildings.json";
import { GUEST_INDEXABLE_FEATURES } from "$lib/guest";
import { absoluteUrl, alternates } from "$lib/seo";
import { locales } from "$lib/paraglide/runtime";

// Liste entièrement dérivée de packages/game-data : rien de dynamique, donc
// prérendu au build. Vit hors de /s/[slug], donc aucun conflit avec le layout
// tenant (dont le load lit des cookies et ne peut pas être prérendu).
// Se périme après une mise à jour du jeu : un redéploiement suffit.
export const prerender = true;

/** Chemins publics, dans l'ordre d'importance décroissante. */
function publicPaths(): string[] {
  const entities = [
    ...(pals as Array<{ id: string }>).map((p) => `/paldex/${p.id}`),
    ...(items as Array<{ id: string }>).map((i) => `/items/${i.id}`),
    ...(buildings as Array<{ id: string }>).map((b) => `/buildings/${b.id}`),
  ];
  // La racine et /docs ne sont pas dans GUEST_FEATURES (ce sont des pages
  // publiques hors périmètre du reroute) : on les ajoute explicitement.
  // GUEST_INDEXABLE_FEATURES exclut /teams : espace de travail personnel, vide
  // pour un visiteur, et marqué noindex côté page.
  return ["/", "/docs", ...GUEST_INDEXABLE_FEATURES, ...entities];
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Une entrée <url> par (chemin × locale), chacune listant toutes ses variantes
 *  en <xhtml:link rel="alternate"> — format sitemap i18n de Google. La
 *  réciprocité est ce qui fait accepter les deux versions.
 *  Le jeu d'alternates est le MÊME que celui des balises <head> (x-default
 *  compris, cf. lib/seo.ts) : une divergence entre les deux invaliderait
 *  l'annotation aux yeux de Google. */
function urlEntry(path: string): string {
  const alts = alternates(path)
    .map(
      (alt) =>
        `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.href)}"/>`,
    )
    .join("\n");
  return locales
    .map((locale) =>
      ["  <url>", `    <loc>${escapeXml(absoluteUrl(path, locale))}</loc>`, alts, "  </url>"].join(
        "\n",
      ),
    )
    .join("\n");
}

export function GET() {
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...publicPaths().map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
