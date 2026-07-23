// Chiffrement des credentials SFTP au repos — AES-256-GCM, node:crypto, zéro dép.
// MIROIR STRICT de packages/pipeline/src/creds.ts : les deux fichiers doivent
// rester byte-identiques (test creds-mirror.test.ts). Format de fil :
//   "v1:" + base64(iv(12) ‖ ciphertext ‖ tag(16)), AAD = serverId.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const b64 = process.env.SAVE_CREDS_KEY;
  if (!b64) throw new Error("SAVE_CREDS_KEY manquante");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("SAVE_CREDS_KEY doit faire 32 octets (base64)");
  return key;
}

export function encrypt(plaintext: string, serverId: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(serverId, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, ct, tag]).toString("base64")}`;
}

export function decrypt(stored: string, serverId: string): string {
  const idx = stored.indexOf(":");
  const version = idx === -1 ? "" : stored.slice(0, idx);
  const payload = idx === -1 ? "" : stored.slice(idx + 1);
  if (version !== VERSION || payload.length === 0) {
    throw new Error("format de credential inconnu");
  }
  const raw = Buffer.from(payload, "base64");
  if (raw.length < IV_LEN + TAG_LEN) throw new Error("credential tronqué");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const ct = raw.subarray(IV_LEN, raw.length - TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAAD(Buffer.from(serverId, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
