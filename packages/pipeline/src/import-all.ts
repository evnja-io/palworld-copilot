// Worker fan-out : importe les saves de tous les tenants `enabled`, un par un,
// en isolation de pannes (une config cassée ⇒ statut `error`, sans bloquer les
// autres). Exit non-zéro seulement si TOUS les tenants échouent (signal de panne
// systémique pour le badge Actions). Usage :
//   node --experimental-strip-types src/import-all.ts
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { decrypt } from "./creds.ts";
import { importPlayerSaves, syncPlayerNames } from "./import-lib.ts";

const fetchScript = new URL("../scripts/fetch-saves.py", import.meta.url).pathname;
const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;

/** Extrait la dernière ligne `DISCOVERED_REMOTE_DIR=<chemin>` d'un stdout. */
export function parseDiscoveredDir(stdout: string): string | null {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("DISCOVERED_REMOTE_DIR=")) {
      return line.slice("DISCOVERED_REMOTE_DIR=".length);
    }
  }
  return null;
}

/** 1 si ≥1 tenant et tous en échec (panne systémique), sinon 0. */
export function computeExitCode(results: Array<{ ok: boolean }>): number {
  return results.length > 0 && results.every((r) => !r.ok) ? 1 : 0;
}

type ConfigRow = {
  server_id: string;
  sftp_host: string;
  sftp_port: number;
  sftp_user: string;
  sftp_password_enc: string;
  remote_dir: string | null;
};

export async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  if (!process.env.SAVE_CREDS_KEY) throw new Error("SAVE_CREDS_KEY manquante");
  const sql = neon(process.env.DATABASE_URL);

  const configs = (await sql`
    select server_id, sftp_host, sftp_port, sftp_user, sftp_password_enc, remote_dir
    from server_import_configs where enabled = true`) as ConfigRow[];
  console.log(`${configs.length} tenant(s) activé(s)`);

  const results: Array<{ ok: boolean }> = [];
  for (const cfg of configs) {
    const dest = `/tmp/saves/${cfg.server_id}`;
    try {
      await sql`update server_import_configs
                set last_import_status = 'running', last_import_error = null
                where server_id = ${cfg.server_id}::uuid`;

      const password = decrypt(cfg.sftp_password_enc, cfg.server_id);
      rmSync(dest, { recursive: true, force: true });

      const stdout = execFileSync(venvPython, [fetchScript, dest], {
        env: {
          ...process.env,
          SFTP_HOST: `sftp://${cfg.sftp_host}:${cfg.sftp_port}`,
          SFTP_USER: cfg.sftp_user,
          SFTP_PASSWORD: password,
          SAVE_REMOTE_DIR: cfg.remote_dir ?? "",
        },
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      process.stdout.write(stdout);

      // Persister le dossier découvert quand il n'était pas encore renseigné.
      if (cfg.remote_dir === null) {
        const discovered = parseDiscoveredDir(stdout);
        if (discovered) {
          await sql`update server_import_configs set remote_dir = ${discovered}
                    where server_id = ${cfg.server_id}::uuid`;
        }
      }

      const importStats = await importPlayerSaves(sql, cfg.server_id, dest);
      const { players } = await syncPlayerNames(sql, cfg.server_id, dest);
      const stats = { ...importStats, players };

      await sql`update server_import_configs
                set last_import_status = 'ok', last_import_error = null,
                    last_import_at = now(), last_import_stats = ${JSON.stringify(stats)}::jsonb
                where server_id = ${cfg.server_id}::uuid`;
      console.log(`tenant ${cfg.server_id} : OK ${JSON.stringify(stats)}`);
      results.push({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`tenant ${cfg.server_id} : ÉCHEC ${message}`);
      await sql`update server_import_configs
                set last_import_status = 'error', last_import_error = ${message},
                    last_import_at = now()
                where server_id = ${cfg.server_id}::uuid`;
      results.push({ ok: false });
    } finally {
      // Level.sav converti ≈ 170 Mo — ne pas laisser traîner entre tenants.
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    }
  }

  process.exit(computeExitCode(results));
}

// Exécution directe uniquement : garde l'import du module sûr pour les tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
