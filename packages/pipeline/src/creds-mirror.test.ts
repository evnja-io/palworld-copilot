import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import * as creds from "./creds.ts";
import * as webCrypto from "../../../apps/web/src/lib/server/crypto.ts";

const TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const SRV = "11111111-1111-1111-1111-111111111111";

beforeAll(() => {
  process.env.SAVE_CREDS_KEY = TEST_KEY;
});

describe("miroir crypto.ts ↔ creds.ts", () => {
  it("les deux fichiers sources sont byte-identiques", () => {
    // fileURLToPath (pas .pathname) : .pathname donne "/C:/..." sous Windows.
    const a = readFileSync(fileURLToPath(new URL("./creds.ts", import.meta.url)), "utf8");
    const b = readFileSync(
      fileURLToPath(new URL("../../../apps/web/src/lib/server/crypto.ts", import.meta.url)),
      "utf8",
    );
    expect(a).toBe(b);
  });

  it("un ciphertext du web se déchiffre côté pipeline", () => {
    const enc = webCrypto.encrypt("s3cr3t", SRV);
    expect(creds.decrypt(enc, SRV)).toBe("s3cr3t");
  });

  it("un ciphertext du pipeline se déchiffre côté web", () => {
    const enc = creds.encrypt("s3cr3t", SRV);
    expect(webCrypto.decrypt(enc, SRV)).toBe("s3cr3t");
  });
});
