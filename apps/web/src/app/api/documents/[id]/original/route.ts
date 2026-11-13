import type { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/server/container";

/** GET /api/documents/:id/original → the uploaded file, inline, for its owner only. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/documents/[id]/original">) {
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return new Response("Not found", { status: 404 });

  const c = await container();
  const user = await c.currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const file = await c.readOriginal(user.id, id.data);
  if (!file.ok) return new Response("Not found", { status: file.error.kind === "not_found" ? 404 : 500 });

  return new Response(file.value.bytes as BodyInit, {
    headers: {
      "content-type": file.value.mediaType,
      "content-disposition": "inline",
      "cache-control": "private, no-store",
    },
  });
}
