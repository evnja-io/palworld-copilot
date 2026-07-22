import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeGameData } from "./lib.js";
import { OUT_DIR } from "./paths.js";

const count = (p: string) => JSON.parse(readFileSync(join(OUT_DIR, p), "utf8")).length;
writeGameData("data-version.json", {
  extractedAt: new Date().toISOString().slice(0, 10),
  pipelineVersion: 1,
  counts: {
    pals: count("pals.json"),
    items: count("items.json"),
    recipes: count("recipes.json"),
    tech: count("tech.json"),
    buildings: count("buildings.json"),
  },
});
console.log("data-version OK");
