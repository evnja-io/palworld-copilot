// Découpe T_WorldMap.png (8192²) en pyramide de tuiles webp 256 px (z0..z5)
// et l'uploade sur Vercel Blob sous un préfixe versionné. Idempotent : si le
// tileSetId (hash de la texture) est déjà en ligne, skip.
// Env : BLOB_READ_WRITE_TOKEN. Écrit game-data/maps.json.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { put, head } from "@vercel/blob";
import sharp from "sharp";
import { TEXTURE_ROOTS, findExports, writeGameData } from "./lib.js";

const SIZE = 8192;
const TILE = 256;
const MAX_ZOOM = 5; // z5 = 32×32 tuiles de 256 -> 8192 natif

if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN manquante");

const png = findExports(/T_WorldMap\.png$/, TEXTURE_ROOTS)[0];
if (!png) throw new Error("T_WorldMap.png introuvable dans les exports");
const tileSetId = createHash("sha256").update(readFileSync(png)).digest("hex").slice(0, 8);
console.log(`texture : ${png}\ntileSetId : ${tileSetId}`);

const outDir = new URL(`../out/tiles/${tileSetId}/`, import.meta.url).pathname;

// 1. Génération locale (skip si le probe distant existe déjà)
const probePath = `tiles/${tileSetId}/0/0/0.webp`;
const already = await head(probePath).catch(() => null);
if (already) {
  console.log("tuiles déjà en ligne — upload sauté");
} else {
  const base = sharp(png).ensureAlpha();
  const meta = await base.metadata();
  if (meta.width !== SIZE || meta.height !== SIZE) {
    throw new Error(`texture ${meta.width}x${meta.height} inattendue (attendu ${SIZE})`);
  }
  for (let z = 0; z <= MAX_ZOOM; z++) {
    const dim = TILE * 2 ** z;
    const level = await sharp(png).resize(dim, dim, { kernel: "lanczos3" }).toBuffer();
    const n = 2 ** z;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const dir = join(outDir, String(z), String(x));
        mkdirSync(dir, { recursive: true });
        await sharp(level)
          .extract({ left: x * TILE, top: y * TILE, width: TILE, height: TILE })
          .webp({ quality: 80 })
          .toFile(join(dir, `${y}.webp`));
      }
    }
    console.log(`  z${z} : ${n * n} tuiles`);
  }

  // 2. Upload (concurrence bornée)
  const files: Array<{ local: string; remote: string }> = [];
  for (const z of readdirSync(outDir)) {
    for (const x of readdirSync(join(outDir, z))) {
      for (const f of readdirSync(join(outDir, z, x))) {
        files.push({
          local: join(outDir, z, x, f),
          remote: `tiles/${tileSetId}/${z}/${x}/${f}`,
        });
      }
    }
  }
  let done = 0;
  const CONCURRENCY = 8;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(
      files.slice(i, i + CONCURRENCY).map(async (f) => {
        await put(f.remote, readFileSync(f.local), {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/webp",
          cacheControlMaxAge: 31536000,
        });
      }),
    );
    done = Math.min(i + CONCURRENCY, files.length);
    if (done % 256 < CONCURRENCY) console.log(`  upload ${done}/${files.length}`);
  }
  console.log(`upload terminé : ${files.length} tuiles`);
}

// 3. maps.json — l'URL de base publique du store
const probe = await head(probePath);
const baseUrl = probe.url.replace(`/${probePath}`, ""); // origine nue du store
writeGameData("maps.json", {
  tileSetId,
  tileBaseUrl: baseUrl,
  sizePx: SIZE,
  tileSize: TILE,
  maxZoom: MAX_ZOOM,
});
console.log("tiles OK");
