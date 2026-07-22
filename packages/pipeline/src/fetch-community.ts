// Télécharge (si absents) les datasets communautaires vers raw/community/.
// Sources et attributions : docs/decisions.md.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../raw/community/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const SOURCES: Record<string, string> = {
  // oMaN-Rod/palworld-save-pal — effigies (GUID -> coordonnées monde)
  "effigies.json":
    "https://raw.githubusercontent.com/oMaN-Rod/palworld-save-pal/main/data/json/effigies.json",
  // deafdudecomputers/PalworldSaveTools — points de voyage rapide (GUID, monde, noms)
  "fast_travel_points.json":
    "https://raw.githubusercontent.com/deafdudecomputers/PalworldSaveTools/main/resources/game_data/fast_travel_points.json",
};

for (const [name, url] of Object.entries(SOURCES)) {
  const dest = join(dir, name);
  if (existsSync(dest)) {
    console.log(`présent : ${name}`);
    continue;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
  const body = await res.text();
  JSON.parse(body); // validation
  writeFileSync(dest, body);
  console.log(`téléchargé : ${name}`);
}
