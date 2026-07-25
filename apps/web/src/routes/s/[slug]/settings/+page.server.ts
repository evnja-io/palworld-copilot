import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import { getImportConfig, saveImportConfig } from "$lib/server/importConfig";
import {
  createInvite,
  listInvites,
  listMembers,
  requireOwner,
  revokeInvite,
} from "$lib/server/servers";
import { getPostHogClient } from "$lib/server/posthog";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals, params }: PageServerLoadEvent) {
  const { server } = await requireOwner(locals.user, params.slug);
  return {
    // Re-exposé ici (non-null) : le layout renvoie désormais une union
    // invité/membre, et `Omit` n'est pas distributif dans un +page.svelte.
    server,
    invites: await listInvites(server.id),
    members: await listMembers(server.id),
    sftp: await getImportConfig(server.id),
  };
}

export const actions: Actions = {
  rename: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const name = data.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      return fail(400, { action: "rename", error: "name_required" });
    }
    const db = getDb();
    await db
      .update(tables.servers)
      .set({ name: name.trim() })
      .where(eq(tables.servers.id, server.id));
    const posthog = getPostHogClient();
    posthog.capture({ distinctId: locals.user!.id, event: "server_renamed", properties: { server_slug: params.slug } });
    await posthog.flush();
    return { renamed: true };
  },

  createInvite: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const expiresRaw = data.get("expiresAt");
    const maxUsesRaw = data.get("maxUses");

    let expiresAt: Date | null = null;
    if (typeof expiresRaw === "string" && expiresRaw.length > 0) {
      const d = new Date(expiresRaw);
      if (Number.isNaN(d.getTime())) return fail(400, { action: "invite", error: "bad_expiry" });
      expiresAt = d;
    }
    let maxUses: number | null = null;
    if (typeof maxUsesRaw === "string" && maxUsesRaw.length > 0) {
      const parsed = Number.parseInt(maxUsesRaw, 10);
      if (!Number.isInteger(parsed) || parsed < 1)
        return fail(400, { action: "invite", error: "bad_maxuses" });
      maxUses = parsed;
    }

    await createInvite(server.id, locals.user!.id, { expiresAt, maxUses });
    const posthog = getPostHogClient();
    posthog.capture({ distinctId: locals.user!.id, event: "invite_created", properties: { server_slug: params.slug } });
    await posthog.flush();
    return { invited: true };
  },

  revokeInvite: async ({ request, locals, params }) => {
    await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const code = data.get("code");
    if (typeof code !== "string" || code.length === 0)
      return fail(400, { action: "revoke", error: "bad_code" });
    await revokeInvite(code, locals.user!.id);
    const posthog = getPostHogClient();
    posthog.capture({ distinctId: locals.user!.id, event: "invite_revoked", properties: { server_slug: params.slug } });
    await posthog.flush();
    return { revoked: true };
  },

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
      return fail(400, { action: "sftp", error: "champs_invalides" });
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
        return fail(400, { action: "sftp", error: "password_required" });
      }
      throw err;
    }
    const posthog = getPostHogClient();
    posthog.capture({ distinctId: locals.user!.id, event: "sftp_config_saved", properties: { server_slug: params.slug, enabled } });
    await posthog.flush();
    return { savedSftp: true };
  },
};
