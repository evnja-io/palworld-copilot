import { describe, expect, it } from "vitest";
import { computeSnapshotRows, normalizeGuid } from "./import-lib";

const palIds = new Map<string, string>([["anubis", "Anubis"], ["sheepball", "Sheepball"]]);
const techIds = new Map<string, string>([["workbench", "Workbench"]]);

describe("normalizeGuid", () => {
  it("retire les tirets et met en majuscules", () => {
    expect(normalizeGuid("00afd495-0000-0000-0000-000000000000")).toBe(
      "00AFD495000000000000000000000000",
    );
  });
});

describe("computeSnapshotRows", () => {
  it("résout la casse vers l'ID canonique et ne garde que value===true", () => {
    const save = {
      properties: {
        SaveData: {
          value: {
            UnlockedRecipeTechnologyNames: { value: { values: ["WORKBENCH"] } },
            RecordData: {
              value: {
                PaldeckUnlockFlag: {
                  value: [
                    { key: "ANUBIS", value: true },
                    { key: "sheepball", value: false },
                  ],
                },
                RelicObtainForInstanceFlag: {
                  value: [{ key: "01-3F-F2", value: true }],
                },
              },
            },
          },
        },
      },
    };
    const rows = computeSnapshotRows(save, palIds, techIds);
    expect(rows).toContainEqual({ kind: "pal_caught", id: "Anubis" });
    expect(rows).toContainEqual({ kind: "tech_unlocked", id: "Workbench" });
    expect(rows).toContainEqual({ kind: "raw:relic", id: "013ff2" });
    expect(rows).not.toContainEqual({ kind: "pal_caught", id: "Sheepball" });
  });

  it("tolère une save fraîche sans les flags (défensif)", () => {
    const save = { properties: { SaveData: { value: { RecordData: { value: {} } } } } };
    expect(computeSnapshotRows(save, palIds, techIds)).toEqual([]);
  });
});
