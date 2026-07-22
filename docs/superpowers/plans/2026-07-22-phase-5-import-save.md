# Phase 5 — Import de sauvegarde : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Une USER ACTION centrale : fournir les `Players/*.sav` du serveur pour le
> test réel. Exécution inline recommandée.

**Goal:** Un membre (l'opérateur) importe les saves du serveur d'une commande ; l'app coche automatiquement Pals capturés et technos débloquées pour chaque joueur ayant revendiqué son GUID — sans jamais décocher quoi que ce soit.

**Architecture:** Deux temps. (1) **CLI opérateur** (`packages/pipeline`) : convertit chaque `Players/<GUID>.sav` (palsav/venv, format PlM), extrait `PaldeckUnlockFlag` + `UnlockedRecipeTechnologyNames` (+ flags carte stockés pour la Phase 7), écrit dans une table `save_snapshots` (faits bruts par GUID, remplacement idempotent), puis fusionne — **additivement** — vers `progress` pour les GUIDs déjà revendiqués. (2) **Page web `/import`** : liste les GUIDs importés (stats par kind, revendiqué par qui), bouton « c'est moi » → `users.palPlayerGuid` + fusion immédiate. Les imports suivants ré-appliquent automatiquement.

**Tech Stack:** existant + venv Python du pipeline (palsav/palooz, installés en Phase 0).

## Global Constraints

- Spec (section « Import de sauvegarde ») + décisions Phase 0 (`PlM`, contenu RecordData, corrélation confirmée)
- **Additif uniquement** : l'import fait des `INSERT … ON CONFLICT DO NOTHING` dans `progress` ; jamais de DELETE ; les coches manuelles restent intactes
- Snapshots : vérité brute par GUID — `save_snapshots (player_guid, kind, entity_id, imported_at)`, remplacement complet par GUID à chaque import (DELETE + INSERT du snapshot, PAS de progress)
- Kinds fusionnés en v1 : `pal_caught`, `tech_unlocked` (validés contre le registre) ; kinds carte (`relic`, `note`, `fast_travel`, `boss`) stockés en snapshot sous préfixe `raw:` mais PAS fusionnés (Phase 7)
- IDs de Pals : `PaldeckUnlockFlag` peut contenir des variantes (BOSS_…) — ne fusionner que les ids présents dans pals.json
- Un GUID ne peut être revendiqué que par un seul utilisateur (unicité déjà en base) et un utilisateur ne revendique qu'une fois (changement = cas hors v1)
- La page `/import` est accessible à tout membre connecté (outil de groupe) ; lien dans la zone utilisateur du topbar
- Branche : `feature/phase-5-import-save`

---

### Task 1: Spike mapping — valider les IDs de la vraie save

**Files:**
- Create: `packages/pipeline/spike/import-mapping.ts`
- Modify: `packages/pipeline/package.json` (script `spike:import`)

**Interfaces:**
- Consumes: `raw/save/player.sav.json` (Phase 0), `pals.json`, `tech.json`
- Produces: certitude sur les clés exactes et le taux de correspondance —
  paramètre les extracteurs de la Task 3

- [ ] **Step 1: Écrire le spike**

`packages/pipeline/spike/import-mapping.ts` :
```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const saveDir = new URL("../raw/save/", import.meta.url).pathname;
const jsonFile = readdirSync(saveDir).find((f) => f.endsWith(".sav.json"));
if (!jsonFile) throw new Error("Aucun .sav.json — relancer la conversion (runbook)");
const save = JSON.parse(readFileSync(join(saveDir, jsonFile), "utf8"));
const sd = save.properties.SaveData.value;
const rd = sd.RecordData.value;

const palIds = new Set(
  JSON.parse(readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8")).map(
    (p: any) => p.id,
  ),
);
const techIds = new Set(
  JSON.parse(readFileSync(new URL("../../game-data/tech.json", import.meta.url).pathname, "utf8")).map(
    (t: any) => t.id,
  ),
);

// Structure exacte à constater : imprimer un échantillon brut de chaque clé.
const paldeck = rd.PaldeckUnlockFlag?.value ?? rd.PaldeckUnlockFlag;
console.log("PaldeckUnlockFlag brut:", JSON.stringify(paldeck).slice(0, 300));
const techs = sd.UnlockedRecipeTechnologyNames?.value ?? sd.UnlockedRecipeTechnologyNames;
console.log("UnlockedRecipeTechnologyNames brut:", JSON.stringify(techs).slice(0, 300));

// Adapter les deux extracteurs ci-dessous à la structure imprimée, puis :
const palEntries: string[] = []; // TODO spike : remplir depuis paldeck
const techEntries: string[] = []; // TODO spike : remplir depuis techs
console.log(
  `pals: ${palEntries.filter((id) => palIds.has(id)).length}/${palEntries.length} reconnus ; ` +
    `techs: ${techEntries.filter((id) => techIds.has(id)).length}/${techEntries.length} reconnus`,
);
console.log("SPIKE OK");
```
(Les deux `TODO spike` sont le but de la tâche : la structure exacte —
tableau de structs, map, enum names — n'est connue qu'à l'exécution. Les
remplir, noter la règle dans le rapport de sortie de tâche, elle sera reprise
telle quelle en Task 3.)

- [ ] **Step 2: Exécuter et itérer jusqu'à SPIKE OK avec ≥90% de reconnaissance**

Run: `pnpm --filter @palworld-companion/pipeline spike:import`
Expected: structures imprimées, extracteurs remplis, taux de reconnaissance
pals et techs ≥ 90% (les variantes non reconnues sont attendues et listées).

- [ ] **Step 3: Commit**

```bash
git add packages/pipeline
git commit -m "feat(spike): mapping save -> pals/techs validé sur une vraie save"
```

---

### Task 2: Migration — table save_snapshots

**Files:**
- Modify: `apps/web/src/lib/server/db/schema.ts`
- Create: `apps/web/drizzle/0001_*.sql` (généré)

**Interfaces:**
- Consumes: schéma existant
- Produces: table `save_snapshots` — écrite par le CLI (Task 3), lue par
  `/import` (Task 4)

- [ ] **Step 1: Étendre le schéma**

Ajouter à `apps/web/src/lib/server/db/schema.ts` :
```ts
export const saveSnapshots = pgTable(
  "save_snapshots",
  {
    playerGuid: text("player_guid").notNull(),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerGuid, t.kind, t.entityId] })],
);
```

- [ ] **Step 2: Générer + appliquer + committer**

```bash
pnpm --filter web db:generate && pnpm --filter web db:migrate
git add apps/web/src/lib/server/db apps/web/drizzle
git commit -m "feat(web): table save_snapshots (faits bruts d'import par GUID)"
```

---

### Task 3: CLI d'import opérateur

**Files:**
- Create: `packages/pipeline/src/import-save.ts`
- Modify: `packages/pipeline/package.json` (script `import-save`)
- Modify: `docs/extraction-runbook.md` (section import)

**Interfaces:**
- Consumes: dossier de `.sav` (arg CLI), venv palsav (Phase 0), `DATABASE_URL`
  (env), `pals.json`/`tech.json`, règles d'extraction (Task 1)
- Produces: commande
  `DATABASE_URL=… pnpm --filter @palworld-companion/pipeline import-save <dossier>` :
  snapshots remplacés par GUID + fusion additive vers `progress` pour les
  GUIDs revendiqués ; résumé imprimé (par GUID : n pals, n techs, revendiqué
  par X / non revendiqué)

- [ ] **Step 1: Écrire le CLI**

`packages/pipeline/src/import-save.ts` — structure imposée :
```ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { neon } from "@neondatabase/serverless";

// 1. Arguments et environnement
const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error("Usage: import-save <dossier contenant des Players/*.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante (utiliser --env-file)");
const sql = neon(process.env.DATABASE_URL);
const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;
if (!existsSync(venvPython)) throw new Error("venv palsav absent — cf. runbook, section saves");

// 2. Datasets de validation
const palIds = new Set<string>(JSON.parse(readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8")).map((p: any) => p.id));
const techIds = new Set<string>(JSON.parse(readFileSync(new URL("../../game-data/tech.json", import.meta.url).pathname, "utf8")).map((t: any) => t.id));

// 3. Par fichier .sav : convertir (palsav -> JSON temporaire), extraire, snapshoter
const savs = readdirSync(dir).filter((f) => f.endsWith(".sav"));
if (savs.length === 0) throw new Error(`Aucun .sav dans ${dir}`);
for (const sav of savs) {
  const guid = basename(sav, ".sav");
  const jsonPath = join(dir, `${guid}.sav.json`);
  execFileSync(venvPython, ["-m", "palsav.commands.convert", join(dir, sav), "--to-json", "-o", jsonPath, "--force"]);
  const save = JSON.parse(readFileSync(jsonPath, "utf8"));
  const sd = save.properties.SaveData.value;
  const rd = sd.RecordData.value;

  // Extracteurs : REPRENDRE LES RÈGLES EXACTES DU SPIKE (Task 1).
  const pals: string[] = /* extraction PaldeckUnlockFlag */ [];
  const techs: string[] = /* extraction UnlockedRecipeTechnologyNames */ [];
  // Flags carte stockés bruts pour la Phase 7 (non fusionnés) :
  const relics: string[] = /* GUIDs RelicObtainForInstanceFlag */ [];

  const rows = [
    ...pals.filter((id) => palIds.has(id)).map((id) => ({ kind: "pal_caught", id })),
    ...techs.filter((id) => techIds.has(id)).map((id) => ({ kind: "tech_unlocked", id })),
    ...relics.map((id) => ({ kind: "raw:relic", id })),
  ];

  // 4. Remplacement idempotent du snapshot de CE guid
  await sql`delete from save_snapshots where player_guid = ${guid}`;
  for (const r of rows) {
    await sql`insert into save_snapshots (player_guid, kind, entity_id) values (${guid}, ${r.kind}, ${r.id})`;
  }
  console.log(`${guid} : ${pals.length} pals, ${techs.length} techs, ${relics.length} effigies (snapshot)`);
}

// 5. Fusion additive vers progress pour les GUIDs revendiqués (kinds officiels seulement)
const merged = await sql`
  insert into progress (user_id, kind, entity_id)
  select u.id, s.kind, s.entity_id
  from save_snapshots s
  join users u on u.pal_player_guid = s.player_guid
  where s.kind in ('pal_caught', 'tech_unlocked')
  on conflict do nothing
  returning user_id`;
console.log(`fusion : ${merged.length} nouvelles coches appliquées`);

// 6. Récapitulatif des GUIDs non revendiqués
const unclaimed = await sql`
  select s.player_guid, count(*) as n from save_snapshots s
  left join users u on u.pal_player_guid = s.player_guid
  where u.id is null group by s.player_guid`;
for (const r of unclaimed) console.log(`non revendiqué : ${r.player_guid} (${r.n} entrées) — page /import`);
```
Script : `"import-save": "node --env-file=../../apps/web/.env --experimental-strip-types src/import-save.ts"`.
Insertion des snapshots par lots (`unnest` ou multi-values) si > quelques
centaines de lignes — une requête par ligne sur Neon HTTP serait lente.

- [ ] **Step 2: Runbook**

Ajouter à `docs/extraction-runbook.md` une section « Importer les saves du
serveur » : où récupérer `Players/*.sav`, la commande, la sémantique additive,
et le renvoi vers `/import` pour la revendication.

- [ ] **Step 3: Test réel (USER ACTION possible)**

Run: `pnpm --filter @palworld-companion/pipeline import-save packages/pipeline/raw/save`
(sur la save déjà présente ; l'utilisateur peut déposer celles des autres
membres). Expected: résumé par GUID, `fusion : 0` (GUID pas encore revendiqué),
GUID listé comme non revendiqué. Relancer : mêmes comptes (idempotent).

- [ ] **Step 4: Commit**

```bash
git add packages/pipeline docs/extraction-runbook.md
git commit -m "feat(pipeline): CLI import-save (snapshots + fusion additive)"
```

---

### Task 4: Page /import — revendication des GUIDs

**Files:**
- Create: `apps/web/src/lib/server/import.ts`
- Create: `apps/web/src/routes/(app)/import/+page.server.ts`
- Create: `apps/web/src/routes/(app)/import/+page.svelte`
- Modify: `apps/web/src/routes/(app)/+layout.svelte` (lien zone utilisateur)
- Modify: `apps/web/messages/*.json`

**Interfaces:**
- Consumes: `save_snapshots`, `users`, `progress`
- Produces: `/import` — tableau des GUIDs (stats par kind, revendiqué par qui,
  dernier import) ; action « C'est moi » : `users.palPlayerGuid = guid` +
  fusion additive immédiate des kinds officiels de ce GUID vers `progress`

- [ ] **Step 1: Module serveur**

`apps/web/src/lib/server/import.ts` :
```ts
import { and, eq, inArray, isNull, sql as dsql } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";

export async function listSnapshots() {
  const db = getDb();
  return db
    .select({
      playerGuid: tables.saveSnapshots.playerGuid,
      kind: tables.saveSnapshots.kind,
      count: dsql<number>`count(*)::int`,
      lastImport: dsql<string>`max(${tables.saveSnapshots.importedAt})`,
      claimedBy: tables.users.username,
    })
    .from(tables.saveSnapshots)
    .leftJoin(tables.users, eq(tables.users.palPlayerGuid, tables.saveSnapshots.playerGuid))
    .groupBy(tables.saveSnapshots.playerGuid, tables.saveSnapshots.kind, tables.users.username);
}

/** Revendique guid pour userId puis fusionne additivement ses kinds officiels. */
export async function claimGuid(userId: string, guid: string) {
  const db = getDb();
  const updated = await db
    .update(tables.users)
    .set({ palPlayerGuid: guid })
    .where(and(eq(tables.users.id, userId), isNull(tables.users.palPlayerGuid)))
    .returning();
  if (updated.length === 0) throw new Error("Déjà revendiqué (toi ou ce GUID)");
  await db.execute(dsql`
    insert into progress (user_id, kind, entity_id)
    select ${userId}, kind, entity_id from save_snapshots
    where player_guid = ${guid} and kind in ('pal_caught', 'tech_unlocked')
    on conflict do nothing`);
}
```
(L'unicité du GUID côté « déjà pris par un autre » est garantie par la
contrainte `unique` de la colonne — l'update échoue en base ; l'attraper et
renvoyer une erreur propre.)

- [ ] **Step 2: Load + action + page**

`+page.server.ts` : `load` → `listSnapshots()` regroupé par GUID côté serveur
(`{ guid, kinds: {pal_caught: n, …}, claimedBy, lastImport }`), + `mine =
locals.user.palPlayerGuid` ; action de formulaire `claim` (POST, `guid` en
champ) → `claimGuid(locals.user.id, guid)` avec gestion d'erreur → message.
`+page.svelte` : tableau des GUIDs — GUID abrégé (8 premiers caractères),
badges par kind (n pals / n techs / n effigies brutes), « revendiqué par X » ou
bouton « C'est moi » (form action), date du dernier import ; encart d'aide
(comment lancer l'import, renvoi au runbook).
Messages : FR `"import_title": "Import de sauvegarde"`, `"import_claim":
"C'est moi"`, `"import_claimed_by": "Revendiqué par {name}"`,
`"import_last": "Dernier import"`, `"import_help": "L'import se lance depuis
le dépôt : voir docs/extraction-runbook.md."`, `"import_empty": "Aucun import
pour l'instant."` (EN homologue).
Lien : dans `(app)/+layout.svelte`, zone `.user`, `<a href="/import">📥</a>`
avec `title`/`aria-label` = `m.import_title()`.

- [ ] **Step 3: Vérification + commit**

Run: check + build + tests verts. Manuel : `/import` liste le GUID de la Task 3.

```bash
git add apps/web
git commit -m "feat(web): page /import — revendication des GUIDs et fusion additive"
```

---

### Task 5: Bout en bout réel + déploiement

**Files:** aucun nouveau

**Interfaces:**
- Produces: critère de sortie spec : « un upload du dossier Players/ coche
  automatiquement les Paldex et technos de tous les membres liés »

- [ ] **Step 1: Parcours complet sur la vraie save**

1. `pnpm --filter @palworld-companion/pipeline import-save packages/pipeline/raw/save`
2. `/import` (local ou prod) → revendiquer le GUID avec le compte Sephi
3. Vérifier : Paldex affiche les Pals de la save cochés (41 attendus d'après
   la Phase 0) ; `/tech` affiche les technos débloquées ; les coches
   manuelles antérieures sont intactes
4. Relancer l'import → aucun doublon, rien de décoché

- [ ] **Step 2: Déployer + USER ACTION**

```bash
vercel deploy --prod --yes
```
USER ACTION : récupérer les `Players/*.sav` de tous les membres depuis le
serveur, les déposer dans un dossier, relancer l'import ; chaque membre
revendique son GUID sur `/import` ; Zak vérifie que son Paldex se coche seul.

- [ ] **Step 3: Clôture**

Corrections éventuelles, puis skill finishing-a-development-branch.
