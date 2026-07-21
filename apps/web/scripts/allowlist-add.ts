import { neon } from "@neondatabase/serverless";

const [discordId, ...noteParts] = process.argv.slice(2);
if (!discordId || !/^\d{15,21}$/.test(discordId)) {
  console.error("Usage: allowlist:add <discordId numérique> [note]");
  process.exit(1);
}
const note = noteParts.join(" ") || null;
const sql = neon(process.env.DATABASE_URL!);
await sql`insert into allowlist (discord_id, note) values (${discordId}, ${note})
          on conflict (discord_id) do update set note = excluded.note`;
console.log(`OK : ${discordId}${note ? ` (${note})` : ""} est dans l'allowlist`);
