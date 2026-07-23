// Valide une cible de redirection post-login : uniquement un chemin interne.
// Protection open-redirect : rejette tout ce qui n'est pas un chemin local
// commençant par un seul "/". Renvoie le chemin sûr, ou null.
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return null;
  // Doit commencer par "/" mais pas "//" (protocol-relative) ni "/\" (bypass).
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // Pas de caractères de contrôle / espaces (anti header-injection, backslashes).
  if (/[\x00-\x1f\x7f\\]/.test(raw)) return null;
  return raw;
}
