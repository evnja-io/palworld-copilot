CREATE TABLE "base_demands" (
	"server_id" uuid NOT NULL,
	"base_id" text NOT NULL,
	"work_type" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "base_demands_server_id_base_id_work_type_pk" PRIMARY KEY("server_id","base_id","work_type")
);
--> statement-breakpoint
CREATE TABLE "save_bases" (
	"server_id" uuid NOT NULL,
	"base_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"name" text,
	"world_x" double precision,
	"world_y" double precision,
	"world_z" double precision,
	"area_range" double precision,
	"slot_count" integer,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "save_bases_server_id_base_id_pk" PRIMARY KEY("server_id","base_id")
);
--> statement-breakpoint
CREATE TABLE "save_guild_members" (
	"server_id" uuid NOT NULL,
	"guild_id" text NOT NULL,
	"player_guid" text NOT NULL,
	"player_name" text,
	"last_online_ticks" bigint,
	CONSTRAINT "save_guild_members_server_id_guild_id_player_guid_pk" PRIMARY KEY("server_id","guild_id","player_guid")
);
--> statement-breakpoint
CREATE TABLE "save_guilds" (
	"server_id" uuid NOT NULL,
	"guild_id" text NOT NULL,
	"name" text,
	"base_camp_level" integer DEFAULT 1 NOT NULL,
	"admin_player_guid" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "save_guilds_server_id_guild_id_pk" PRIMARY KEY("server_id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "save_pal_assignments" (
	"server_id" uuid NOT NULL,
	"instance_id" text NOT NULL,
	"base_id" text NOT NULL,
	"slot_index" integer NOT NULL,
	CONSTRAINT "save_pal_assignments_server_id_instance_id_pk" PRIMARY KEY("server_id","instance_id")
);
--> statement-breakpoint
ALTER TABLE "base_demands" ADD CONSTRAINT "base_demands_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_bases" ADD CONSTRAINT "save_bases_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_guild_members" ADD CONSTRAINT "save_guild_members_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_guilds" ADD CONSTRAINT "save_guilds_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_pal_assignments" ADD CONSTRAINT "save_pal_assignments_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "save_bases_guild_idx" ON "save_bases" USING btree ("server_id","guild_id");--> statement-breakpoint
CREATE INDEX "save_guild_members_player_idx" ON "save_guild_members" USING btree ("server_id","player_guid");--> statement-breakpoint
CREATE INDEX "save_pal_assignments_base_idx" ON "save_pal_assignments" USING btree ("server_id","base_id");