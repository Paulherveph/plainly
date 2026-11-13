import { timingSafeEqual } from "node:crypto";
import { makeExpireDocuments } from "@/modules/documents/application/expire-documents";
import { retentionDeps } from "@/server/retention";
import { serverEnv } from "@/shared/config/env";

/** Daily (vercel.json). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  const deps = retentionDeps();
  if (!deps) return new Response("Retention is not configured", { status: 503 });
  const result = await makeExpireDocuments(deps)();
  return result.ok
    ? Response.json(result.value)
    : Response.json({ error: result.error.kind }, { status: 500 });
}
