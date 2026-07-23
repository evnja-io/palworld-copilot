# Multi-tenant Phase 3 — Ingestion self-service (SFTP chiffré) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque owner de configurer lui-même l'accès SFTP de son monde (credentials chiffrés au repos), et remplacer le pipeline mono-serveur par un worker qui va chercher les saves de tous les tenants `enabled` en isolation de pannes — spec : `docs/superpowers/specs/2026-07-22-multi-tenant-design.md`, phase 3.

**Architecture:** Une table dédiée `server_import_configs` (le ciphertext vit à l'écart des loads de page). Un module crypto AES-256-GCM en **deux fichiers miroirs** (`apps/web/src/lib/server/crypto.ts` côté saisie/test, `packages/pipeline/src/creds.ts` côté import) partageant le même format de fil. Le pipeline est refactoré : les corps de `import-save.ts`/`extract-players.ts` deviennent `importPlayerSaves()`/`syncPlayerNames()` dans `import-lib.ts` (refactor pur), un nouveau `import-all.ts` orchestre le fan-out par tenant, `fetch-saves.py` gagne l'auto-découverte du dossier de monde. Le workflow Actions ne porte plus que `DATABASE_URL` + `SAVE_CREDS_KEY`.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), Drizzle ORM + driver neon-http (pas de transactions ; le pipeline utilise le client `neon()` brut), drizzle-kit (driver `pg`, transactionnel), Neon Postgres, `node:crypto` (zéro dépendance), `ssh2` (unique dépendance nouvelle, côté apps/web, conditionnée au spike phase 0), pipeline Node `--experimental-strip-types` + venv Python palsav/palooz/paramiko, vitest.

**Découpage des plans :** ce plan couvre la phase 3 de la spec. Phases 0–2 supposées livrées : la phase 2 fournit l'ouverture des inscriptions, les invitations, la page owner `/s/[slug]/settings` (`+page.server.ts` + `+page.svelte`) et la garde `requireOwner()` dans `apps/web/src/lib/server/servers.ts`. Phase 4 (durcissement SSRF, kick/leave, rotation de clé) fait l'objet d'un plan séparé.

## Global Constraints

- Monorepo pnpm ; commandes web : `pnpm --filter web <script>` ; pipeline : `pnpm --filter @palworld-companion/pipeline <script>` (ou `cd packages/pipeline`).
- Driver runtime neon-http : **pas de transactions**. Le pipeline utilise le client `neon()` **brut** qui, lui, accepte les paramètres tableaux `${arr}::text[]` et `sql.transaction([...])` non-interactif — **préserver** ce comportement dans le refactor (l'existant en dépend).
- **Zéro dépendance npm nouvelle pour le crypto** : `node:crypto` uniquement. `ssh2` est la **seule** dépendance nouvelle autorisée (apps/web), et son intégration (Tâche 6) est **conditionnée au go/no-go du spike ssh2-sur-Vercel de la phase 0**.
- Les deux fichiers `crypto.ts` et `creds.ts` doivent rester **byte-compatibles sur le format de fil** : un ciphertext produit par l'un se déchiffre par l'autre. Ils lisent tous deux la clé via `process.env.SAVE_CREDS_KEY` (pas `$env/dynamic/private`), condition pour rester des miroirs identiques importables des deux côtés.
- Format de credential stocké : `"v1:" + base64(iv(12) ‖ ciphertext ‖ tag(16))`, **AAD = serverId** (un ciphertext ne peut pas être rejoué sur un autre tenant). Clé maîtresse `SAVE_CREDS_KEY` = 32 octets base64.
- Le mot de passe n'est **jamais** renvoyé au client (`passwordSet: boolean`). Champ vide à la sauvegarde = conserver l'existant. Aucun `select` de page ne doit lire `sftp_password_enc` (raison d'être de la table séparée).
- Repo public GPL : aucun secret, aucun identifiant de monde, aucune IP en dur dans le code. `SAVE_CREDS_KEY` et `DATABASE_URL` sont env Vercel + secrets GitHub uniquement.
- Saves Palworld v1.0+ `PlM`/Oodle : seul le venv `palsav`+`palooz` (`packages/pipeline/.venv`, cf. runbook) les convertit.
- Node `--experimental-strip-types` pour le TS du pipeline (pas de build).
- Migrations : `pnpm --filter web db:generate` (hors-ligne) puis `db:migrate` (driver pg). **Ne jamais appliquer sur la prod pendant ce plan** — application manuelle documentée (Tâche 9).
- Commentaires et messages de commit en **français**, style existant (`feat(web): …`, `feat(pipeline): …`).
- Fichiers `.svelte`/`.svelte.ts` : utiliser le skill `svelte:svelte-code-writer` / l'agent `svelte-file-editor` pour les éditions.
- Après chaque tâche : `pnpm --filter web test` et `pnpm --filter web check` doivent passer (sauf report explicite) ; les tâches pipeline lancent `pnpm --filter @palworld-companion/pipeline test`.
- Durcissement SSRF (rejet des plages IP privées, DNS-pin) : **différé en phase 4** — le référencer, ne pas le construire ici.

---

### Task 1: Table `server_import_configs` + migration

**Files:**
- Modify: `apps/web/src/lib/server/db/schema.ts`
- Create: `apps/web/drizzle/00NN_*.sql` (généré — le numéro est **le prochain libre** au moment de l'exécution : `0005` après la seule phase 1, mais `0007` si la phase 2 a déjà été appliquée, `db:generate` numérote seul d'après le journal ; ne pas coder le numéro en dur)

**Interfaces:**
- Produces: table Drizzle `tables.serverImportConfigs` avec `serverId` (uuid, **PK**, FK → `servers` cascade), `sftpHost` (text notNull), `sftpPort` (integer notNull default 22), `sftpUser` (text notNull), `sftpPasswordEnc` (text notNull, ciphertext), `remoteDir` (text nullable ⇒ auto-découverte), `enabled` (bool notNull default false), `lastImportAt` (timestamptz nullable), `lastImportStatus` (text nullable, enum `'running'|'ok'|'error'`), `lastImportError` (text nullable), `lastImportStats` (jsonb nullable).

- [ ] **Step 1: Étendre la ligne d'imports du schéma**

Dans `apps/web/src/lib/server/db/schema.ts`, remplacer la première ligne d'import par (ajout de `boolean`, `integer`, `jsonb`) :

```ts
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Ajouter la table**

À la fin de `apps/web/src/lib/server/db/schema.ts`, ajouter :

```ts
// Credentials SFTP par serveur : table séparée pour qu'AUCUN load de page ne
// sélectionne sftp_password_enc par accident (cf. getImportConfig, Tâche 7).
export const serverImportConfigs = pgTable("server_import_configs", {
  serverId: uuid("server_id")
    .primaryKey()
    .references(() => servers.id, { onDelete: "cascade" }),
  sftpHost: text("sftp_host").notNull(),
  sftpPort: integer("sftp_port").notNull().default(22),
  sftpUser: text("sftp_user").notNull(),
  // Ciphertext "v1:" + base64(iv ‖ ct ‖ tag), AAD = serverId (crypto.ts / creds.ts).
  sftpPasswordEnc: text("sftp_password_enc").notNull(),
  // NULL ⇒ auto-découverte du monde (Pal/Saved/SaveGames/0/<world>) au 1er import.
  remoteDir: text("remote_dir"),
  enabled: boolean("enabled").notNull().default(false),
  lastImportAt: timestamp("last_import_at", { withTimezone: true }),
  lastImportStatus: text("last_import_status", { enum: ["running", "ok", "error"] }),
  lastImportError: text("last_import_error"),
  lastImportStats: jsonb("last_import_stats"),
});
```

- [ ] **Step 3: Générer la migration**

Run: `pnpm --filter web db:generate`
Expected: un fichier `apps/web/drizzle/0005_*.sql` contenant uniquement `CREATE TABLE "server_import_configs"` (avec la FK vers `servers` et le default `22`/`false`). **Aucun** `DROP` ni altération d'autre table — sinon corriger le schéma avant de continuer.

- [ ] **Step 4: Vérifier types et tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS (table nouvelle, indépendante — aucun code existant impacté).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/db/schema.ts apps/web/drizzle
git commit -m "feat(web): table server_import_configs (credentials SFTP chiffrés, table séparée)"
```

---

### Task 2: Module crypto AES-256-GCM (miroirs `crypto.ts` / `creds.ts`) + tests

**Files:**
- Create: `apps/web/src/lib/server/crypto.ts`
- Create: `packages/pipeline/src/creds.ts`
- Test: `apps/web/src/lib/server/crypto.test.ts`
- Test: `packages/pipeline/src/creds.test.ts`
- Test: `packages/pipeline/src/creds-mirror.test.ts`
- Modify: `packages/pipeline/package.json` (script `test`)

**Interfaces:**
- Produces (identiques dans les deux fichiers) :
  - `encrypt(plaintext: string, serverId: string): string` → `"v1:" + base64(iv(12) ‖ ciphertext ‖ tag(16))`, AAD = `serverId`.
  - `decrypt(stored: string, serverId: string): string` → plaintext ; **throw** si préfixe de version ≠ `v1`, si le tag ne valide pas, ou si l'AAD (serverId) diffère.
- Consumes: env `SAVE_CREDS_KEY` (32 octets base64) via `process.env`.

- [ ] **Step 1: Écrire les tests côté web (rouge)**

`apps/web/src/lib/server/crypto.test.ts` :

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

// Clé de test déterministe : 32 octets nuls, base64.
const TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const SRV_A = "11111111-1111-1111-1111-111111111111";
const SRV_B = "22222222-2222-2222-2222-222222222222";

beforeAll(() => {
  process.env.SAVE_CREDS_KEY = TEST_KEY;
});

describe("crypto AES-256-GCM", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(decrypt(enc, SRV_A)).toBe("hunter2");
  });

  it("préfixe de version v1", () => {
    expect(encrypt("x", SRV_A).startsWith("v1:")).toBe(true);
  });

  it("un mauvais serverId (AAD) fait échouer le déchiffrement", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(() => decrypt(enc, SRV_B)).toThrow();
  });

  it("une altération du ciphertext fait échouer le tag", () => {
    const enc = encrypt("hunter2", SRV_A);
    const raw = Buffer.from(enc.slice(3), "base64");
    raw[raw.length - 1] ^= 0xff; // corrompt le dernier octet du tag
    const tampered = "v1:" + raw.toString("base64");
    expect(() => decrypt(tampered, SRV_A)).toThrow();
  });

  it("un préfixe de version inconnu est rejeté", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(() => decrypt("v2:" + enc.slice(3), SRV_A)).toThrow();
  });
});
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `pnpm --filter web test crypto`
Expected: FAIL — `Cannot find module './crypto'`.

