import icons from "@palworld-companion/game-data/icons.json";

// Valeur string = alias : le .webp porte un autre nom que la clé (variantes
// d'items partageant l'icône de leur IconName, casse divergente…).
const present = icons as Record<string, boolean | string>;

export function palIcon(id: string): string | undefined {
  return iconPath(`pal:${id}`);
}

export function itemIcon(id: string): string | undefined {
  return iconPath(`item:${id}`);
}

/** Renvois manuels IconName -> clé d'icône réelle : quirks des données du jeu
 *  (textures renommées, casse divergente, et la typo Pocketpair
 *  « T_icon_buildObject_efenseBulletLauncher_* » sans D). */
const TECH_ICON_ALIASES: Record<string, string> = {
  Wooden_foundation: "build:wood_foundation",
  WallTorch: "build:walltorch02",
  Lamp: "build:lampstand",
  CeilingLamp: "build:lamptop",
  LargeLamp: "build:lampstandlarge",
  LargeCeilingLamp: "build:lamptoplarge",
  Spa2: "build:spa_2",
  BlastFurnace2: "build:blastfurnace_2",
  ElectricHeater: "build:heaterelectric",
  ElectricCooler: "build:coolerelectric",
  DefenseBowGun: "build:efensebulletlauncher_bowgun",
  DefenseMissile: "build:efensebulletlauncher_missile",
  ShotGunBullet: "item:ShotgunBullet",
};

function iconPath(key: string): string | undefined {
  const v = present[key];
  if (!v) return undefined;
  const [ns, id] = key.split(":");
  return `/icons/${ns === "item" ? "items" : ns === "pal" ? "pals" : ns}/${typeof v === "string" ? v : id}.webp`;
}

/** Icône d'un nœud de techno : le jeu réutilise l'icône de l'item produit,
 *  sinon celle de la construction (namespace `build:`, clés en minuscules
 *  car la casse du IconName ne suit pas toujours celle de la texture). */
export function techIcon(iconName: string | undefined): string | undefined {
  if (!iconName) return undefined;
  const alias = TECH_ICON_ALIASES[iconName];
  if (alias) return iconPath(alias);
  return iconPath(`item:${iconName}`) ?? iconPath(`build:${iconName.toLowerCase()}`);
}
