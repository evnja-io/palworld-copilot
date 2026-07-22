CREATE TABLE "save_snapshots" (
	"player_guid" text NOT NULL,
	"kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "save_snapshots_player_guid_kind_entity_id_pk" PRIMARY KEY("player_guid","kind","entity_id")
);