- [ ] **Step 3: Écrire `apps/web/src/lib/server/crypto.ts`**

```ts
// Chiffrement des credentials SFTP au repos — AES-256-GCM, node:crypto, zéro dép.
// MIROIR STRICT de packages/pipeline/src/creds.ts : les deux fichiers doivent
// rester byte-identiques (test creds-mirror.test.ts). Format de fil :
//   "v1:" + base64(iv(12) ‖ ciphertext ‖ tag(16)), AAD = serverId.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const b64 = process.env.SAVE_CREDS_KEY;
  if (!b64) throw new Error("SAVE_CREDS_KEY manquante");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("SAVE_CREDS_KEY doit faire 32 octets (base64)");
  return key;
}

export function encrypt(plaintext: string, serverId: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(serverId, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, ct, tag]).toString("base64")}`;
}

export function decrypt(stored: string, serverId: string): string {
  const idx = stored.indexOf(":");
  const version = idx === -1 ? "" : stored.slice(0, idx);
  const payload = idx === -1 ? "" : stored.slice(idx + 1);
  if (version !== VERSION || payload.length === 0) {
    throw new Error("format de credential inconnu");
  }
  const raw = Buffer.from(payload, "base64");
  if (raw.length < IV_LEN + TAG_LEN) throw new Error("credential tronqué");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const ct = raw.subarray(IV_LEN, raw.length - TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAAD(Buffer.from(serverId, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 4: Lancer le test — succès attendu**

Run: `pnpm --filter web test crypto`
Expected: PASS (5 tests).

Run: `pnpm --filter web check`
Expected: PASS.

- [ ] **Step 5: Miroir pipeline — copier le fichier à l'identique**

Run: `cp apps/web/src/lib/server/crypto.ts packages/pipeline/src/creds.ts`

Le fichier est intentionnellement byte-identique (aucun import spécifique à SvelteKit — node:crypto + process.env uniquement). Le commentaire d'en-tête vaut dans les deux sens.

- [ ] **Step 6: Ajouter le script `test` au pipeline**

Dans `packages/pipeline/package.json`, ajouter sous `"fetch-community"` :

```json
    "test": "vitest run"
```

- [ ] **Step 7: Écrire les tests côté pipeline (identiques + miroir)**

`packages/pipeline/src/creds.test.ts` : copie de `crypto.test.ts` avec l'import ajusté :

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./creds";

const TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const SRV_A = "11111111-1111-1111-1111-111111111111";
const SRV_B = "22222222-2222-2222-2222-222222222222";

beforeAll(() => {
  process.env.SAVE_CREDS_KEY = TEST_KEY;
});

describe("creds AES-256-GCM", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(decrypt(enc, SRV_A)).toBe("hunter2");
  });

  it("préfixe de version v1", () => {
    expect(encrypt("x", SRV_A).startsWith("v1:")).toBe(true);
  });

  it("un mauvais serverId (AAD) fait échouer le déchiffrement", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(() => decrypt(enc, SRV_B)).toThrow();
  });

  it("une altération du ciphertext fait échouer le tag", () => {
    const enc = encrypt("hunter2", SRV_A);
    const raw = Buffer.from(enc.slice(3), "base64");
    raw[raw.length - 1] ^= 0xff;
    const tampered = "v1:" + raw.toString("base64");
    expect(() => decrypt(tampered, SRV_A)).toThrow();
  });

  it("un préfixe de version inconnu est rejeté", () => {
    const enc = encrypt("hunter2", SRV_A);
    expect(() => decrypt("v2:" + enc.slice(3), SRV_A)).toThrow();
  });
});
```

`packages/pipeline/src/creds-mirror.test.ts` — garantit que les deux miroirs restent synchrones ET interopérables sur le fil :

```ts
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as creds from "./creds";
import * as webCrypto from "../../../apps/web/src/lib/server/crypto";

const TEST_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const SRV = "11111111-1111-1111-1111-111111111111";

beforeAll(() => {
  process.env.SAVE_CREDS_KEY = TEST_KEY;
});

describe("miroir crypto.ts ↔ creds.ts", () => {
  it("les deux fichiers sources sont byte-identiques", () => {
    const a = readFileSync(new URL("./creds.ts", import.meta.url).pathname, "utf8");
    const b = readFileSync(
      new URL("../../../apps/web/src/lib/server/crypto.ts", import.meta.url).pathname,
      "utf8",
    );
    expect(a).toBe(b);
  });

  it("un ciphertext du web se déchiffre côté pipeline", () => {
    const enc = webCrypto.encrypt("s3cr3t", SRV);
    expect(creds.decrypt(enc, SRV)).toBe("s3cr3t");
  });

  it("un ciphertext du pipeline se déchiffre côté web", () => {
    const enc = creds.encrypt("s3cr3t", SRV);
    expect(webCrypto.decrypt(enc, SRV)).toBe("s3cr3t");
  });
});
```

- [ ] **Step 8: Lancer les tests pipeline**

Run: `pnpm --filter @palworld-companion/pipeline test`
Expected: PASS (5 tests `creds` + 3 tests miroir).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/server/crypto.ts apps/web/src/lib/server/crypto.test.ts packages/pipeline/src/creds.ts packages/pipeline/src/creds.test.ts packages/pipeline/src/creds-mirror.test.ts packages/pipeline/package.json
git commit -m "feat(crypto): chiffrement AES-256-GCM des credentials (miroirs crypto.ts/creds.ts)"
```

---

### Task 3: Refactor `import-lib.ts` (extraction des corps) + coques CLI

**Files:**
- Create: `packages/pipeline/src/import-lib.ts`
- Modify: `packages/pipeline/src/import-save.ts` (devient une coque)
- Modify: `packages/pipeline/src/extract-players.ts` (devient une coque)
- Test: `packages/pipeline/src/import-lib.test.ts`

**Interfaces:**
- Consumes: client `neon()` brut (type `import("@neondatabase/serverless").NeonQueryFunction<false, false>`).
- Produces:
  - `normalizeGuid(uuid: string): string` — `"00afd495-0000-…"` → `"00AFD495000000000000000000000000"`.
  - `computeSnapshotRows(save: unknown, palIdsLower: Map<string,string>, techIdsLower: Map<string,string>): Array<{ kind: string; id: string }>` — extraction pure (pals/techs/relics) d'une save JSON déjà convertie.
  - `importPlayerSaves(sql, serverId: string, dir: string): Promise<ImportStats>` avec `ImportStats = { files: number; pals: number; techs: number; relics: number; merged: number; unclaimed: number; failures: number }`.
  - `syncPlayerNames(sql, serverId: string, dir: string): Promise<{ players: number }>`.

**Note :** refactor **pur** — le SQL (remplacement idempotent via `sql.transaction([...])`, fusion additive par UNION avec casts `::text[]`, filtre markers.json des reliques) est déplacé **inchangé**. Les coques CLI conservent le comportement (lecture de `SERVER_ID`/argv, `process.exit`).

- [ ] **Step 1: Écrire le test pur d'extraction (rouge)**

