// Sélection/validation client-side des fichiers de save à uploader (co-op
// local). Module framework-free (pas d'import Svelte/DOM) pour rester
// testable unitairement — la page +page.svelte se contente de mapper les
// `File`/`FileList` du navigateur vers `FileDescriptor` avant d'appeler ceci.
import { MAX_FILES, MAX_LEVEL_BYTES, MAX_PLAYER_BYTES, PLAYER_SAV_PATTERN } from "$lib/upload-limits";

/** Description minimale d'un fichier sélectionné, indépendante du DOM.
 *  `relativePath` = `webkitRelativePath` (sélection dossier) ou `name`
 *  (sélection multi-fichiers fallback, où il n'y a pas de structure de
 *  dossier connue). */
export type FileDescriptor = {
  name: string;
  size: number;
  relativePath: string;
};

export type UploadFileKind = "level" | "player";

export type KeptFile = FileDescriptor & { kind: UploadFileKind };

export type SelectionResult = {
  kept: KeptFile[];
  ignoredCount: number;
};

/** Filtre les fichiers sélectionnés :
 *  - Level.sav gardé s'il n'est PAS sous un dossier Players/ ;
 *  - fichier `<32 hex>.sav` gardé s'il est sous Players/ (sélection dossier)
 *    ou sélectionné directement (fallback, pas de chemin) ;
 *  - tout le reste est ignoré silencieusement (compté). */
export function selectUploadFiles(files: FileDescriptor[]): SelectionResult {
  const kept: KeptFile[] = [];
  let ignoredCount = 0;

  for (const file of files) {
    const segments = file.relativePath.split("/");
    const filename = segments[segments.length - 1] ?? file.name;
    const dirSegments = segments.slice(0, -1);
    const isFolderSelection = dirSegments.length > 0;
    const underPlayers = dirSegments.includes("Players");

    if (filename === "Level.sav" && !underPlayers) {
      kept.push({ ...file, kind: "level" });
      continue;
    }

    const isPlayerCandidate = PLAYER_SAV_PATTERN.test(filename);
    const playerAllowedHere = isFolderSelection ? underPlayers : true;
    if (isPlayerCandidate && playerAllowedHere) {
      kept.push({ ...file, kind: "player" });
      continue;
    }

    ignoredCount++;
  }

  return { kept, ignoredCount };
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: "missing_level" | "missing_player" | "too_many_files" | "level_too_large" | "player_too_large" };

/** Valide la sélection retenue avant d'activer le bouton d'envoi. Codes
 *  d'erreur alignés sur ceux de `validateBlobListing` côté serveur
 *  (lib/server/uploads.ts) pour partager le même mapping i18n. */
export function validateSelection(kept: KeptFile[]): ValidationResult {
  const level = kept.find((f) => f.kind === "level");
  const players = kept.filter((f) => f.kind === "player");

  if (!level) return { ok: false, error: "missing_level" };
  if (players.length === 0) return { ok: false, error: "missing_player" };
  if (kept.length > MAX_FILES) return { ok: false, error: "too_many_files" };
  if (level.size > MAX_LEVEL_BYTES) return { ok: false, error: "level_too_large" };
  if (players.some((p) => p.size > MAX_PLAYER_BYTES)) return { ok: false, error: "player_too_large" };

  return { ok: true };
}
