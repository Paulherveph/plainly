import type { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/server/container";

const Query = z.object({
  id: z.uuid().optional(),
  documentId: z.uuid().optional(),
  dueOn: z.iso.date().optional(),
});

/** GET /api/deadlines/ics[?id=|?documentId=&dueOn=] → text/calendar for the signed-in user only. */
export async function GET(request: NextRequest) {
  const query = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return new Response("Bad request", { status: 400 });

  const c = await container();
  const user = await c.currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const file = await c.exportDeadlines(user.id, query.data);
  if (!file.ok) return new Response("Error", { status: 500 });
  if (file.value.count === 0 && query.data.id) return new Response("Not found", { status: 404 });

  return new Response(file.value.body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${file.value.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