`packages/pipeline/src/import-lib.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { computeSnapshotRows, normalizeGuid } from "./import-lib";

const palIds = new Map<string, string>([["anubis", "Anubis"], ["sheepball", "Sheepball"]]);
const techIds = new Map<string, string>([["workbench", "Workbench"]]);

describe("normalizeGuid", () => {
  it("retire les tirets et met en majuscules", () => {
    expect(normalizeGuid("00afd495-0000-0000-0000-000000000000")).toBe(
      "00AFD495000000000000000000000000",
    );
  });
});

describe("computeSnapshotRows", () => {
  it("résout la casse vers l'ID canonique et ne garde que value===true", () => {
    const save = {
      properties: {
        SaveData: {
          value: {
            UnlockedRecipeTechnologyNames: { value: { values: ["WORKBENCH"] } },
            RecordData: {
              value: {
                PaldeckUnlockFlag: {
                  value: [
                    { key: "ANUBIS", value: true },
                    { key: "sheepball", value: false },
                  ],
                },
                RelicObtainForInstanceFlag: {
                  value: [{ key: "01-3F-F2", value: true }],
                },
              },
            },
          },
        },
      },
    };
    const rows = computeSnapshotRows(save, palIds, techIds);
    expect(rows).toContainEqual({ kind: "pal_caught", id: "Anubis" });
    expect(rows).toContainEqual({ kind: "tech_unlocked", id: "Workbench" });
    expect(rows).toContainEqual({ kind: "raw:relic", id: "013ff2" });
    expect(rows).not.toContainEqual({ kind: "pal_caught", id: "Sheepball" });
  });

  it("tolère une save fraîche sans les flags (défensif)", () => {
    const save = { properties: { SaveData: { value: { RecordData: { value: {} } } } } };
    expect(computeSnapshotRows(save, palIds, techIds)).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `pnpm --filter @palworld-companion/pipeline test import-lib`
Expected: FAIL — `Cannot find module './import-lib'`.

- [ ] **Step 3: Écrire `packages/pipeline/src/import-lib.ts`**

```ts
// Corps réutilisables de l'import (appelés par les coques CLI import-save.ts /
// extract-players.ts et par le worker fan-out import-all.ts). Refactor pur :
// le SQL est repris tel quel de l'existant (client neon() brut, sans transactions
// interactives ; tableaux ${arr}::text[] acceptés par ce client).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
export type ImportStats = {
  files: number;
  pals: number;
  techs: number;
  relics: number;
  merged: number;
  unclaimed: number;
  failures: number;
};

const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;

function requireVenv(): void {
  if (!existsSync(venvPython)) throw new Error("venv palsav absent — cf. runbook, section saves");
}

/** UUID "00afd495-0000-…" -> "00AFD495000000000000000000000000". */
export function normalizeGuid(uuid: string): string {
  return uuid.replaceAll("-", "").toUpperCase();
}

/** Extraction pure d'une save JSON convertie -> lignes de snapshot. */
export function computeSnapshotRows(
  save: any,
  palIdsLower: Map<string, string>,
  techIdsLower: Map<string, string>,
): Array<{ kind: string; id: string }> {
  const sd = save?.properties?.SaveData?.value ?? {};
  const rd = sd?.RecordData?.value ?? {};

  const paldeckEntries = ((rd.PaldeckUnlockFlag?.value ?? []) as Array<{ key: string; value: boolean }>)
    .filter((entry) => entry.value === true)
    .map((entry) => entry.key);
  const pals = [
    ...new Set(
      paldeckEntries
        .map((id) => palIdsLower.get(id.toLowerCase()))
        .filter((id): id is string => id !== undefined),
    ),
  ];

  const techEntries = (sd.UnlockedRecipeTechnologyNames?.value?.values ?? []) as string[];
  const techs = [
    ...new Set(
      techEntries
        .map((id) => techIdsLower.get(id.toLowerCase()))
        .filter((id): id is string => id !== undefined),
    ),
  ];

  const relicEntries = (
    (rd.RelicObtainForInstanceFlag?.value ?? []) as Array<{ key: string; value: boolean }>
  )
    .filter((entry) => entry.value === true)
    .map((entry) => entry.key.replaceAll("-", "").toLowerCase());
  const relics = [...new Set(relicEntries)];

  return [
    ...pals.map((id) => ({ kind: "pal_caught", id })),
    ...techs.map((id) => ({ kind: "tech_unlocked", id })),
    ...relics.map((id) => ({ kind: "raw:relic", id })),
  ];
}

