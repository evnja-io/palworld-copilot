import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import {
  createInvite,
  listInvites,
  listMembers,
  requireOwner,
  revokeInvite,
} from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals, params }: PageServerLoadEvent) {
  const { server } = await requireOwner(locals.user, params.slug);
  return {
    invites: await listInvites(server.id),
    members: await listMembers(server.id),
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
    return { invited: true };
  },

  revokeInvite: async ({ request, locals, params }) => {
    await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const code = data.get("code");
    if (typeof code !== "string" || code.length === 0)
      return fail(400, { action: "revoke", error: "bad_code" });
    await revokeInvite(code, locals.user!.id);
    return { revoked: true };
  },
};
