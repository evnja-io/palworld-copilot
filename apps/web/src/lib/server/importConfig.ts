import { eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import { encrypt } from "$lib/server/crypto";

export type ImportConfigView = {
  sftpHost: string;
  sftpPort: number;
  sftpUser: string;
  remoteDir: string | null;
  enabled: boolean;
  passwordSet: boolean;
  lastImportAt: Date | null;
  lastImportStatus: "running" | "ok" | "error" | null;
  lastImportError: string | null;
};

export type SaveImportConfigInput = {
  sftpHost: string;
  sftpPort: number;
  sftpUser: string;
  password: string; // vide = conserver l'existant
  remoteDir: string | null;
  enabled: boolean;
};

/** Champ vide + config existante ⇒ conserver ; vide sans config ⇒ erreur. */
export function resolvePasswordChange(
  input: string,
  hasExisting: boolean,
): { store: boolean; error?: "password_required" } {
  if (input.length > 0) return { store: true };
  if (hasExisting) return { store: false };
  return { store: false, error: "password_required" };
}

/** Vue de config SANS le ciphertext (aucun load de page ne lit sftp_password_enc). */
export async function getImportConfig(serverId: string): Promise<ImportConfigView | null> {
  const db = getDb();
  const rows = await db
    .select({
      sftpHost: tables.serverImportConfigs.sftpHost,
      sftpPort: tables.serverImportConfigs.sftpPort,
      sftpUser: tables.serverImportConfigs.sftpUser,
      remoteDir: tables.serverImportConfigs.remoteDir,
      enabled: tables.serverImportConfigs.enabled,
      lastImportAt: tables.serverImportConfigs.lastImportAt,
      lastImportStatus: tables.serverImportConfigs.lastImportStatus,
      lastImportError: tables.serverImportConfigs.lastImportError,
    })
    .from(tables.serverImportConfigs)
    .where(eq(tables.serverImportConfigs.serverId, serverId));
  const hit = rows[0];
  if (!hit) return null;
  return { ...hit, passwordSet: true };
}

export async function saveImportConfig(serverId: string, input: SaveImportConfigInput): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ serverId: tables.serverImportConfigs.serverId })
    .from(tables.serverImportConfigs)
    .where(eq(tables.serverImportConfigs.serverId, serverId));
  const hasExisting = existing.length > 0;

  const { store, error } = resolvePasswordChange(input.password, hasExisting);
  if (error) throw new Error(error);

  const base = {
    sftpHost: input.sftpHost,
    sftpPort: input.sftpPort,
    sftpUser: input.sftpUser,
    remoteDir: input.remoteDir,
    enabled: input.enabled,
  };

  if (!hasExisting) {
    // store est forcément true ici (sinon resolvePasswordChange a jeté).
    await db.insert(tables.serverImportConfigs).values({
      serverId,
      ...base,
      sftpPasswordEnc: encrypt(input.password, serverId),
    });
    return;
  }

  await db
    .update(tables.serverImportConfigs)
    .set(store ? { ...base, sftpPasswordEnc: encrypt(input.password, serverId) } : base)
    .where(eq(tables.serverImportConfigs.serverId, serverId));
}
