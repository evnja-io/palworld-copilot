import { fail } from "@sveltejs/kit";
import { getImportConfig, saveImportConfig } from "$lib/server/importConfig";
import { createInvite, listInvites, requireOwner } from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals, params }: PageServerLoadEvent) {
  const { server } = await requireOwner(locals.user, params.slug);
  const invites = await listInvites(server.id);
  const active = invites.find((i) => !i.revokedAt) ?? null;
  return {
    kind: server.kind,
    name: server.name,
    sftp: server.kind === "dedicated" ? await getImportConfig(server.id) : null,
    inviteCode: active?.code ?? null,
  };
}

export const actions: Actions = {
  // Enregistre les identifiants SFTP (chemin dédié). Réutilise saveImportConfig
  // comme l'écran de réglages ; le mot de passe est requis à la 1re configuration.
  saveSftp: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const host = String(data.get("sftpHost") ?? "").trim();
    const portRaw = String(data.get("sftpPort") ?? "").trim();
    const user = String(data.get("sftpUser") ?? "").trim();
    const password = String(data.get("sftpPassword") ?? "");
    const remoteDirRaw = String(data.get("remoteDir") ?? "").trim();
    const port = Number.parseInt(portRaw || "22", 10);
    if (host.length === 0 || user.length === 0 || !Number.isInteger(port)) {
      return fail(400, { action: "sftp", error: "champs_invalides" });
    }
    try {
      await saveImportConfig(server.id, {
        sftpHost: host,
        sftpPort: port,
        sftpUser: user,
        password,
        remoteDir: remoteDirRaw.length > 0 ? remoteDirRaw : null,
        // Activé d'emblée : l'utilisateur vient de choisir le mode dédié.
        enabled: true,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "password_required") {
        return fail(400, { action: "sftp", error: "password_required" });
      }
      throw err;
    }
    return { savedSftp: true };
  },

  // Génère (ou renvoie) un lien d'invitation pour l'étape finale.
  invite: async ({ locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const existing = (await listInvites(server.id)).find((i) => !i.revokedAt);
    const code = existing?.code ?? (await createInvite(server.id, locals.user!.id, {})).code;
    return { inviteCode: code };
  },
};
