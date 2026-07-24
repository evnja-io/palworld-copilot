import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serverMembers = pgTable(
  "server_members",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull(),
    // GUID de joueur PAR monde : un même utilisateur a un GUID différent
    // sur chaque serveur (remplace users.palPlayerGuid, supprimé en migration B).
    palPlayerGuid: text("pal_player_guid"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.userId] }),
    uniqueIndex("server_members_guid_unique")
      .on(t.serverId, t.palPlayerGuid)
      .where(sql`${t.palPlayerGuid} is not null`),
  ],
);

export const progress = pgTable(
  "progress",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.userId, t.kind, t.entityId] }),
    index("progress_server_kind_idx").on(t.serverId, t.kind),
  ],
);

export const savePlayers = pgTable(
  "save_players",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    playerGuid: text("player_guid").notNull(),
    nickname: text("nickname").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.playerGuid] })],
);

export const saveSnapshots = pgTable(
  "save_snapshots",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    playerGuid: text("player_guid").notNull(),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.playerGuid, t.kind, t.entityId] })],
);

export const invites = pgTable("invites", {
  // 128 bits d'entropie : randomBytes(16).toString("base64url") côté servers.ts.
  code: text("code").primaryKey(),
  serverId: uuid("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // null = pas d'expiration ; null maxUses = usages illimités.
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
});

// Credentials SFTP par serveur : table séparée pour qu'AUCUN load de page ne
// sélectionne sftp_password_enc par accident (cf. getImportConfig, Tâche 7).
export const serverImportConfigs = pgTable("server_import_configs", {
  serverId: uuid("server_id")
    .primaryKey()
    .references(() => servers.id, { onDelete: "cascade" }),
  sftpHost: text("sftp_host").notNull(),
  sftpPort: integer("sftp_port").notNull().default(22),
  sftpUser: text("sftp_user").notNull(),
  // Ciphertext "v1:" + base64(iv ‖ ct ‖ tag), AAD = serverId (crypto.ts / creds.ts).
  sftpPasswordEnc: text("sftp_password_enc").notNull(),
  // NULL ⇒ auto-découverte du monde (Pal/Saved/SaveGames/0/<world>) au 1er import.
  remoteDir: text("remote_dir"),
  enabled: boolean("enabled").notNull().default(false),
  lastImportAt: timestamp("last_import_at", { withTimezone: true }),
  lastImportStatus: text("last_import_status", { enum: ["running", "ok", "error"] }),
  lastImportError: text("last_import_error"),
  lastImportStats: jsonb("last_import_stats"),
});

// Une ligne par tentative d'upload navigateur d'une save de monde local (co-op) ;
// cycle de vie : uploading → pending → running → ok|error.
export const saveUploads = pgTable(
  "save_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["uploading", "pending", "running", "ok", "error"] })
      .notNull()
      .default("uploading"),
    fileCount: integer("file_count").notNull().default(0),
    totalBytes: bigint("total_bytes", { mode: "number" }).notNull().default(0),
    error: text("error"),
    stats: jsonb("stats"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("save_uploads_server_created_idx").on(t.serverId, t.createdAt),
    // Backstop DB pour l'invariant "un seul upload actif par serveur" :
    // TOCTOU côté applicatif (SELECT puis INSERT) ne suffit pas, cf. createUpload.
    uniqueIndex("save_uploads_active_unique")
      .on(t.serverId)
      .where(sql`${t.status} in ('uploading', 'pending', 'running')`),
  ],
);
