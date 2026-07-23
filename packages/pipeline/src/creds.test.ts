import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./creds";

const TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const SRV_A = "11111111-1111-1111-1111-111111111111";
const SRV_B = "22222222-2222-2222-2222-222222222222";

beforeAll(() => {
  process.env.SAVE_CREDS_KEY = TEST_KEY;
});

describe("creds AES-256-GCM", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(decrypt(enc, SRV_A)).toBe("hunter2");
  });

  it("préfixe de version v1", () => {
    expect(encrypt("x", SRV_A).startsWith("v1:")).toBe(true);
  });

  it("un mauvais serverId (AAD) fait échouer le déchiffrement", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(() => decrypt(enc, SRV_B)).toThrow();
  });

  it("une altération du ciphertext fait échouer le tag", () => {
    const enc = encrypt("hunter2", SRV_A);
    const raw = Buffer.from(enc.slice(3), "base64");
    raw[raw.length - 1] ^= 0xff;
    const tampered = "v1:" + raw.toString("base64");
    expect(() => decrypt(tampered, SRV_A)).toThrow();
  });

  it("un préfixe de version inconnu est rejeté", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(() => decrypt("v2:" + enc.slice(3), SRV_A)).toThrow();
  });
});
