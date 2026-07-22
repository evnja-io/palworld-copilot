// Spike : constater le format exact de /v1/api/players (champs, format du GUID).
// Env attendues : PAL_API_URL (http://host:8212) + PAL_API_PASSWORD, ou repli
// SFTP_HOST + RCON_PASSWORD (port 8212 par défaut).
const url =
  process.env.PAL_API_URL ??
  (process.env.SFTP_HOST ? `http://${process.env.SFTP_HOST}:8212` : undefined);
const pass = process.env.PAL_API_PASSWORD ?? process.env.RCON_PASSWORD;
if (!url || !pass) throw new Error("PAL_API_URL/SFTP_HOST et PAL_API_PASSWORD/RCON_PASSWORD requis");

console.log(`GET ${url.replace(/\/\/.*@/, "//")}/v1/api/players`);
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15_000);
const res = await fetch(`${url}/v1/api/players`, {
  headers: { Authorization: `Basic ${Buffer.from(`admin:${pass}`).toString("base64")}` },
  signal: controller.signal,
}).finally(() => clearTimeout(timer));
if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);
const data = await res.json();
console.log(JSON.stringify(data, null, 1));
console.log("SPIKE OK");
