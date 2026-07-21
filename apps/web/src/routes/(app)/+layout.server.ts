import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoadEvent } from "./$types";

export function load({ locals }: LayoutServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  return { user: locals.user };
}
