import { describe, expect, it } from "vitest";
import { MAX_FILES, MAX_LEVEL_BYTES, MAX_PLAYER_BYTES } from "$lib/upload-limits";
import { blobPrefix, isValidUploadPathname, validateBlobListing } from "./uploads";

const SID = "11111111-1111-1111-1111-111111111111";
const UID = "22222222-2222-2222-2222-222222222222";
const HOST_GUID = "00000000000000000000000000000001"; // GUID hôte monde local
const PLAYER_HEX = "00AFD495000000000000000000000000";

describe("blobPrefix", () => {
  it("construit le préfixe uploads/<serverId>/<uploadId>/", () => {
    expect(blobPrefix(SID, UID)).toBe(`uploads/${SID}/${UID}/`);
  });
});

describe("isValidUploadPathname", () => {
  it("accepte Level.sav à la racine du préfixe", () => {
    expect(isValidUploadPathname(`${blobPrefix(SID, UID)}Level.sav`, SID, UID)).toBe(true);
  });

  it("accepte une save joueur valide sous Players/", () => {
    expect(
      isValidUploadPathname(`${blobPrefix(SID, UID)}Players/${PLAYER_HEX}.sav`, SID, UID),
    ).toBe(true);
  });

  it("accepte le GUID hôte du monde local sous Players/", () => {
    expect(
      isValidUploadPathname(`${blobPrefix(SID, UID)}Players/${HOST_GUID}.sav`, SID, UID),
    ).toBe(true);
  });

  it("rejette un mauvais serverId/uploadId de préfixe", () => {
    expect(isValidUploadPathname(`uploads/${UID}/${SID}/Level.sav`, SID, UID)).toBe(false);
    expect(
      isValidUploadPathname(`uploads/other/${UID}/Players/${PLAYER_HEX}.sav`, SID, UID),
    ).toBe(false);
  });

  it("rejette la traversée de chemin (../)", () => {
    expect(isValidUploadPathname(`${blobPrefix(SID, UID)}../Level.sav`, SID, UID)).toBe(false);
    expect(
      isValidUploadPathname(`${blobPrefix(SID, UID)}Players/../Level.sav`, SID, UID),
    ).toBe(false);
  });

  it("rejette Level.sav sous Players/", () => {
    expect(isValidUploadPathname(`${blobPrefix(SID, UID)}Players/Level.sav`, SID, UID)).toBe(
      false,
    );
  });

  it("rejette une save joueur à la racine (hors Players/)", () => {
    expect(isValidUploadPathname(`${blobPrefix(SID, UID)}${PLAYER_HEX}.sav`, SID, UID)).toBe(
      false,
    );
  });

  it("rejette un nom de fichier non-hexadécimal", () => {
    expect(
      isValidUploadPathname(`${blobPrefix(SID, UID)}Players/not-hex-name.sav`, SID, UID),
    ).toBe(false);
  });

  it("rejette une extension supplémentaire (.sav.json)", () => {
    expect(
      isValidUploadPathname(`${blobPrefix(SID, UID)}Players/${PLAYER_HEX}.sav.json`, SID, UID),
    ).toBe(false);
  });

  it("rejette une imbrication de dossiers supplémentaire", () => {
    expect(
      isValidUploadPathname(`${blobPrefix(SID, UID)}Players/sub/${PLAYER_HEX}.sav`, SID, UID),
    ).toBe(false);
  });

  it("rejette un nom de fichier vide", () => {
    expect(isValidUploadPathname(`${blobPrefix(SID, UID)}Players/`, SID, UID)).toBe(false);
    expect(isValidUploadPathname(`${blobPrefix(SID, UID)}Players/.sav`, SID, UID)).toBe(false);
  });
});

describe("caps constants", () => {
  it("le plafond joueur est strictement inférieur au plafond level", () => {
    expect(MAX_PLAYER_BYTES).toBeLessThan(MAX_LEVEL_BYTES);
  });

  it("MAX_FILES autorise plus d'un fichier", () => {
    expect(MAX_FILES).toBeGreaterThan(1);
  });
});

describe("validateBlobListing", () => {
  const prefix = blobPrefix(SID, UID);

  it("valide une liste correcte (Level.sav + 1 save joueur)", () => {
    const result = validateBlobListing(
      [
        { pathname: `${prefix}Level.sav`, size: 1000 },
        { pathname: `${prefix}Players/${PLAYER_HEX}.sav`, size: 500 },
      ],
      SID,
      UID,
    );
    expect(result).toEqual({ ok: true, fileCount: 2, totalBytes: 1500 });
  });

  it("rejette une liste vide", () => {
    expect(validateBlobListing([], SID, UID)).toEqual({ ok: false, error: "empty" });
  });

  it("rejette l'absence de Level.sav", () => {
    const result = validateBlobListing(
      [{ pathname: `${prefix}Players/${PLAYER_HEX}.sav`, size: 500 }],
      SID,
      UID,
    );
    expect(result).toEqual({ ok: false, error: "missing_level" });
  });

  it("rejette l'absence de save joueur", () => {
    const result = validateBlobListing([{ pathname: `${prefix}Level.sav`, size: 1000 }], SID, UID);
    expect(result).toEqual({ ok: false, error: "missing_player" });
  });

  it("rejette un pathname invalide dans la liste", () => {
    const result = validateBlobListing(
      [
        { pathname: `${prefix}Level.sav`, size: 1000 },
        { pathname: `${prefix}Players/not-hex.sav`, size: 500 },
      ],
      SID,
      UID,
    );
    expect(result).toEqual({ ok: false, error: "invalid_pathname" });
  });

  it("rejette plus de MAX_FILES fichiers", () => {
    const blobs = [
      { pathname: `${prefix}Level.sav`, size: 1000 },
      ...Array.from({ length: MAX_FILES }, (_, i) => ({
        pathname: `${prefix}Players/${i.toString(16).padStart(32, "0")}.sav`,
        size: 500,
      })),
    ];
    expect(validateBlobListing(blobs, SID, UID)).toEqual({
      ok: false,
      error: "too_many_files",
    });
  });

  it("rejette un Level.sav trop volumineux", () => {
    const result = validateBlobListing(
      [
        { pathname: `${prefix}Level.sav`, size: MAX_LEVEL_BYTES + 1 },
        { pathname: `${prefix}Players/${PLAYER_HEX}.sav`, size: 500 },
      ],
      SID,
      UID,
    );
    expect(result).toEqual({ ok: false, error: "level_too_large" });
  });

  it("rejette une save joueur trop volumineuse", () => {
    const result = validateBlobListing(
      [
        { pathname: `${prefix}Level.sav`, size: 1000 },
        { pathname: `${prefix}Players/${PLAYER_HEX}.sav`, size: MAX_PLAYER_BYTES + 1 },
      ],
      SID,
      UID,
    );
    expect(result).toEqual({ ok: false, error: "player_too_large" });
  });
});
