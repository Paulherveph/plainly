import { z } from "zod";
import { container } from "@/server/container";
import type { AppError } from "@/shared/lib/errors";
import { log } from "@/shared/lib/log";

export const maxDuration = 120;

const Body = z.object({ documentId: z.uuid(), locale: z.enum(["en", "fr", "zh"]) });

/**
 * Streams an analysis as NDJSON:
 *   {"type":"partial","data":{...}}   unverified, for progressive rendering
 *   {"type":"final","data":{...},"dropped":n}   verified and saved
 *   {"type":"error","error":"quota_exceeded" | ...}
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ type: "error", error: "invalid_input" }, { status: 400 });

  const c = await container();
  const user = await c.currentUser();
  if (!user) return Response.json({ type: "error", error: "unauthenticated" }, { status: 401 });

  const outcome = await c.analyzeDocument({ userId: user.id, ...body.data });
  const encoder = new TextEncoder();
  const line = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);

  if (!outcome.ok) {
    const status = httpStatus(outcome.error.kind);
    return new Response(line({ type: "error", error: outcome.error.kind }), {
      status,
      headers: ndjsonHeaders,
    });
  }

  if (outcome.value.kind === "cached") {
    const { analysis, dropped } = outcome.value.result;
    return new Response(line({ type: "final", data: analysis, dropped }), { headers: ndjsonHeaders });
  }

  const { partials, done } = outcome.value;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let last = 0;
      try {
        for await (const partial of partials) {
          const now = Date.now();
          if (now - last < 60) continue; // throttle: ~16 updates per second is plenty
          last = now;
          controller.enqueue(line({ type: "partial", data: partial }));
        }
      } catch {
        log("analysis.stream_interrupted", { documentId: body.data.documentId });
      }
      const result = await done;
      controller.enqueue(
        result.ok
          ? line({ type: "final", data: result.value.analysis, dropped: result.value.dropped })
          : line({ type: "error", error: result.error.kind }),
      );
      controller.close();
    },
  });
  return new Response(stream, { headers: ndjsonHeaders });
}

function httpStatus(kind: AppError["kind"]): number {
  switch (kind) {
    case "quota_exceeded":
      return 429;
    case "not_found":
      return 404;
    case "unauthenticated":
      return 401;
    default:
      return 500;
  }
}

const ndjsonHeaders = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };
