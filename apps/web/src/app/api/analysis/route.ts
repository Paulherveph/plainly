import { after } from "next/server";
import { z } from "zod";
import { container } from "@/server/container";
import { errorDetail, httpStatus, readJson } from "@/shared/lib/http";
import { log } from "@/shared/lib/log";

export const maxDuration = 300;

const Body = z.object({
  documentId: z.uuid(),
  locale: z.enum(["en", "fr", "zh"]),
  mode: z.enum(["auto", "general"]).optional(),
  force: z.boolean().optional(),
});

/**
 * Streams an analysis as NDJSON:
 *   {"type":"start","credits":n}                  credits reserved for this run
 *   {"type":"partial","data":{...}}               unverified, for progressive rendering
 *   {"type":"final","data":{...},"dropped":n,"reason"?:"duplicate"|"sample"|"translated"}
 *   {"type":"notice","notice":"not_official"|"running"}
 *   {"type":"error","error":"insufficient_credits"|...,"detail":{...}}
 * Closing the tab does not stop the job (B14): it finishes server side and is stored.
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await readJson(request, 2_000));
  if (!body.success) return Response.json({ type: "error", error: "invalid_input" }, { status: 400 });

  const c = await container();
  const user = await c.currentUser();
  if (!user) return Response.json({ type: "error", error: "unauthenticated" }, { status: 401 });

  const requestId = crypto.randomUUID();
  const outcome = await c.analyzeDocument({ userId: user.id, requestId, ...body.data });
  const encoder = new TextEncoder();
  const line = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);

  if (!outcome.ok) {
    return new Response(
      line({ type: "error", error: outcome.error.kind, detail: errorDetail(outcome.error) }),
      {
        status: httpStatus(outcome.error.kind),
        headers: ndjsonHeaders,
      },
    );
  }

  const value = outcome.value;
  if (value.kind === "cached") {
    const { analysis, dropped } = value.result;
    const reason = value.reason === "stored" ? undefined : value.reason;
    return new Response(line({ type: "final", data: analysis, dropped, reason }), { headers: ndjsonHeaders });
  }
  if (value.kind === "running" || value.kind === "not_official") {
    return new Response(line({ type: "notice", notice: value.kind }), { headers: ndjsonHeaders });
  }

  const { partials, done, credits } = value;
  after(() => done.then(() => undefined));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(line(obj));
        } catch {
          // The reader went away; the job keeps running.
        }
      };
      send({ type: "start", credits });
      let last = 0;
      try {
        for await (const partial of partials) {
          const now = Date.now();
          if (now - last < 60) continue; // about 16 updates per second is plenty
          last = now;
          send({ type: "partial", data: partial });
        }
      } catch {
        log("analysis.stream_interrupted", { documentId: body.data.documentId });
      }
      const result = await done;
      send(
        result.ok
          ? { type: "final", data: result.value.analysis, dropped: result.value.dropped }
          : { type: "error", error: result.error.kind, detail: errorDetail(result.error) },
      );
      try {
        controller.close();
      } catch {
        // already closed by the client
      }
    },
  });
  return new Response(stream, { headers: ndjsonHeaders });
}

const ndjsonHeaders = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };
