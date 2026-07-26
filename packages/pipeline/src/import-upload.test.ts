import { describe, expect, it } from "vitest";
import { classifyStale, localPathFor } from "./import-upload.ts";

describe("localPathFor", () => {
  const uploadId = "9e6a9f0a-6b1a-4b7b-9c1a-000000000001";

  it("Level.sav à la racine de l'upload", () => {
    expect(localPathFor(`uploads/srv-1/${uploadId}/Level.sav`, uploadId)).toBe("Level.sav");
  });

  it("save joueur imbriquée sous Players/", () => {
    const guid = "00000000000000000000000000000001";
    expect(localPathFor(`uploads/srv-1/${uploadId}/Players/${guid}.sav`, uploadId)).toBe(`${guid}.sav`);
  });

  it("accepte un GUID hex mixte sous Players/", () => {
    const guid = "0000000000000000000000000000AB01";
    expect(localPathFor(`uploads/srv-1/${uploadId}/Players/${guid}.sav`, uploadId)).toBe(`${guid}.sav`);
  });

  it("rejette une save joueur à plat (hors dossier Players/)", () => {
    const guid = "00000000000000000000000000000001";
    expect(localPathFor(`uploads/srv-1/${uploadId}/${guid}.sav`, uploadId)).toBeNull();
  });

  it("rejette une imbrication supplémentaire sous Players/", () => {
    const guid = "00000000000000000000000000000001";
    expect(localPathFor(`uploads/srv-1/${uploadId}/Players/sub/${guid}.sav`, uploadId)).toBeNull();
  });

  it("rejette un pathname hors motif attendu", () => {
    expect(localPathFor(`uploads/srv-1/${uploadId}/notes.txt`, uploadId)).toBeNull();
  });

  it("rejette un pathname appartenant à un autre upload", () => {
    expect(localPathFor(`uploads/srv-1/autre-upload/Level.sav`, uploadId)).toBeNull();
  });
});

describe("classifyStale", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("'running' dont started_at dépasse 2h -> running_lost", () => {
    const startedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000 - 1000);
    expect(classifyStale({ status: "running", startedAt, createdAt: startedAt }, now)).toBe("running_lost");
  });

  it("'running' à exactement 2h -> ok (limite non dépassée)", () => {
    const startedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(classifyStale({ status: "running", startedAt, createdAt: startedAt }, now)).toBe("ok");
  });

  it("'running' récent -> ok", () => {
    const startedAt = new Date(now.getTime() - 60_000);
    expect(classifyStale({ status: "running", startedAt, createdAt: startedAt }, now)).toBe("ok");
  });

  it("'uploading' dont created_at dépasse 24h -> uploading_abandoned", () => {
    const createdAt = new Date(now.getTime() - 24 * 60 * 60 * 1000 - 1000);
    expect(classifyStale({ status: "uploading", startedAt: null, createdAt }, now)).toBe("uploading_abandoned");
  });

  it("'uploading' à exactement 24h -> ok (limite non dépassée)", () => {
    const createdAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(classifyStale({ status: "uploading", startedAt: null, createdAt }, now)).toBe("ok");
  });

  it("statuts terminaux ('ok'/'error'/'pending') -> toujours ok, quel que soit l'âge", () => {
    const veryOld = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365);
    expect(classifyStale({ status: "ok", startedAt: veryOld, createdAt: veryOld }, now)).toBe("ok");
    expect(classifyStale({ status: "error", startedAt: veryOld, createdAt: veryOld }, now)).toBe("ok");
    expect(classifyStale({ status: "pending", startedAt: null, createdAt: veryOld }, now)).toBe("ok");
  });
});
