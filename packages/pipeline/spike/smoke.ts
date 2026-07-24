import { existsSync } from "node:fs";

const pakDir = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Palworld/Pal/Content/Paks";
if (!existsSync(pakDir)) {
  console.error(`ECHEC : dossier Paks introuvable : ${pakDir}`);
  process.exit(1);
}
console.log("SPIKE OK - workspace opérationnel, jeu localisé");
