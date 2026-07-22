import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";
import { TEXTURE_ROOTS, findExports, loadDataTableRows, pick, writeGameData } from "./lib.js";
import { ICONS_OUT } from "./paths.js";

const pngByName = new Map(
  findExports(/\.png$/, TEXTURE_ROOTS).map((f) => [basename(f, ".png").toLowerCase(), f]),
);
console.log(`  textures PNG trouvées : ${pngByName.size}`);

async function convert(kind: "pals" | "items", ns: string, tableHint: RegExp) {
  const rows = loadDataTableRows(tableHint);
  mkdirSync(join(ICONS_OUT, kind), { recursive: true });
  const present: Record<string, boolean> = {};
  let converted = 0;
  for (const [id, row] of Object.entries(rows)) {
    // Icon est un SoftObjectPath ; on résout par nom de texture, insensible à la casse.
    const raw = JSON.stringify(pick(row as any, "Icon", "IconTexture") ?? "");
    const m = raw.match(/T_[A-Za-z0-9_]+/);
    const png = m ? pngByName.get(m[0].toLowerCase()) : undefined;
    if (!png) continue;
    await sharp(png)
      .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82 })
      .toFile(join(ICONS_OUT, kind, `${id}.webp`));
    present[ns + id] = true;
    converted++;
  }
  console.log(`  icônes ${kind} : ${converted}/${Object.keys(rows).length}`);
  return present;
}

/** Icônes de constructions : pas de DataTable — on résout par nom de texture
 *  `T_icon_buildObject_<Nom>`. Clés/fichiers en minuscules car la casse du
 *  IconName des technos ne suit pas toujours celle de la texture.
 *  0 converti = toléré : le dossier BuildObject/PNG n'est peut-être pas encore
 *  exporté (runbook, section icônes). */
async function convertBuildObjects() {
  mkdirSync(join(ICONS_OUT, "build"), { recursive: true });
  const present: Record<string, boolean> = {};
  let converted = 0;
  for (const [name, png] of pngByName) {
    const m = name.match(/^t_icon_buildobject_(.+)$/);
    if (!m) continue;
    await sharp(png)
      .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82 })
      .toFile(join(ICONS_OUT, "build", `${m[1]}.webp`));
    present[`build:${m[1]}`] = true;
    converted++;
  }
  console.log(`  icônes build : ${converted}`);
  if (converted === 0) {
    console.warn(
      "  (aucune texture T_icon_buildObject_* — exporter Pal/Content/Pal/Texture/BuildObject/PNG depuis FModel)",
    );
  }
  return present;
}

const pals = await convert("pals", "pal:", /DT_PalCharacterIconDataTable(_Common)?\.json$/);
const items = await convert("items", "item:", /DT_ItemIconDataTable(_Common)?\.json$/);
const builds = await convertBuildObjects();
if (Object.keys(pals).length < 100 || Object.keys(items).length < 300) {
  throw new Error("Trop peu d'icônes converties — vérifier l'export des textures (runbook, section icônes)");
}
writeGameData("icons.json", { ...pals, ...items, ...builds });
console.log("icons OK");
