import { describe, expect, it } from "vitest";
import { computeExitCode, parseDiscoveredDir } from "./import-all.ts";

describe("parseDiscoveredDir", () => {
  it("extrait le chemin de la dernière ligne marquée", () => {
    const out = "auto-découverte : Pal/Saved/SaveGames/0/W1\ntéléchargé : 3 saves\nDISCOVERED_REMOTE_DIR=Pal/Saved/SaveGames/0/W1\n";
    expect(parseDiscoveredDir(out)).toBe("Pal/Saved/SaveGames/0/W1");
  });
  it("retourne null en l'absence de marqueur", () => {
    expect(parseDiscoveredDir("téléchargé : 3 saves\n")).toBeNull();
  });
});

describe("computeExitCode", () => {
  it("0 quand aucun tenant", () => {
    expect(computeExitCode([])).toBe(0);
  });
  it("0 quand au moins un tenant réussit", () => {
    expect(computeExitCode([{ ok: false }, { ok: true }])).toBe(0);
  });
  it("1 quand tous les tenants échouent", () => {
    expect(computeExitCode([{ ok: false }, { ok: false }])).toBe(1);
  });
});
