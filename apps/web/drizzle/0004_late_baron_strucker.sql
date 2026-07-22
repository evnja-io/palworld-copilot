ALTER TABLE "users" DROP CONSTRAINT "users_pal_player_guid_unique";--> statement-breakpoint
DROP INDEX "progress_kind_entity_idx";--> statement-breakpoint
ALTER TABLE "progress" DROP CONSTRAINT "progress_user_id_kind_entity_id_pk";--> statement-breakpoint
ALTER TABLE "save_snapshots" DROP CONSTRAINT "save_snapshots_player_guid_kind_entity_id_pk";--> statement-breakpoint
ALTER TABLE "progress" ALTER COLUMN "server_id" SET NOT NULL;--> statement-breakpoint
-- drizzle-kit ne retrouve pas automatiquement le nom de la contrainte de PK
-- inline (définie via `.primaryKey()` sur une seule colonne dans la migration
-- 0002). Postgres l'a nommée selon sa convention par défaut : "<table>_pkey".
-- Relu et complété à la main (cf. rapport Tâche 6) pour que le DROP/ADD de PK
-- ci-dessous s'exécute correctement.
ALTER TABLE "save_players" DROP CONSTRAINT "save_players_pkey";--> statement-breakpoint
ALTER TABLE "save_players" ALTER COLUMN "server_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "save_snapshots" ALTER COLUMN "server_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_server_id_user_id_kind_entity_id_pk" PRIMARY KEY("server_id","user_id","kind","entity_id");--> statement-breakpoint
ALTER TABLE "save_players" ADD CONSTRAINT "save_players_server_id_player_guid_pk" PRIMARY KEY("server_id","player_guid");--> statement-breakpoint
ALTER TABLE "save_snapshots" ADD CONSTRAINT "save_snapshots_server_id_player_guid_kind_entity_id_pk" PRIMARY KEY("server_id","player_guid","kind","entity_id");--> statement-breakpoint
CREATE INDEX "progress_server_kind_idx" ON "progress" USING btree ("server_id","kind");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "pal_player_guid";