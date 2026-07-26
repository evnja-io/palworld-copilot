import {
  bigint,
  boolean,
  doublePrecision,
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
import type { TeamSlot } from "$lib/types";

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
  // Type de monde choisi à l'onboarding : "local" (save téléversée à la main)
  // ou "dedicated" (import SFTP auto). Route l'assistant post-création et
  // adapte l'UI (badge, réglages). Défaut "local" pour les serveurs existants.
  kind: text("kind", { enum: ["local", "dedicated"] })
    .notNull()
    .default("local"),
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

// Équipes de Pals : slots en jsonb pour une écriture atomique (neon-http n'a
// pas de transactions). PK surrogate (URLs) — écart assumé à la convention
// PK composite ; server_id reste dans chaque WHERE (cf. lib/server/teams.ts).
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    slots: jsonb("slots").$type<TeamSlot[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teams_server_idx").on(t.serverId)],
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

// Instances individuelles de Pals extraites de Level.sav (CharacterSaveParameterMap).
// Portée : pals possédés par un joueur (OwnerPlayerUId), équipe + palbox ; les
// pals postés en base peuvent apparaître (même owner), limitation documentée.
// owner_guid : UPPER sans tirets, joint server_members.pal_player_guid.
export const savePals = pgTable(
  "save_pals",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    instanceId: text("instance_id").notNull(), // GUID UPPER sans tirets
    ownerGuid: text("owner_guid").notNull(),
    palId: text("pal_id").notNull(), // id canonique pals.json
    gender: text("gender", { enum: ["male", "female"] }),
    level: integer("level").notNull().default(1),
    nickname: text("nickname"),
    passives: text("passives").array().notNull().default(sql`'{}'::text[]`),
    talentHp: integer("talent_hp"),
    talentShot: integer("talent_shot"),
    talentDefense: integer("talent_defense"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.instanceId] }),
    index("save_pals_owner_idx").on(t.serverId, t.ownerGuid),
  ],
);

// Guildes extraites de Level.sav (GroupSaveDataMap, group_type Guild). Remplacement
// idempotent par serveur à chaque import (cf. syncBaseData) : mêmes règles que save_pals.
export const saveGuilds = pgTable(
  "save_guilds",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(), // GUID UPPER sans tirets
    name: text("name"), // guild_name, vide -> NULL
    baseCampLevel: integer("base_camp_level").notNull().default(1),
    adminPlayerGuid: text("admin_player_guid"), // joint server_members.pal_player_guid (soft)
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.guildId] })],
);

// Membres de guilde (players[] du GroupSaveDataMap). player_guid joint soft
// server_members.pal_player_guid ET save_players.player_guid.
export const saveGuildMembers = pgTable(
  "save_guild_members",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    playerGuid: text("player_guid").notNull(),
    playerName: text("player_name"),
    // Ticks FDateTime bruts (~6.4e17 > 2^53) : mode bigint, non sélectionné par le
    // web en v1 (précision préservée pour un futur « vu en ligne »).
    lastOnlineTicks: bigint("last_online_ticks", { mode: "bigint" }),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.guildId, t.playerGuid] }),
    index("save_guild_members_player_idx").on(t.serverId, t.playerGuid), // résolution « ma guilde »
  ],
);

// Camps de base (BaseCampSaveData). Coordonnées monde brutes (transform.translation) :
// la projection carte (worldToMap) reste côté client si on trace un jour sur la carte.
export const saveBases = pgTable(
  "save_bases",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    baseId: text("base_id").notNull(),
    guildId: text("guild_id").notNull(), // group_id_belong_to (soft join save_guilds)
    name: text("name"),
    worldX: doublePrecision("world_x"),
    worldY: doublePrecision("world_y"),
    worldZ: doublePrecision("world_z"),
    areaRange: doublePrecision("area_range"),
    // Longueur du tableau de slots du conteneur WorkerDirector = capacité de travailleurs.
    slotCount: integer("slot_count"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.baseId] }),
    index("save_bases_guild_idx").on(t.serverId, t.guildId),
  ],
);

// Affectation pal -> base (slots du conteneur WorkerDirector). Table SÉPARÉE de
// save_pals : les deux syncs restent indépendants (un échec n'invalide pas l'autre).
export const savePalAssignments = pgTable(
  "save_pal_assignments",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    instanceId: text("instance_id").notNull(), // soft join save_pals.instance_id
    baseId: text("base_id").notNull(),
    slotIndex: integer("slot_index").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.instanceId] }), // un pal ne travaille qu'à une base
    index("save_pal_assignments_base_idx").on(t.serverId, t.baseId),
  ],
);

// Profil de demande MANUEL par base (config utilisateur, PAS dérivé de la save :
// survit aux imports). Poids 0..3 par type de travail ; absence de ligne = poids 1.
// Éditable par tout membre (requireMembership suffit, décision produit).
export const baseDemands = pgTable(
  "base_demands",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    baseId: text("base_id").notNull(), // soft : PAS de FK vers save_bases (wipe import)
    workType: text("work_type").notNull(), // clé work de pals.json (12 valeurs)
    weight: integer("weight").notNull().default(1), // 0..3, validé côté endpoint
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.baseId, t.workType] })],
);
