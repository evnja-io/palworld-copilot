import { describe, expect, it } from "vitest";
import { MAX_FILES } from "$lib/upload-limits";
import { selectUploadFiles, validateSelection } from "./upload-select";

const HOST_GUID = "00000000000000000000000000000001"; // GUID hôte monde local
const PLAYER_HEX = "00AFD495000000000000000000000000";

describe("selectUploadFiles — sélection dossier (webkitdirectory)", () => {
  it("garde Level.sav à la racine du dossier", () => {
    const { kept, ignoredCount } = selectUploadFiles([
      { name: "Level.sav", size: 100, relativePath: "MyWorld/Level.sav" },
    ]);
    expect(kept).toEqual([
      { name: "Level.sav", size: 100, relativePath: "MyWorld/Level.sav", kind: "level" },
    ]);
    expect(ignoredCount).toBe(0);
  });

  it("garde les saves joueur sous Players/, y compris le GUID hôte", () => {
    const { kept, ignoredCount } = selectUploadFiles([
      {
        name: `${PLAYER_HEX}.sav`,
        size: 10,
        relativePath: `MyWorld/Players/${PLAYER_HEX}.sav`,
      },
      {
        name: `${HOST_GUID}.sav`,
        size: 20,
        relativePath: `MyWorld/Players/${HOST_GUID}.sav`,
      },
    ]);
    expect(kept.map((f) => f.kind)).toEqual(["player", "player"]);
    expect(ignoredCount).toBe(0);
  });

  it("ignore Level.sav s'il se trouve sous Players/", () => {
    const { kept, ignoredCount } = selectUploadFiles([
      { name: "Level.sav", size: 100, relativePath: "MyWorld/Players/Level.sav" },
    ]);
    expect(kept).toEqual([]);
    expect(ignoredCount).toBe(1);
  });

  it("ignore une save au nom hexadécimal placée hors de Players/", () => {
    const { kept, ignoredCount } = selectUploadFiles([
      { name: `${PLAYER_HEX}.sav`, size: 10, relativePath: `MyWorld/${PLAYER_HEX}.sav` },
    ]);
    expect(kept).toEqual([]);
    expect(ignoredCount).toBe(1);
  });

  it("ignore les fichiers non pertinents (extension, dossier annexe, nom invalide)", () => {
    const { kept, ignoredCount } = selectUploadFiles([
      { name: "readme.txt", size: 5, relativePath: "MyWorld/readme.txt" },
      { name: "Backup.sav", size: 5, relativePath: "MyWorld/Backup/Backup.sav" },
      { name: "notaguid.sav", size: 5, relativePath: "MyWorld/Players/notaguid.sav" },
    ]);
    expect(kept).toEqual([]);
    expect(ignoredCount).toBe(3);
  });
});

describe("selectUploadFiles — sélection multi-fichiers (fallback)", () => {
  it("garde Level.sav et les saves joueur sélectionnés directement (pas de chemin)", () => {
    const { kept, ignoredCount } = selectUploadFiles([
      { name: "Level.sav", size: 100, relativePath: "Level.sav" },
      { name: `${PLAYER_HEX}.sav`, size: 10, relativePath: `${PLAYER_HEX}.sav` },
      { name: `${HOST_GUID}.sav`, size: 20, relativePath: `${HOST_GUID}.sav` },
    ]);
    expect(kept.map((f) => f.kind)).toEqual(["level", "player", "player"]);
    expect(ignoredCount).toBe(0);
  });

  it("ignore un fichier .sav au nom non conforme en fallback", () => {
    const { kept, ignoredCount } = selectUploadFiles([
      { name: "random.sav", size: 10, relativePath: "random.sav" },
    ]);
    expect(kept).toEqual([]);
    expect(ignoredCount).toBe(1);
  });
});

describe("validateSelection", () => {
  function kept(overrides: Partial<{ level: number; players: number[] }> = {}) {
    const files: Array<{ name: string; size: number; relativePath: string; kind: "level" | "player" }> =
      [];
    if (overrides.level !== undefined) {
      files.push({ name: "Level.sav", size: overrides.level, relativePath: "Level.sav", kind: "level" });
    }
    for (const [i, size] of (overrides.players ?? []).entries()) {
      files.push({
        name: `${i.toString().padStart(32, "0")}.sav`,
        size,
        relativePath: `Players/${i.toString().padStart(32, "0")}.sav`,
        kind: "player",
      });
    }
    return files;
  }

  it("échoue si Level.sav est absent", () => {
    expect(validateSelection(kept({ players: [10] }))).toEqual({
      ok: false,
      error: "missing_level",
    });
  });

  it("échoue si aucune save joueur n'est présente", () => {
    expect(validateSelection(kept({ level: 10 }))).toEqual({
      ok: false,
      error: "missing_player",
    });
  });

  it("échoue au-delà de MAX_FILES fichiers", () => {
    const players = Array.from({ length: MAX_FILES }, () => 10);
    const result = validateSelection(kept({ level: 10, players }));
    expect(result).toEqual({ ok: false, error: "too_many_files" });
  });

  it("échoue si Level.sav dépasse MAX_LEVEL_BYTES", () => {
    const result = validateSelection(kept({ level: 300 * 1024 * 1024, players: [10] }));
    expect(result).toEqual({ ok: false, error: "level_too_large" });
  });

  it("échoue si une save joueur dépasse MAX_PLAYER_BYTES", () => {
    const result = validateSelection(kept({ level: 10, players: [20 * 1024 * 1024] }));
    expect(result).toEqual({ ok: false, error: "player_too_large" });
  });

  it("réussit avec Level.sav + au moins une save joueur, sous les plafonds", () => {
    const result = validateSelection(kept({ level: 10, players: [10, 20] }));
    expect(result).toEqual({ ok: true });
  });
});
