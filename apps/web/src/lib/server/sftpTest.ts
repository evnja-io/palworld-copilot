// Test de connexion SFTP depuis une fonction Vercel (ssh2, TCP sortant — cf.
// spike phase 0). SSRF (rejet des plages privées, DNS-pin) : différé phase 4.
import { Client } from "ssh2";

const SAVEGAMES_ROOT = "Pal/Saved/SaveGames/0";
const CONNECT_TIMEOUT_MS = 10_000;
// Budget global couvrant handshake + sftp() + readdir() : readyTimeout ne
// borne que le handshake/auth SSH, pas les opérations SFTP qui suivent (un
// hôte qui répond à l'auth puis ne répond jamais au subsystem SFTP resterait
// bloqué jusqu'au max-duration de la fonction Vercel — 504 — sans ce budget).
const OP_TIMEOUT_MS = 15_000;

export class SftpTestError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "SftpTestError";
  }
}

export type SftpTestInput = {
  host: string;
  port: number;
  user: string;
  password: string;
  remoteDir: string | null;
};

export function parseSftpTestBody(body: unknown): SftpTestInput {
  const b = body as Record<string, unknown> | null;
  if (!b) throw new SftpTestError("invalid_body");
  const host = b.host;
  const port = b.port;
  const user = b.user;
  const password = b.password;
  const remoteDirRaw = b.remoteDir;
  if (
    typeof host !== "string" ||
    host.length === 0 ||
    typeof port !== "number" ||
    !Number.isInteger(port) ||
    typeof user !== "string" ||
    user.length === 0 ||
    typeof password !== "string" ||
    password.length === 0 ||
    (remoteDirRaw != null && typeof remoteDirRaw !== "string")
  ) {
    throw new SftpTestError("invalid_body");
  }
  const remoteDir = typeof remoteDirRaw === "string" && remoteDirRaw.length > 0 ? remoteDirRaw : null;
  return { host, port, user, password, remoteDir };
}

export function testSftpConnection(
  input: SftpTestInput,
): Promise<{ ok: true; remoteDir: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;
    const done = (r: { ok: true; remoteDir: string } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      conn.end();
      resolve(r);
    };
    const timer = setTimeout(() => done({ ok: false, error: "timeout" }), OP_TIMEOUT_MS);
    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) return done({ ok: false, error: err.message });
        if (input.remoteDir) {
          sftp.readdir(`${input.remoteDir}/Players`, (e) =>
            e ? done({ ok: false, error: e.message }) : done({ ok: true, remoteDir: input.remoteDir! }),
          );
          return;
        }
        sftp.readdir(SAVEGAMES_ROOT, (e, list) => {
          if (e) return done({ ok: false, error: e.message });
          const worlds = list.map((x) => x.filename).filter((n) => n !== "." && n !== "..");
          if (worlds.length !== 1) {
            return done({ ok: false, error: worlds.length === 0 ? "aucun monde trouvé" : "plusieurs mondes — préciser le dossier" });
          }
          done({ ok: true, remoteDir: `${SAVEGAMES_ROOT}/${worlds[0]}` });
        });
      });
    });
    conn.on("error", (err) => done({ ok: false, error: err.message }));
    conn.connect({
      host: input.host,
      port: input.port,
      username: input.user,
      password: input.password,
      readyTimeout: CONNECT_TIMEOUT_MS,
    });
  });
}
