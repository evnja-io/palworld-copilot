CREATE TABLE "save_pals" (
	"server_id" uuid NOT NULL,
	"instance_id" text NOT NULL,
	"owner_guid" text NOT NULL,
	"pal_id" text NOT NULL,
	"gender" text,
	"level" integer DEFAULT 1 NOT NULL,
	"nickname" text,
	"passives" text[] DEFAULT '{}'::text[] NOT NULL,
	"talent_hp" integer,
	"talent_shot" integer,
	"talent_defense" integer,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "save_pals_server_id_instance_id_pk" PRIMARY KEY("server_id","instance_id")
);
--> statement-breakpoint
ALTER TABLE "save_pals" ADD CONSTRAINT "save_pals_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "save_pals_owner_idx" ON "save_pals" USING btree ("server_id","owner_guid");