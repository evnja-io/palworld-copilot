CREATE TABLE "save_players" (
	"player_guid" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