/** Importe les Players/*.sav d'un dossier vers save_snapshots + fusion progress. */
export async function importPlayerSaves(sql: Sql, serverId: string, dir: string): Promise<ImportStats> {
  requireVenv();

  const palIdsLower = new Map<string, string>(
    (JSON.parse(
      readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>).map((p) => [p.id.toLowerCase(), p.id]),
  );
  const techIdsLower = new Map<string, string>(
    (JSON.parse(
      readFileSync(new URL("../../game-data/tech.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>).map((t) => [t.id.toLowerCase(), t.id]),
  );

  const allSavs = readdirSync(dir).filter((f) => f.endsWith(".sav"));
  if (allSavs.length === 0) throw new Error(`Aucun .sav dans ${dir}`);
  const guidFilePattern = /^[0-9A-Fa-f]{32}\.sav$/;
  const savs = allSavs.filter((f) => {
    if (guidFilePattern.test(f)) return true;
    console.log(`ignoré : ${f}`);
    return false;
  });

  const failures: Array<{ file: string; message: string }> = [];
  let palCount = 0;
  let techCount = 0;
  let relicCount = 0;

  for (const sav of savs) {
    try {
      const guid = basename(sav, ".sav");
      const jsonPath = join(dir, `${guid}.sav.json`);
      execFileSync(venvPython, [
        "-m",
        "palsav.commands.convert",
        join(dir, sav),
        "--to-json",
        "-o",
        jsonPath,
        "--force",
      ]);
      const save = JSON.parse(readFileSync(jsonPath, "utf8"));
      const rows = computeSnapshotRows(save, palIdsLower, techIdsLower);
      const pals = rows.filter((r) => r.kind === "pal_caught").length;
      const techs = rows.filter((r) => r.kind === "tech_unlocked").length;
      const relics = rows.filter((r) => r.kind === "raw:relic").length;
      palCount += pals;
      techCount += techs;
      relicCount += relics;

      const kinds = rows.map((r) => r.kind);
      const ids = rows.map((r) => r.id);
      await sql.transaction([
        sql.query("delete from save_snapshots where server_id = $2::uuid and player_guid = $1", [
          guid,
          serverId,
        ]),
        sql.query(
          `insert into save_snapshots (server_id, player_guid, kind, entity_id)
           select $4::uuid, $1, k, e from unnest($2::text[], $3::text[]) as t(k, e)
           on conflict do nothing`,
          [guid, kinds, ids, serverId],
        ),
      ]);
      console.log(`${guid} : ${pals} pals, ${techs} techs, ${relics} effigies (snapshot)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ÉCHEC ${sav} : ${message}`);
      failures.push({ file: sav, message });
    }
  }

  // Fusion additive vers progress (kinds directs + reliques présentes dans markers.json).
  const markersJson = JSON.parse(
    readFileSync(new URL("../../game-data/markers.json", import.meta.url).pathname, "utf8"),
  ) as Array<{ id: string; type: string }>;
  const relicIds = markersJson.filter((mk) => mk.type === "relic").map((mk) => mk.id);
  const merged = await sql`
    insert into progress (server_id, user_id, kind, entity_id)
    select s.server_id, m.user_id, s.kind, s.entity_id
    from save_snapshots s
    join server_members m on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
    where s.server_id = ${serverId}::uuid and s.kind in ('pal_caught', 'tech_unlocked')
    union
    select s.server_id, m.user_id, 'marker', 'relic_' || s.entity_id
    from save_snapshots s
    join server_members m on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
    where s.server_id = ${serverId}::uuid and s.kind = 'raw:relic'
      and ('relic_' || s.entity_id) = any(${relicIds}::text[])
    on conflict do nothing
    returning user_id`;
  console.log(`fusion : ${merged.length} nouvelles coches appliquées`);

  const unclaimed = await sql`
    select s.player_guid, count(*) as n from save_snapshots s
    left join server_members m
      on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
    where s.server_id = ${serverId}::uuid and m.user_id is null
    group by s.player_guid`;
  for (const r of unclaimed) {
    console.log(`non revendiqué : ${r.player_guid} (${r.n} entrées) — page /import`);
  }

  return {
    files: savs.length,
    pals: palCount,
    techs: techCount,
    relics: relicCount,
    merged: merged.length,
    unclaimed: unclaimed.length,
    failures: failures.length,
  };
}

/** Extrait les pseudos in-game de Level.sav et les upsert dans save_players. */
export async function syncPlayerNames(sql: Sql, serverId: string, dir: string): Promise<{ players: number }> {
  requireVenv();
  if (!existsSync(join(dir, "Level.sav"))) throw new Error(`Level.sav absent de ${dir}`);

  const jsonPath = join(dir, "level.sav.json");
  execFileSync(venvPython, [
    "-m",
    "palsav.commands.convert",
    join(dir, "Level.sav"),
    "--to-json",
    "-o",
    jsonPath,
    "--force",
  ]);
  const level = JSON.parse(readFileSync(jsonPath, "utf8"));
  rmSync(jsonPath); // 170 Mo — ne pas laisser traîner
  const cmap: any[] = level?.properties?.worldSaveData?.value?.CharacterSaveParameterMap?.value ?? [];

  const players: Array<{ guid: string; nickname: string }> = [];
  for (const entry of cmap) {
    const sp = entry?.value?.RawData?.value?.object?.SaveParameter?.value;
    if (!sp?.IsPlayer?.value) continue;
    const uid = entry?.key?.PlayerUId?.value;
    const nickname = sp?.NickName?.value;
    if (typeof uid === "string" && typeof nickname === "string" && nickname.length > 0) {
      players.push({ guid: normalizeGuid(uid), nickname });
    }
  }
  if (players.length === 0) throw new Error("Aucun joueur trouvé dans Level.sav — structure inattendue ?");

  await sql`
    insert into save_players (server_id, player_guid, nickname, updated_at)
    select ${serverId}::uuid,
           unnest(${players.map((p) => p.guid)}::text[]),
           unnest(${players.map((p) => p.nickname)}::text[]),
           now()
    on conflict (server_id, player_guid)
    do update set nickname = excluded.nickname, updated_at = now()`;
  for (const p of players) console.log(`${p.nickname} (${p.guid.slice(0, 8)}…)`);
  console.log(`${players.length} joueurs synchronisés dans save_players`);
  return { players: players.length };
}
```

- [ ] **Step 4: Lancer le test pur — succès attendu**

Run: `pnpm --filter @palworld-companion/pipeline test import-lib`
Expected: PASS (3 tests). (Les tests n'exécutent que les fonctions pures — pas de DB ni de venv.)

- [ ] **Step 5: Réduire `import-save.ts` à une coque**

Remplacer **tout** le contenu de `packages/pipeline/src/import-save.ts` par :

```ts
// Coque CLI : lit le dossier (argv) et le serveur cible (SERVER_ID), délègue à
// import-lib. Usage : node --experimental-strip-types src/import-save.ts <dossier>
import { existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { importPlayerSaves } from "./import-lib.ts";

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error("Usage: import-save <dossier contenant des Players/*.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante (utiliser --env-file)");
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");

const sql = neon(process.env.DATABASE_URL);
const stats = await importPlayerSaves(sql, serverId, dir);
if (stats.failures > 0) {
  console.error(`\n${stats.failures} fichier(s) en échec`);
  process.exit(1);
}
```

- [ ] **Step 6: Réduire `extract-players.ts` à une coque**

Remplacer **tout** le contenu de `packages/pipeline/src/extract-players.ts` par :

```ts
// Coque CLI : extrait les pseudos in-game de Level.sav vers save_players.
// Usage : node --experimental-strip-types src/extract-players.ts <dossier>
import { existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { syncPlayerNames } from "./import-lib.ts";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "Level.sav"))) {
  console.error("Usage: extract-players.ts <dossier contenant Level.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");

const sql = neon(process.env.DATABASE_URL);
await syncPlayerNames(sql, serverId, dir);
```

- [ ] **Step 7: Vérifier la syntaxe des coques + suite pipeline**

Run: `cd packages/pipeline && node --experimental-strip-types --check src/import-save.ts && node --experimental-strip-types --check src/extract-players.ts && node --experimental-strip-types --check src/import-lib.ts`
Expected: aucune erreur de syntaxe.

Run: `pnpm --filter @palworld-companion/pipeline test`
Expected: PASS (creds + miroir + import-lib).

- [ ] **Step 8: Commit**

```bash
git add packages/pipeline/src/import-lib.ts packages/pipeline/src/import-lib.test.ts packages/pipeline/src/import-save.ts packages/pipeline/src/extract-players.ts
git commit -m "refactor(pipeline): extraire importPlayerSaves/syncPlayerNames dans import-lib (coques CLI)"
```

---

### Task 4: Auto-découverte du monde dans `fetch-saves.py`

**Files:**
- Modify: `packages/pipeline/scripts/fetch-saves.py`
- Test: `packages/pipeline/scripts/test_fetch_saves.py`

**Interfaces:**
- Produces:
  - `pick_world_dir(names: list[str]) -> str` — retourne l'unique dossier de monde ; **raise** `ValueError` si 0 ou >1 candidat.
  - Contrat stdout : quand `SAVE_REMOTE_DIR` est vide, `fetch-saves.py` liste `Pal/Saved/SaveGames/0/`, choisit le monde, et imprime sur la **dernière ligne** `DISCOVERED_REMOTE_DIR=<chemin>` (parsable par `import-all.ts`).

- [ ] **Step 1: Écrire le test Python (rouge)**

`packages/pipeline/scripts/test_fetch_saves.py` :

```python
# Test pur de l'auto-découverte (aucune dépendance : paramiko est importé
# paresseusement dans fetch-saves.py). Lancé avec python3 système.
import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "fetch_saves", os.path.join(os.path.dirname(__file__), "fetch-saves.py")
)
fetch_saves = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fetch_saves)


def test_pick_single_world():
    assert fetch_saves.pick_world_dir(["A5F3C0000000000000000000000000000"]) == "A5F3C0000000000000000000000000000"


def test_pick_zero_raises():
    try:
        fetch_saves.pick_world_dir([])
        raise AssertionError("aurait dû lever")
    except ValueError:
        pass


def test_pick_many_raises():
    try:
        fetch_saves.pick_world_dir(["W1", "W2"])
        raise AssertionError("aurait dû lever")
    except ValueError:
        pass


if __name__ == "__main__":
    test_pick_single_world()
    test_pick_zero_raises()
    test_pick_many_raises()
    print("OK")
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `python3 packages/pipeline/scripts/test_fetch_saves.py`
Expected: FAIL — `AttributeError: module 'fetch_saves' has no attribute 'pick_world_dir'` (ou `SystemExit` si le module garde ses effets de bord au niveau module).

- [ ] **Step 3: Réécrire `fetch-saves.py` avec garde `__main__` + auto-découverte**

Remplacer **tout** le contenu de `packages/pipeline/scripts/fetch-saves.py` par :

```python
"""Télécharge les saves du serveur hébergé via SFTP.

Env requises : SFTP_HOST (URL sftp://hote:port), SFTP_USER, SFTP_PASSWORD.
SAVE_REMOTE_DIR : dossier du monde (ex. Pal/Saved/SaveGames/0/<WorldID>) ; si
vide, auto-découverte de l'unique dossier sous Pal/Saved/SaveGames/0/.
Usage : python fetch-saves.py <dossier_local>
Télécharge Players/*.sav (noms 32 hex uniquement) + Level.sav.
Quand le monde est auto-découvert, imprime en dernière ligne :
    DISCOVERED_REMOTE_DIR=<chemin>
"""

import os
import re
import sys
from urllib.parse import urlparse

SAVEGAMES_ROOT = "Pal/Saved/SaveGames/0"


def pick_world_dir(names):
    """Choisit l'unique dossier de monde parmi les entrées listées."""
    worlds = [n for n in names if n not in (".", "..")]
    if len(worlds) == 0:
        raise ValueError("aucun dossier de monde sous " + SAVEGAMES_ROOT)
    if len(worlds) > 1:
        raise ValueError(
            "plusieurs mondes sous %s (%s) — préciser SAVE_REMOTE_DIR"
            % (SAVEGAMES_ROOT, ", ".join(worlds))
        )
    return worlds[0]


def download(dest):
    import paramiko

    for var in ("SFTP_HOST", "SFTP_USER", "SFTP_PASSWORD"):
        if not os.environ.get(var):
            print(f"Variable {var} manquante", file=sys.stderr)
            sys.exit(1)

    u = urlparse(os.environ["SFTP_HOST"])
    t = paramiko.Transport((u.hostname, u.port or 22))
    t.connect(username=os.environ["SFTP_USER"], password=os.environ["SFTP_PASSWORD"])
    sftp = paramiko.SFTPClient.from_transport(t)

    discovered = None
    remote = (os.environ.get("SAVE_REMOTE_DIR") or "").rstrip("/")
    if not remote:
        world = pick_world_dir(sftp.listdir(SAVEGAMES_ROOT))
        remote = f"{SAVEGAMES_ROOT}/{world}"
        discovered = remote
        print(f"auto-découverte : {remote}")

    count = 0
    for entry in sftp.listdir_attr(f"{remote}/Players"):
        if re.fullmatch(r"[0-9A-Fa-f]{32}\.sav", entry.filename):
            sftp.get(f"{remote}/Players/{entry.filename}", os.path.join(dest, entry.filename))
            count += 1
        else:
            print(f"ignoré : {entry.filename}")
    sftp.get(f"{remote}/Level.sav", os.path.join(dest, "Level.sav"))
    print(f"téléchargé : {count} saves joueur + Level.sav -> {dest}")
    t.close()

    # Dernière ligne, machine-parsable, uniquement si le monde a été découvert.
    if discovered is not None:
        print(f"DISCOVERED_REMOTE_DIR={discovered}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: fetch-saves.py <dossier_local>", file=sys.stderr)
        sys.exit(1)
    _dest = sys.argv[1]
    os.makedirs(_dest, exist_ok=True)
    download(_dest)
```

- [ ] **Step 4: Lancer le test — succès attendu**

Run: `python3 packages/pipeline/scripts/test_fetch_saves.py`
Expected: `OK` (import du module sans effet de bord grâce à la garde `__main__` et à l'import paresseux de paramiko).

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/scripts/fetch-saves.py packages/pipeline/scripts/test_fetch_saves.py
git commit -m "feat(pipeline): auto-découverte du monde dans fetch-saves.py (SAVE_REMOTE_DIR optionnel)"
```

---

### Task 5: Worker fan-out `import-all.ts` (isolation des pannes)

**Files:**
- Create: `packages/pipeline/src/import-all.ts`
- Test: `packages/pipeline/src/import-all.test.ts`

**Interfaces:**
- Consumes: `importPlayerSaves`, `syncPlayerNames` (Tâche 3), `decrypt` de `./creds` (Tâche 2), `fetch-saves.py` (Tâche 4), env `DATABASE_URL` + `SAVE_CREDS_KEY`.
- Produces (helpers purs testables) :
  - `parseDiscoveredDir(stdout: string): string | null` — extrait la valeur de la dernière ligne `DISCOVERED_REMOTE_DIR=<chemin>`, sinon `null`.
  - `computeExitCode(results: Array<{ ok: boolean }>): number` — `1` si ≥1 tenant et **tous** en échec, sinon `0`.
  - `main(): Promise<void>` (exécutée uniquement en direct) : par tenant `enabled`, statut `running` → déchiffre → `fetch-saves.py` → import scopé → `ok` + stats jsonb, ou `error` + message ; nettoie `/tmp/saves/<serverId>` ; `process.exit(computeExitCode(...))`.

- [ ] **Step 1: Écrire les tests des helpers purs (rouge)**

`packages/pipeline/src/import-all.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { computeExitCode, parseDiscoveredDir } from "./import-all";

describe("parseDiscoveredDir", () => {
  it("extrait le chemin de la dernière ligne marquée", () => {
    const out = "auto-découverte : Pal/Saved/SaveGames/0/W1\ntéléchargé : 3 saves\nDISCOVERED_REMOTE_DIR=Pal/Saved/SaveGames/0/W1\n";
    expect(parseDiscoveredDir(out)).toBe("Pal/Saved/SaveGames/0/W1");
  });
  it("retourne null en l'absence de marqueur", () => {
    expect(parseDiscoveredDir("téléchargé : 3 saves\n")).toBeNull();
  });
});

describe("computeExitCode", () => {
  it("0 quand aucun tenant", () => {
    expect(computeExitCode([])).toBe(0);
  });
  it("0 quand au moins un tenant réussit", () => {
    expect(computeExitCode([{ ok: false }, { ok: true }])).toBe(0);
  });
  it("1 quand tous les tenants échouent", () => {
    expect(computeExitCode([{ ok: false }, { ok: false }])).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `pnpm --filter @palworld-companion/pipeline test import-all`
Expected: FAIL — `Cannot find module './import-all'`.

- [ ] **Step 3: Écrire `packages/pipeline/src/import-all.ts`**

```ts
// Worker fan-out : importe les saves de tous les tenants `enabled`, un par un,
// en isolation de pannes (une config cassée ⇒ statut `error`, sans bloquer les
// autres). Exit non-zéro seulement si TOUS les tenants échouent (signal de panne
// systémique pour le badge Actions). Usage :
//   node --experimental-strip-types src/import-all.ts
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { decrypt } from "./creds.ts";
import { importPlayerSaves, syncPlayerNames } from "./import-lib.ts";

const fetchScript = new URL("../scripts/fetch-saves.py", import.meta.url).pathname;
const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;

/** Extrait la dernière ligne `DISCOVERED_REMOTE_DIR=<chemin>` d'un stdout. */
export function parseDiscoveredDir(stdout: string): string | null {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("DISCOVERED_REMOTE_DIR=")) {
      return line.slice("DISCOVERED_REMOTE_DIR=".length);
    }
  }
  return null;
}

/** 1 si ≥1 tenant et tous en échec (panne systémique), sinon 0. */
export function computeExitCode(results: Array<{ ok: boolean }>): number {
  return results.length > 0 && results.every((r) => !r.ok) ? 1 : 0;
}

type ConfigRow = {
  server_id: string;
  sftp_host: string;
  sftp_port: number;
  sftp_user: string;
  sftp_password_enc: string;
  remote_dir: string | null;
};

export async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  if (!process.env.SAVE_CREDS_KEY) throw new Error("SAVE_CREDS_KEY manquante");
  const sql = neon(process.env.DATABASE_URL);

  const configs = (await sql`
    select server_id, sftp_host, sftp_port, sftp_user, sftp_password_enc, remote_dir
    from server_import_configs where enabled = true`) as ConfigRow[];
  console.log(`${configs.length} tenant(s) activé(s)`);

  const results: Array<{ ok: boolean }> = [];
  for (const cfg of configs) {
    const dest = `/tmp/saves/${cfg.server_id}`;
    try {
      await sql`update server_import_configs
                set last_import_status = 'running', last_import_error = null
                where server_id = ${cfg.server_id}::uuid`;

      const password = decrypt(cfg.sftp_password_enc, cfg.server_id);
      rmSync(dest, { recursive: true, force: true });

      const stdout = execFileSync(venvPython, [fetchScript, dest], {
        env: {
          ...process.env,
          SFTP_HOST: `sftp://${cfg.sftp_host}:${cfg.sftp_port}`,
          SFTP_USER: cfg.sftp_user,
          SFTP_PASSWORD: password,
          SAVE_REMOTE_DIR: cfg.remote_dir ?? "",
        },
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      process.stdout.write(stdout);

      // Persister le dossier découvert quand il n'était pas encore renseigné.
      if (cfg.remote_dir === null) {
        const discovered = parseDiscoveredDir(stdout);
        if (discovered) {
          await sql`update server_import_configs set remote_dir = ${discovered}
                    where server_id = ${cfg.server_id}::uuid`;
        }
      }

      const importStats = await importPlayerSaves(sql, cfg.server_id, dest);
      const { players } = await syncPlayerNames(sql, cfg.server_id, dest);
      const stats = { ...importStats, players };

      await sql`update server_import_configs
                set last_import_status = 'ok', last_import_error = null,
                    last_import_at = now(), last_import_stats = ${JSON.stringify(stats)}::jsonb
                where server_id = ${cfg.server_id}::uuid`;
      console.log(`tenant ${cfg.server_id} : OK ${JSON.stringify(stats)}`);
      results.push({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`tenant ${cfg.server_id} : ÉCHEC ${message}`);
      await sql`update server_import_configs
                set last_import_status = 'error', last_import_error = ${message},
                    last_import_at = now()
                where server_id = ${cfg.server_id}::uuid`;
      results.push({ ok: false });
    } finally {
      // Level.sav converti ≈ 170 Mo — ne pas laisser traîner entre tenants.
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    }
  }

  process.exit(computeExitCode(results));
}

// Exécution directe uniquement : garde l'import du module sûr pour les tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
```

- [ ] **Step 4: Lancer le test — succès attendu**

Run: `pnpm --filter @palworld-companion/pipeline test import-all`
Expected: PASS (5 tests). L'import du module n'exécute pas `main()` (garde `process.argv[1]`).

Run: `cd packages/pipeline && node --experimental-strip-types --check src/import-all.ts`
Expected: aucune erreur de syntaxe.

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/import-all.ts packages/pipeline/src/import-all.test.ts
git commit -m "feat(pipeline): worker fan-out import-all (isolation des pannes, statuts par tenant)"
```

---

### Task 6: Endpoint de test SFTP `/api/servers/[slug]/sftp-test` (ssh2, conditionné au spike phase 0)

**Files:**
- Modify: `apps/web/package.json` (dépendance `ssh2` + `@types/ssh2`) — **go path uniquement**
- Create: `apps/web/src/lib/server/sftpTest.ts`
- Create: `apps/web/src/routes/api/servers/[slug]/sftp-test/+server.ts`
- Test: `apps/web/src/lib/server/sftpTest.test.ts`

**Interfaces:**
- Consumes: `requireOwner(user, slug)` (phase 2, `apps/web/src/lib/server/servers.ts`) — jette `error(401)` sans user, `error(404)` non-membre, `error(403)` membre non-owner ; retourne `{ server: ServerSummary }`.
- Produces:
  - `parseSftpTestBody(body: unknown): { host: string; port: number; user: string; password: string; remoteDir: string | null }` — **throw** `SftpTestError("invalid_body")` si champ requis manquant/mal typé.
  - `testSftpConnection(input): Promise<{ ok: true; remoteDir: string } | { ok: false; error: string }>` — ouvre une session ssh2, liste `Pal/Saved/SaveGames/0/` si `remoteDir` vide (auto-découverte), ferme.
  - `POST` sur `/api/servers/[slug]/sftp-test` → JSON `{ ok, remoteDir? , error? }`.

> **Décision go/no-go (spike phase 0 — ssh2 en TCP sortant depuis Vercel).**
> - **GO** (le spike a confirmé le TCP sortant) : implémenter les steps ci-dessous en entier.
> - **NO-GO** (Vercel bloque le TCP sortant vers le SFTP) : **sauter cette tâche entière** (pas de `ssh2`, pas de `sftpTest.ts`, pas d'endpoint). Cocher tous les steps `[x]` avec la mention « no-go spike : reporté sur lastImportStatus ». Répercussion sur la Tâche 7 : l'UI n'affiche **pas** le bouton « Tester la connexion » et se repose sur le statut du premier run Actions (`lastImportStatus`/`lastImportError`, écrits par `import-all.ts`).
> - SSRF (rejet des plages privées, DNS-pin) : **différé phase 4** dans les deux cas.

- [ ] **Step 1: Écrire le test du validateur de corps (rouge)**

`apps/web/src/lib/server/sftpTest.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parseSftpTestBody, SftpTestError } from "./sftpTest";

describe("parseSftpTestBody", () => {
  it("accepte un corps complet et normalise remoteDir vide en null", () => {
    const out = parseSftpTestBody({
      host: "sftp.example.com",
      port: 2022,
      user: "world",
      password: "pw",
      remoteDir: "",
    });
    expect(out).toEqual({
      host: "sftp.example.com",
      port: 2022,
      user: "world",
      password: "pw",
      remoteDir: null,
    });
  });

  it("rejette un corps incomplet", () => {
    expect(() => parseSftpTestBody({ host: "h" })).toThrow(SftpTestError);
  });

  it("rejette un port non entier", () => {
    expect(() =>
      parseSftpTestBody({ host: "h", port: "22", user: "u", password: "p", remoteDir: null }),
    ).toThrow(SftpTestError);
  });
});
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `pnpm --filter web test sftpTest`
Expected: FAIL — `Cannot find module './sftpTest'`.

- [ ] **Step 3: Ajouter la dépendance `ssh2`**

Run: `pnpm --filter web add ssh2 && pnpm --filter web add -D @types/ssh2`
Expected: `ssh2` ajouté aux `dependencies`, `@types/ssh2` aux `devDependencies` de `apps/web/package.json`.

- [ ] **Step 4: Écrire `apps/web/src/lib/server/sftpTest.ts`**

```ts
// Test de connexion SFTP depuis une fonction Vercel (ssh2, TCP sortant — cf.
// spike phase 0). SSRF (rejet des plages privées, DNS-pin) : différé phase 4.
import { Client } from "ssh2";

const SAVEGAMES_ROOT = "Pal/Saved/SaveGames/0";
const CONNECT_TIMEOUT_MS = 10_000;

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
    const done = (r: { ok: true; remoteDir: string } | { ok: false; error: string }) => {
      conn.end();
      resolve(r);
    };
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
```

- [ ] **Step 5: Lancer le test du validateur — succès attendu**

Run: `pnpm --filter web test sftpTest`
Expected: PASS (3 tests). (La connexion réelle est vérifiée manuellement au Step 8 — pas de serveur SFTP en CI.)

- [ ] **Step 6: Écrire l'endpoint `+server.ts`**

`apps/web/src/routes/api/servers/[slug]/sftp-test/+server.ts` :

```ts
import { error, json } from "@sveltejs/kit";
import { requireOwner } from "$lib/server/servers";
import { parseSftpTestBody, SftpTestError, testSftpConnection } from "$lib/server/sftpTest";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  await requireOwner(event.locals.user, event.params.slug);
  const body = await event.request.json().catch(() => null);
  let input;
  try {
    input = parseSftpTestBody(body);
  } catch (err) {
    if (err instanceof SftpTestError) error(400, err.code);
    throw err;
  }
  return json(await testSftpConnection(input));
}
```

- [ ] **Step 7: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 8: Vérification manuelle (dev, serveur SFTP réel)**

Run: `pnpm --filter web dev`, se connecter en owner d'un serveur, `POST /api/servers/<slug>/sftp-test` avec un vrai SFTP (via l'UI de la Tâche 7 ou `curl`). Vérifier `{ ok: true, remoteDir: "Pal/Saved/SaveGames/0/<world>" }` quand `remoteDir` est vide, et `{ ok: false, error: … }` sur mauvais mot de passe. La confirmation du TCP sortant en **prod** (Vercel) se fait au déploiement (Tâche 9) — c'est la validation finale du spike.

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/server/sftpTest.ts apps/web/src/lib/server/sftpTest.test.ts apps/web/src/routes/api/servers/[slug]/sftp-test
git commit -m "feat(web): endpoint owner de test SFTP (ssh2, auto-découverte du monde)"
```

---

### Task 7: Module `importConfig.ts` + section SFTP dans les settings owner

**Files:**
- Create: `apps/web/src/lib/server/importConfig.ts`
- Test: `apps/web/src/lib/server/importConfig.test.ts`
- Modify: `apps/web/src/routes/s/[slug]/settings/+page.server.ts` (page créée en phase 2)
- Modify: `apps/web/src/routes/s/[slug]/settings/+page.svelte` (page créée en phase 2)

**Interfaces:**
- Consumes: `requireOwner` (phase 2), `encrypt` de `$lib/server/crypto` (Tâche 2), `tables.serverImportConfigs` (Tâche 1), endpoint `POST /api/servers/[slug]/sftp-test` (Tâche 6, si go spike).
- Produces:
  - `resolvePasswordChange(input: string, hasExisting: boolean): { store: boolean; error?: "password_required" }` — champ vide + config existante ⇒ conserver ; champ vide sans config ⇒ erreur ; champ non vide ⇒ chiffrer.
  - `getImportConfig(serverId: string): Promise<ImportConfigView | null>` — **ne sélectionne jamais** `sftpPasswordEnc` ; expose `passwordSet: boolean`.
  - `saveImportConfig(serverId, input): Promise<void>` — upsert sur `serverId`.
  - Type `ImportConfigView = { sftpHost: string; sftpPort: number; sftpUser: string; remoteDir: string | null; enabled: boolean; passwordSet: boolean; lastImportAt: Date | null; lastImportStatus: "running"|"ok"|"error"|null; lastImportError: string | null }`.

- [ ] **Step 1: Écrire le test de `resolvePasswordChange` (rouge)**

`apps/web/src/lib/server/importConfig.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { resolvePasswordChange } from "./importConfig";

describe("resolvePasswordChange", () => {
  it("champ non vide ⇒ à (re)chiffrer", () => {
    expect(resolvePasswordChange("nouveau", false)).toEqual({ store: true });
    expect(resolvePasswordChange("nouveau", true)).toEqual({ store: true });
  });
  it("champ vide + config existante ⇒ conserver l'existant", () => {
    expect(resolvePasswordChange("", true)).toEqual({ store: false });
  });
  it("champ vide + pas de config ⇒ erreur password_required", () => {
    expect(resolvePasswordChange("", false)).toEqual({ store: false, error: "password_required" });
  });
});
```

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `pnpm --filter web test importConfig`
Expected: FAIL — `Cannot find module './importConfig'`.

- [ ] **Step 3: Écrire `apps/web/src/lib/server/importConfig.ts`**

```ts
import { eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import { encrypt } from "$lib/server/crypto";

export type ImportConfigView = {
  sftpHost: string;
  sftpPort: number;
  sftpUser: string;
  remoteDir: string | null;
  enabled: boolean;
  passwordSet: boolean;
  lastImportAt: Date | null;
  lastImportStatus: "running" | "ok" | "error" | null;
  lastImportError: string | null;
};

export type SaveImportConfigInput = {
  sftpHost: string;
  sftpPort: number;
  sftpUser: string;
  password: string; // vide = conserver l'existant
  remoteDir: string | null;
  enabled: boolean;
};

/** Champ vide + config existante ⇒ conserver ; vide sans config ⇒ erreur. */
export function resolvePasswordChange(
  input: string,
  hasExisting: boolean,
): { store: boolean; error?: "password_required" } {
  if (input.length > 0) return { store: true };
  if (hasExisting) return { store: false };
  return { store: false, error: "password_required" };
}

/** Vue de config SANS le ciphertext (aucun load de page ne lit sftp_password_enc). */
export async function getImportConfig(serverId: string): Promise<ImportConfigView | null> {
  const db = getDb();
  const rows = await db
    .select({
      sftpHost: tables.serverImportConfigs.sftpHost,
      sftpPort: tables.serverImportConfigs.sftpPort,
      sftpUser: tables.serverImportConfigs.sftpUser,
      remoteDir: tables.serverImportConfigs.remoteDir,
      enabled: tables.serverImportConfigs.enabled,
      lastImportAt: tables.serverImportConfigs.lastImportAt,
      lastImportStatus: tables.serverImportConfigs.lastImportStatus,
      lastImportError: tables.serverImportConfigs.lastImportError,
    })
    .from(tables.serverImportConfigs)
    .where(eq(tables.serverImportConfigs.serverId, serverId));
  const hit = rows[0];
  if (!hit) return null;
  return { ...hit, passwordSet: true };
}

export async function saveImportConfig(serverId: string, input: SaveImportConfigInput): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ serverId: tables.serverImportConfigs.serverId })
    .from(tables.serverImportConfigs)
    .where(eq(tables.serverImportConfigs.serverId, serverId));
  const hasExisting = existing.length > 0;

  const { store, error } = resolvePasswordChange(input.password, hasExisting);
  if (error) throw new Error(error);

  const base = {
    sftpHost: input.sftpHost,
    sftpPort: input.sftpPort,
    sftpUser: input.sftpUser,
    remoteDir: input.remoteDir,
    enabled: input.enabled,
  };

  if (!hasExisting) {
    // store est forcément true ici (sinon resolvePasswordChange a jeté).
    await db.insert(tables.serverImportConfigs).values({
      serverId,
      ...base,
      sftpPasswordEnc: encrypt(input.password, serverId),
    });
    return;
  }

  await db
    .update(tables.serverImportConfigs)
    .set(store ? { ...base, sftpPasswordEnc: encrypt(input.password, serverId) } : base)
    .where(eq(tables.serverImportConfigs.serverId, serverId));
}
```

- [ ] **Step 4: Lancer le test — succès attendu**

Run: `pnpm --filter web test importConfig`
Expected: PASS (3 tests).

- [ ] **Step 5: Étendre le load owner des settings**

Dans `apps/web/src/routes/s/[slug]/settings/+page.server.ts`, importer `getImportConfig` et l'ajouter au `load` (déjà gardé par `requireOwner` en phase 2). Ajouter dans le retour du `load` :

```ts
import { getImportConfig } from "$lib/server/importConfig";
// …dans load(), après la garde requireOwner qui fournit { server } :
//   return { …existant, sftp: await getImportConfig(server.id) };
```

et compléter l'objet `actions` avec l'action `saveSftp` :

```ts
import { fail } from "@sveltejs/kit";
import { requireOwner } from "$lib/server/servers";
import { saveImportConfig } from "$lib/server/importConfig";
// …dans `export const actions`:
  saveSftp: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const host = String(data.get("sftpHost") ?? "").trim();
    const portRaw = String(data.get("sftpPort") ?? "").trim();
    const user = String(data.get("sftpUser") ?? "").trim();
    const password = String(data.get("sftpPassword") ?? "");
    const remoteDirRaw = String(data.get("remoteDir") ?? "").trim();
    const enabled = data.get("enabled") === "on";
    const port = Number.parseInt(portRaw || "22", 10);
    if (host.length === 0 || user.length === 0 || !Number.isInteger(port)) {
      return fail(400, { error: "champs_invalides" });
    }
    try {
      await saveImportConfig(server.id, {
        sftpHost: host,
        sftpPort: port,
        sftpUser: user,
        password,
        remoteDir: remoteDirRaw.length > 0 ? remoteDirRaw : null,
        enabled,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "password_required") {
        return fail(400, { error: "password_required" });
      }
      throw err;
    }
    return { savedSftp: true };
  },
```

- [ ] **Step 6: Ajouter la section SFTP au `+page.svelte` (skill svelte-code-writer)**

Utiliser le skill `svelte:svelte-code-writer` / l'agent `svelte-file-editor` pour éditer `apps/web/src/routes/s/[slug]/settings/+page.svelte`. Ajouter une section (Svelte 5 runes ; `data.sftp` est `ImportConfigView | null`) :

```svelte
<section class="sftp">
  <h2>Import SFTP</h2>
  {#if data.sftp}
    <p class="status">
      Dernier import : {data.sftp.lastImportStatus ?? "jamais"}
      {#if data.sftp.lastImportAt}— {new Date(data.sftp.lastImportAt).toLocaleString()}{/if}
      {#if data.sftp.lastImportError}<span class="err">({data.sftp.lastImportError})</span>{/if}
    </p>
  {/if}
  <form method="POST" action="?/saveSftp">
    <label>Hôte <input name="sftpHost" value={data.sftp?.sftpHost ?? ""} required /></label>
    <label>Port <input name="sftpPort" type="number" value={data.sftp?.sftpPort ?? 22} /></label>
    <label>Utilisateur <input name="sftpUser" value={data.sftp?.sftpUser ?? ""} required /></label>
    <label>
      Mot de passe
      <input
        name="sftpPassword"
        type="password"
        placeholder={data.sftp?.passwordSet ? "•••••• (inchangé si vide)" : ""}
      />
    </label>
    <label>Dossier de save <input name="remoteDir" value={data.sftp?.remoteDir ?? ""} placeholder="auto-découverte" /></label>
    <label><input name="enabled" type="checkbox" checked={data.sftp?.enabled ?? false} /> Import activé</label>
    <button type="submit">Enregistrer</button>
  </form>
  <!-- Bouton présent uniquement si le spike ssh2 (Tâche 6) est GO ; en no-go,
       retirer ce bloc et se fier au statut du 1er run Actions ci-dessus. -->
  <button type="button" onclick={testConnection}>Tester la connexion</button>
  {#if testResult}<p class="test-result">{testResult}</p>{/if}
</section>
```

avec le script (runes) :

```svelte
<script lang="ts">
  import { page } from "$app/state";
  let { data } = $props();
  let testResult = $state("");

  async function testConnection() {
    testResult = "test en cours…";
    const form = document.querySelector<HTMLFormElement>("form[action='?/saveSftp']");
    const fd = new FormData(form!);
    const res = await fetch(`/api/servers/${page.params.slug}/sftp-test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host: String(fd.get("sftpHost") ?? ""),
        port: Number.parseInt(String(fd.get("sftpPort") ?? "22"), 10),
        user: String(fd.get("sftpUser") ?? ""),
        password: String(fd.get("sftpPassword") ?? ""),
        remoteDir: String(fd.get("remoteDir") ?? "") || null,
      }),
    });
    const body = await res.json();
    testResult = body.ok ? `OK — monde : ${body.remoteDir}` : `Échec : ${body.error}`;
  }
