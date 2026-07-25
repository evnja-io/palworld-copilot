import { fileURLToPath } from "node:url";

export const RAW_DIR = process.env.RAW_DIR ?? "/mnt/c/PalExports/Exports";
export const OUT_DIR = fileURLToPath(new URL("../../game-data/", import.meta.url));
export const ICONS_OUT = fileURLToPath(new URL("../../../apps/web/static/icons/", import.meta.url));
export const SPAWNS_OUT = fileURLToPath(new URL("../../../apps/web/static/spawns/", import.meta.url));
