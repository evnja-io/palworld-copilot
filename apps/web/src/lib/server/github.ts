// Déclenche le worker GitHub Actions qui traite les uploads de saves en attente
// (repository_dispatch). Le worker consomme la ligne save_uploads 'pending'.
import { env } from "$env/dynamic/private";

export async function dispatchImportUpload({
  uploadId,
  serverId,
}: {
  uploadId: string;
  serverId: string;
}): Promise<void> {
  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_DISPATCH_TOKEN;
  if (!repo || !token) {
    throw new Error("GITHUB_REPO ou GITHUB_DISPATCH_TOKEN manquant");
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "import-upload",
      client_payload: { uploadId, serverId },
    }),
  });

  if (res.status !== 204) {
    // Ne jamais inclure le token dans le message d'erreur.
    throw new Error(`dispatch GitHub échoué (HTTP ${res.status})`);
  }
}