</script>
```

> Le test « Tester la connexion » envoie le mot de passe saisi ; si le champ est vide et que la config existe déjà, le test échouera (mot de passe requis pour la session live) — le noter dans l'aide contextuelle. En **no-go spike**, supprimer le bouton, la fonction `testConnection`, `testResult`, et l'import `page`.

- [ ] **Step 7: Valider le composant Svelte**

Utiliser le skill `svelte:svelte-code-writer` (autofixer) sur `+page.svelte` jusqu'à zéro problème signalé.

- [ ] **Step 8: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/server/importConfig.ts apps/web/src/lib/server/importConfig.test.ts "apps/web/src/routes/s/[slug]/settings"
git commit -m "feat(web): config SFTP owner (section settings, chiffrement à la sauvegarde, statuts d'import)"
```

---

### Task 8: Réécriture du workflow `import-saves.yml`

**Files:**
- Modify: `.github/workflows/import-saves.yml`

**Interfaces:**
- Consumes: secrets GitHub réduits à `DATABASE_URL` + `SAVE_CREDS_KEY` ; `import-all.ts` (Tâche 5) ; venv palsav/palooz/paramiko (inchangé).

- [ ] **Step 1: Réécrire le workflow**

Remplacer **tout** le contenu de `.github/workflows/import-saves.yml` par :

