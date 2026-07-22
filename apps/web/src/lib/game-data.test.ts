import { describe, expect, it } from "vitest";
import pals from "@palworld-companion/game-data/pals.json";
import namesFr from "@palworld-companion/game-data/l10n/names.fr.json";

describe("game-data importable depuis l'app", () => {
  it("expose les pals avec leurs noms FR", () => {
    expect(pals.length).toBeGreaterThan(150);
    const first = pals[0] as { id: string };
    expect((namesFr as Record<string, string>)[`pal:${first.id}`]).toBeTruthy();
  });
});
