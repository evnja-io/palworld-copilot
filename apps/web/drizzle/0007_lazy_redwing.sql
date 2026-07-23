CREATE TABLE "server_import_configs" (
	"server_id" uuid PRIMARY KEY NOT NULL,
	"sftp_host" text NOT NULL,
	"sftp_port" integer DEFAULT 22 NOT NULL,
	"sftp_user" text NOT NULL,
	"sftp_password_enc" text NOT NULL,
	"remote_dir" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_import_at" timestamp with time zone,
	"last_import_status" text,
	"last_import_error" text,
	"last_import_stats" jsonb
);
--> statement-breakpoint
ALTER TABLE "server_import_configs" ADD CONSTRAINT "server_import_configs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;