```yaml
name: import-saves

on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:
  # Jamais `pull_request` : repo public, les secrets ne doivent pas fuiter.

concurrency: import-saves

jobs:
  import:
    runs-on: ubuntu-latest
    # 45 min : marge pour le fan-out séquentiel de tous les tenants activés.
    # Évolution future (seuil : durée totale ~ timeout) : passer en `strategy.matrix`
    # sur les serverId (un job par tenant) — cf. spec, section « Pipeline d'import ».
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Dépendances node (pipeline seul)
        run: pnpm install --filter @palworld-companion/pipeline

      - name: venv palsav + palooz + paramiko
        run: |
          cd packages/pipeline
          python3 -m venv .venv
          git clone --depth 1 https://github.com/deafdudecomputers/PalworldSaveTools /tmp/pst
          .venv/bin/pip -q install /tmp/pst/src/palsav/palooz /tmp/pst/src/palsav paramiko

      - name: Import de tous les tenants activés
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SAVE_CREDS_KEY: ${{ secrets.SAVE_CREDS_KEY }}
        run: cd packages/pipeline && node --experimental-strip-types src/import-all.ts
```

- [ ] **Step 2: Valider la syntaxe YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/import-saves.yml'))" && echo OK`
Expected: `OK`. Vérifier à l'œil : aucun secret `SFTP_HOST`/`SFTP_USER`/`SFTP_PASSWORD`/`SAVE_REMOTE_DIR`/`LEGACY_SERVER_ID` restant ; une seule étape d'exécution (`import-all.ts`) ; `timeout-minutes: 45` ; déclencheurs `schedule` + `workflow_dispatch` seulement.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/import-saves.yml
git commit -m "feat(ci): import-saves lit les configs en base (import-all), secrets réduits à DATABASE_URL + SAVE_CREDS_KEY"
```

---

### Task 9: Runbook — migration du SFTP legacy en base + purge des secrets

**Files:**
- Create: `docs/deploy-multi-tenant-phase-3.md`
- Modify: `docs/decisions.md` (une ligne de renvoi dans « Backlog / Évolutions »)

**Interfaces:**
- Consumes: crypto/UI/worker/workflow des Tâches 1–8.
- Produces: procédure ordonnée exécutée par Sephi au déploiement (les agents ne touchent PAS à la prod).

- [ ] **Step 1: Écrire le runbook**

`docs/deploy-multi-tenant-phase-3.md` :

````markdown
# Rollout multi-tenant phase 3 — ingestion self-service (ordre impératif)

Objectif : basculer l'import legacy des secrets GH globaux vers la config SFTP
chiffrée en base, sans interruption de l'historique de tracking.

## Prérequis

- Migration `0005_*` (table `server_import_configs`) appliquée en prod :
  `DATABASE_URL=<prod> pnpm --filter web db:migrate`.
- **Générer la clé maîtresse** (une seule fois, à conserver hors repo) :
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
- Poser cette valeur :
  - Vercel : variable d'environnement `SAVE_CREDS_KEY` (chiffrement à la saisie +
    endpoint de test SFTP).
  - GitHub → Settings → Secrets → Actions : secret `SAVE_CREDS_KEY` (déchiffrement
    à l'import). Doit être **identique** à celle de Vercel.
- ⚠️ **Perte de `SAVE_CREDS_KEY`** = tous les tenants doivent ressaisir leur mot
  de passe SFTP (les ciphertext deviennent indéchiffrables). Sauvegarder la clé
  dans le gestionnaire de secrets personnel.

## Bascule du serveur legacy

1. **Geler l'import** : GitHub → Actions → `import-saves` → « Disable workflow »
   (le cron 6 h ne doit pas tourner avec l'ancien code pendant la bascule).
2. **Déployer le code phase 3** (merge de la branche → Vercel build). L'ancien
   workflow est déjà gelé ; le nouveau lit `server_import_configs`.
3. **Saisir le SFTP legacy dans l'UI** : se connecter en owner du serveur
   `legacy`, aller sur `/s/legacy/settings`, section « Import SFTP » : renseigner
   hôte/port/utilisateur/mot de passe (les mêmes valeurs que les anciens secrets
   GH `SFTP_HOST`/`SFTP_USER`/`SFTP_PASSWORD`), laisser « Dossier de save » vide
   (auto-découverte) **ou** recopier l'ancien `SAVE_REMOTE_DIR`, cocher « Import
   activé », Enregistrer. Le mot de passe est chiffré avec `SAVE_CREDS_KEY`.
4. **Tester la connexion** (si le bouton est présent — spike ssh2 GO) : doit
   renvoyer OK + le dossier de monde. Si le spike était NO-GO, passer à l'étape 5
   (la validation vient du premier run).
5. **Dégeler l'import** (« Enable workflow ») puis lancer un run manuel
   (`workflow_dispatch`). Vérifier dans le log : `1 tenant(s) activé(s)`, statut
   `OK`, compteurs (pals/techs/effigies/pseudos) cohérents avec le dernier run de
   l'ère legacy. Sur `/s/legacy/settings`, `lastImportStatus = ok` et
   `lastImportAt` récent.
6. **Contrôles finaux** : sur `/s/legacy`, paldex/tech/map/import identiques à
   avant ; un GUID revendiqué (« Rain ») toujours lié ; si `remoteDir` était vide,
   il est désormais rempli en base (auto-découverte persistée).

## Purge des anciens secrets (uniquement après un run OK)

7. GitHub → Settings → Secrets → Actions : **supprimer** `SFTP_HOST`,
   `SFTP_USER`, `SFTP_PASSWORD`, `SAVE_REMOTE_DIR`, `LEGACY_SERVER_ID`.
   `DATABASE_URL` et `SAVE_CREDS_KEY` restent.

## Rollback

- Avant l'étape 7 : réactiver l'ancien workflow depuis un revert du code, les
  anciens secrets étant toujours présents.
- Après l'étape 7 : recréer les secrets `SFTP_*`/`SAVE_REMOTE_DIR`/
  `LEGACY_SERVER_ID` à partir de la sauvegarde avant de revert.
````

- [ ] **Step 2: Renvoi dans decisions.md**

Ajouter à `docs/decisions.md`, sous « Backlog / Évolutions », après la ligne phase 1 :

```markdown
- Multi-tenant phase 3 : ingestion SFTP self-service, rollout selon
  `docs/deploy-multi-tenant-phase-3.md` (clé `SAVE_CREDS_KEY`, migration du
  SFTP legacy en base, purge des secrets `SFTP_*`).
