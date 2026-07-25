import { describe, expect, it } from "vitest";
import { MAX_IDS_PER_KIND, parseGuestImport } from "./guestImport";
import { MAX_GUEST_TEAMS } from "$lib/guest";

/** error() de SvelteKit lève un HttpError : on capture le statut. */
function statusOf(fn: () => unknown): number | "no-throw" {
  try {
    fn();
    return "no-throw";
  } catch (e) {
    return (e as { status?: number }).status ?? -1;
  }
}

const slot = { palId: "Anubis", passives: ["ElementBoost_Earth_2_PAL"], actives: ["RockBeat"] };
const team = (name = "Alpha") => ({ name, notes: "", slots: [slot, null, null, null, null] });

describe("parseGuestImport — progression", () => {
  it("accepte un payload vide", () => {
    expect(parseGuestImport({})).toEqual({ progress: {}, teams: [] });
  });

  it("conserve les ids valides et déduplique", () => {
    const out = parseGuestImport({
      progress: { pal_caught: ["SheepBall", "PinkCat", "SheepBall"] },
    });
    expect(out.progress.pal_caught).toEqual(["SheepBall", "PinkCat"]);
  });

  it("ignore silencieusement les ids inconnus du registre", () => {
    // game-data a pu être régénéré depuis l'écriture du localStorage : on filtre
    // sans rejeter tout le payload.
    const out = parseGuestImport({
      progress: { pal_caught: ["SheepBall", "PalQuiNExistePas", 42, null] },
    });
    expect(out.progress.pal_caught).toEqual(["SheepBall"]);
  });

  it("n'accepte que les kinds du registre invité", () => {
    const out = parseGuestImport({
      progress: {
        pal_caught: ["SheepBall"],
        tech_unlocked: ["Workbench"],
        marker: ["relic_013ff2fc4ddccc22c290a09264f499bc"],
        // Kind hors registre : ignoré, jamais inséré.
        __proto__: ["nope"],
        inventé: ["nope"],
      },
    });
    expect(Object.keys(out.progress).sort()).toEqual(["marker", "pal_caught", "tech_unlocked"]);
  });

  it("refuse un marker non cochable (boss, voyage rapide)", () => {
    const out = parseGuestImport({
      progress: { marker: ["alpha_yamijima_IceLand_pink_D_BOSS"] },
    });
    expect(out.progress.marker).toEqual([]);
  });

  it("refuse une liste d'ids trop longue", () => {
    const tooMany = Array.from({ length: MAX_IDS_PER_KIND + 1 }, (_, i) => `x${i}`);
    expect(statusOf(() => parseGuestImport({ progress: { pal_caught: tooMany } }))).toBe(400);
  });

  it("refuse progress non-objet", () => {
    expect(statusOf(() => parseGuestImport({ progress: [] }))).toBe(400);
    expect(statusOf(() => parseGuestImport({ progress: "x" }))).toBe(400);
    expect(statusOf(() => parseGuestImport({ progress: { pal_caught: "x" } }))).toBe(400);
  });

  it("refuse un corps non-objet", () => {
    expect(statusOf(() => parseGuestImport(null))).toBe(400);
    expect(statusOf(() => parseGuestImport([]))).toBe(400);
    expect(statusOf(() => parseGuestImport("x"))).toBe(400);
  });
});

describe("parseGuestImport — équipes", () => {
  it("valide et normalise les équipes", () => {
    const out = parseGuestImport({ teams: [team("  Alpha  ")] });
    expect(out.teams).toHaveLength(1);
    expect(out.teams[0].name).toBe("Alpha"); // trim
    expect(out.teams[0].slots).toHaveLength(5); // padding
  });

  it("refuse au-delà du plafond d'équipes invité", () => {
    const many = Array.from({ length: MAX_GUEST_TEAMS + 1 }, (_, i) => team(`T${i}`));
    expect(statusOf(() => parseGuestImport({ teams: many }))).toBe(400);
  });

  it("refuse un nom vide ou trop long", () => {
    expect(statusOf(() => parseGuestImport({ teams: [team("   ")] }))).toBe(400);
    expect(statusOf(() => parseGuestImport({ teams: [team("x".repeat(81))] }))).toBe(400);
  });

  it("refuse un pal, un passif ou un skill inconnu", () => {
    expect(
      statusOf(() =>
        parseGuestImport({ teams: [{ name: "A", notes: "", slots: [{ ...slot, palId: "Nope" }] }] }),
      ),
    ).toBe(400);
    expect(
      statusOf(() =>
        parseGuestImport({
          teams: [{ name: "A", notes: "", slots: [{ ...slot, passives: ["Nope"] }] }],
        }),
      ),
    ).toBe(400);
    expect(
      statusOf(() =>
        parseGuestImport({
          teams: [{ name: "A", notes: "", slots: [{ ...slot, actives: ["Nope"] }] }],
        }),
      ),
    ).toBe(400);
  });

  it("refuse un slot avec des clés en trop", () => {
    expect(
      statusOf(() =>
        parseGuestImport({
          teams: [{ name: "A", notes: "", slots: [{ ...slot, injecté: true }] }],
        }),
      ),
    ).toBe(400);
  });

  it("refuse plus de 5 slots et des notes trop longues", () => {
    expect(
      statusOf(() =>
        parseGuestImport({ teams: [{ name: "A", notes: "", slots: Array(6).fill(null) }] }),
      ),
    ).toBe(400);
    expect(
      statusOf(() =>
        parseGuestImport({ teams: [{ name: "A", notes: "x".repeat(2001), slots: [] }] }),
      ),
    ).toBe(400);
  });

  it("refuse teams non-tableau", () => {
    expect(statusOf(() => parseGuestImport({ teams: {} }))).toBe(400);
  });
});
