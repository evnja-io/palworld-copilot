import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

export function getDb() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  return drizzle(neon(env.DATABASE_URL), { schema });
}

export * as tables from "./schema";
