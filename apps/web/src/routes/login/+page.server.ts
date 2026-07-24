import { redirect } from "@sveltejs/kit";
import type { PageServerLoadEvent } from "./$types";

// La landing vit désormais à la racine ; on préserve la query
// (ex. ?redirectTo=… du funnel d'invitation).
export function load({ url }: PageServerLoadEvent) {
  redirect(302, `/${url.search}`);
}
