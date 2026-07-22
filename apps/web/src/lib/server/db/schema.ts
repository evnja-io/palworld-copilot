import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  palPlayerGuid: text("pal_player_guid").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const allowlist = pgTable("allowlist", {
  discordId: text("discord_id").primaryKey(),
  addedBy: uuid("added_by").references(() => users.id),
  note: text("note"),
});

export const progress = pgTable(
  "progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.kind, t.entityId] }),
    index("progress_kind_entity_idx").on(t.kind, t.entityId),
  ],
);

export const savePlayers = pgTable("save_players", {
  playerGuid: text("player_guid").primaryKey(),
  nickname: text("nickname").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const saveSnapshots = pgTable(
  "save_snapshots",
  {
    playerGuid: text("player_guid").notNull(),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerGuid, t.kind, t.entityId] })],
);
