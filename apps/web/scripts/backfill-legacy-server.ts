// Backfill multi-tenant : crée le serveur "legacy" et y rattache l'existant.
// Usage : pnpm --filter web backfill:legacy <discordId de l'owner> [nom du serveur]
// Idempotent : rejouable autant de fois que nécessaire (rattrape les lignes
// créées entre deux exécutions — pas de transactions avec neon-http).
import { neon } from "@neondatabase/serverless";

const [ownerDiscordId, ...nameParts] = process.argv.slice(2);
if (!ownerDiscordId || !/^\d{15,21}$/.test(ownerDiscordId)) {
  console.error("Usage: backfill:legacy <discordId numérique de l'owner> [nom]");
  process.exit(1);
}
const name = nameParts.join(" ") || "Notre serveur";
const sql = neon(process.env.DATABASE_URL!);

const owners = await sql`select id from users where discord_id = ${ownerDiscordId}`;
if (owners.length === 0) {
  console.error("Owner introuvable dans users — il doit s'être connecté au moins une fois.");
  process.exit(1);
}
const ownerId: string = owners[0].id;

await sql`insert into servers (name, slug, owner_id)
          values (${name}, 'legacy', ${ownerId}) on conflict (slug) do nothing`;
const [srv] = await sql`select id from servers where slug = 'legacy'`;

const members = await sql`
  insert into server_members (server_id, user_id, role, pal_player_guid)
  select ${srv.id}::uuid, u.id,
         case when u.id = ${ownerId}::uuid then 'owner' else 'member' end,
         u.pal_player_guid
  from users u
  on conflict (server_id, user_id) do nothing
  returning user_id`;

const p = await sql`update progress set server_id = ${srv.id}::uuid
                    where server_id is null returning 1 as one`;
const s = await sql`update save_snapshots set server_id = ${srv.id}::uuid
                    where server_id is null returning 1 as one`;
const n = await sql`update save_players set server_id = ${srv.id}::uuid
                    where server_id is null returning 1 as one`;

console.log(`serveur legacy ${srv.id} : +${members.length} membres, ` +
  `${p.length} progress / ${s.length} snapshots / ${n.length} pseudos rattachés`);
