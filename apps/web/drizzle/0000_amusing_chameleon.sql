CREATE TABLE "allowlist" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"added_by" uuid,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_user_id_kind_entity_id_pk" PRIMARY KEY("user_id","kind","entity_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"pal_player_guid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id"),
	CONSTRAINT "users_pal_player_guid_unique" UNIQUE("pal_player_guid")
);
--> statement-breakpoint
ALTER TABLE "allowlist" ADD CONSTRAINT "allowlist_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progress_kind_entity_idx" ON "progress" USING btree ("kind","entity_id");