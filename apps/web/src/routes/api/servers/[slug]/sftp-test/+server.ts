import { error, json } from "@sveltejs/kit";
import { requireOwner } from "$lib/server/servers";
import { parseSftpTestBody, SftpTestError, testSftpConnection } from "$lib/server/sftpTest";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  await requireOwner(event.locals.user, event.params.slug);
  const body = await event.request.json().catch(() => null);
  let input;
  try {
    input = parseSftpTestBody(body);
  } catch (err) {
    if (err instanceof SftpTestError) error(400, err.code);
    throw err;
  }
  return json(await testSftpConnection(input));
}