```

- [ ] **Step 3: Commit**

```bash
git add docs/deploy-multi-tenant-phase-3.md docs/decisions.md
git commit -m "docs: runbook de rollout multi-tenant phase 3 (SFTP self-service)"
```

---

## Auto-revue (couverture de la spec phase 3)

Revue du plan contre la spec (`2026-07-22-multi-tenant-design.md`, phase 3 + sections « Chiffrement des credentials » et « Pipeline d'import ») :

**Couverture de la spec :**
- Table `server_import_configs` (serverId PK, host/port/user/passwordEnc, remoteDir nullable, enabled, last*), table séparée du ciphertext → **Tâche 1**. ✅
- Crypto AES-256-GCM `node:crypto`, format `v1:`+base64(iv‖ct‖tag), AAD=serverId, clé `SAVE_CREDS_KEY`, miroirs `crypto.ts`/`creds.ts` synchrones, `passwordSet`/vide=conserver → **Tâches 2 & 7**. Tests round-trip / AAD / tamper / version / miroir-interop. ✅
- Refactor `import-lib.ts` (`importPlayerSaves`/`syncPlayerNames`), coques CLI, SQL préservé (transaction idempotente, UNION `::text[]`, filtre markers.json) → **Tâche 3**. ✅
- `import-all.ts` : fan-out, isolation des pannes (try/catch par tenant), `running`→`ok`/`error`, stats jsonb, auto-découverte réécrite en base, nettoyage `/tmp/saves/<serverId>`, exit non-zéro ssi tous échouent → **Tâche 5**. ✅
- Auto-découverte dans `fetch-saves.py` (liste `SaveGames/0/`, unique monde, dernière ligne parsable) → **Tâche 4**. ✅
- Endpoint `sftp-test` owner via `requireOwner`, ssh2, conditionné au spike phase 0 avec fallback documenté ; SSRF différé phase 4 → **Tâche 6**. ✅
- UI SFTP dans `/s/[slug]/settings` (host/port/user/password write-only, remoteDir placeholder auto-découverte, toggle enabled, bouton test, affichage lastImport*) → **Tâche 7**. ✅
- Workflow réécrit (secrets réduits, étape unique `import-all.ts`, `timeout-minutes: 45`, `schedule`+`workflow_dispatch`, matrix en commentaire) → **Tâche 8**. ✅
- Migration du SFTP legacy en base + purge des secrets `SFTP_*` → **Tâche 9**. ✅

**Contraintes globales :** zéro dép crypto (node:crypto), `ssh2` unique dép gated spike, neon brut `${arr}::text[]` préservé, repo public sans secrets, `SAVE_CREDS_KEY` perte documentée, miroir byte-identique testé, migrations `db:generate`/`db:migrate`, français. ✅

**Cohérence des types :** `ImportStats` (Tâche 3) consommé par `import-all` (Tâche 5) ; `encrypt`/`decrypt(x, serverId)` identiques Tâches 2/5/7 ; `parseDiscoveredDir`/`computeExitCode` définis et testés Tâche 5 ; `DISCOVERED_REMOTE_DIR=` produit Tâche 4, consommé Tâche 5 ; `requireOwner` (phase 2) consommé Tâches 6/7 ; `resolvePasswordChange` défini/testé/consommé Tâche 7. ✅

**Placeholders :** aucun « TODO »/« similaire à Tâche N »/« gérer les cas limites » — code complet à chaque step. Le seul embranchement conditionnel (spike ssh2 GO/NO-GO, Tâche 6) est explicité avec les deux chemins. ✅
