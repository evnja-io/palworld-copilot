import type { ParamMatcher } from "@sveltejs/kit";

// N'accepte que des UUID (v1-v5) : un teamId malformé → 404 au lieu d'un 500
// (Postgres rejette « invalid input syntax for type uuid » sur la requête).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const match: ParamMatcher = (param) => UUID.test(param);
