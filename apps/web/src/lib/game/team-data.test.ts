import { describe, expect, it } from "vitest";
import pals from "@palworld-companion/game-data/pals.json";
import namesEn from "@palworld-companion/game-data/l10n/names.en.json";
import {
  ACTIVE_SKILL_IDS,
  PAL_IDS,
  PASSIVE_IDS,
  learnsetFor,
  partnerSkillNsId,
  passiveRank,
} from "./team-data";

describe("team-data", () => {
  it("PAL_IDS couvre pals.json", () => {
    expect(PAL_IDS.size).toBe((pals as Array<{ id: string }>).length);
    expect(PAL_IDS.has("Anubis")).toBe(true);
  });

  it("ACTIVE_SKILL_IDS exclut les partner skills et les skills sans nom EN", () => {
    expect(ACTIVE_SKILL_IDS.has("AirCanon")).toBe(true);
    expect(ACTIVE_SKILL_IDS.has("BlueThunderHorse_PartnerSkill")).toBe(false);
    expect(ACTIVE_SKILL_IDS.has("Human_Rolling")).toBe(false); // junk sans nom EN
    for (const id of ACTIVE_SKILL_IDS) {
      expect((namesEn as Record<string, string>)[`skill:${id}`]).toBeTruthy();
    }
  });

  it("PASSIVE_IDS non vide et cohérent", () => {
    expect(PASSIVE_IDS.size).toBeGreaterThan(400);
    expect(PASSIVE_IDS.has("AccuracyDecrease")).toBe(true);
    expect(passiveRank("AccuracyDecrease")).toBe(1);
  });

  it("learnsetFor est insensible à la casse (GhostAnglerFish dans pal-moves)", () => {
    expect(learnsetFor("GhostAnglerfish").length).toBeGreaterThan(0);
  });

  it("learnsetFor renvoie [] pour WorldTreeDragon (aucun learnset)", () => {
    expect(learnsetFor("WorldTreeDragon")).toEqual([]);
  });

  it("learnsetFor trie par niveau et ne contient que des skills éligibles", () => {
    const ls = learnsetFor("SheepBall");
    expect(ls.length).toBeGreaterThan(0);
    for (let i = 1; i < ls.length; i++) expect(ls[i].level).toBeGreaterThanOrEqual(ls[i - 1].level);
    for (const e of ls) expect(ACTIVE_SKILL_IDS.has(e.skillId)).toBe(true);
  });

  it("chaque Pal a un nom de partner skill FR et EN", async () => {
    const namesFr = (await import("@palworld-companion/game-data/l10n/names.fr.json")).default;
    for (const p of pals as Array<{ id: string }>) {
      const ns = partnerSkillNsId(p.id);
      expect((namesEn as Record<string, string>)[ns], ns).toBeTruthy();
      expect((namesFr as Record<string, string>)[ns], ns).toBeTruthy();
    }
  });
});
