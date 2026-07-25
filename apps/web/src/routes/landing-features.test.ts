import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUEST_FEATURES } from "$lib/guest";

/** Garde de cohérence pour la grille de fonctionnalités de la landing.
 *
 *  Les `href` des cartes sont écrits en clair dans `+page.svelte` (composant
 *  Svelte, non importable depuis vitest sans compilation) : on les relit donc
 *  depuis la source. L'objectif n'est pas de tester le rendu mais d'empêcher la
 *  grille de pointer vers un chemin qui n'est pas — ou plus — public. */
const SOURCE = readFileSync(new URL("./+page.svelte", import.meta.url), "utf8");

/** Extrait les `href: '…'` du tableau `features`. */
function featureHrefs(): string[] {
  const start = SOURCE.indexOf("const features:");
  expect(start).toBeGreaterThan(-1);
  const end = SOURCE.indexOf("];", start);
  const block = SOURCE.slice(start, end);
  return [...block.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
}

describe("cartes de fonctionnalité de la landing", () => {
  it("ne pointe que vers des chemins publics de GUEST_FEATURES", () => {
    const hrefs = featureHrefs();
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(GUEST_FEATURES as readonly string[]).toContain(href);
    }
  });

  it("cible les 6 fonctionnalités publiques annoncées par la grille", () => {
    // items et buildings n'ont pas de carte ; serveurs, import et parties
    // locales n'ont pas de cible (synchronisation réservée aux membres).
    expect(featureHrefs().sort()).toEqual(
      ["/breeding", "/craft", "/map", "/paldex", "/teams", "/tech"].sort(),
    );
  });

  it("laisse les cartes de synchronisation sans cible", () => {
    // Si l'une de ces trois gagnait un href, ce serait une décision produit :
    // le test doit alors être mis à jour sciemment.
    const start = SOURCE.indexOf("const features:");
    const block = SOURCE.slice(start, SOURCE.indexOf("];", start));
    for (const key of ["landing_feat_servers_body", "landing_feat_import_body", "landing_feat_local_body"]) {
      const line = block.split("\n").find((l) => l.includes(key));
      expect(line, key).toBeDefined();
      expect(line).not.toContain("href:");
    }
  });
});
