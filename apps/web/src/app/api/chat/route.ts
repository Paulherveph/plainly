import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import type { ChatUIMessage } from "@/modules/chat/ui/chat-message";
import { container } from "@/server/container";
import { httpStatus, readJson } from "@/shared/lib/http";
import { log } from "@/shared/lib/log";

export const maxDuration = 90;

const Body = z.object({
  documentId: z.uuid(),
  locale: z.enum(["en", "fr", "zh"]),
  deep: z.boolean().optional(),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Grounded chat. Only the latest user question is taken from the client; history is read
 * from the database. The document is data inside delimiters; the model has no tools.
 * Stopping the stream aborts the provider request (C11) and the answer is free.
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await readJson(request, 300_000));
  if (!body.success) return Response.json({ error: "invalid_input" }, { status: 400 });

  const lastUser = body.data.messages.findLast((m) => m.role === "user");
  const question = lastUser?.parts.find((p) => p.type === "text")?.text ?? "";

  const c = await container();
  const user = await c.currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const outcome = await c.answerQuestion({
    userId: user.id,
    documentId: body.data.documentId,
    question,
    locale: body.data.locale,
    requestId: crypto.randomUUID(),
    deep: body.data.deep,
    retry: body.data.trigger === "regenerate-message",
    signal: request.signal,
  });
  if (!outcome.ok) return Response.json({ error: outcome.error.kind }, { status: httpStatus(outcome.error.kind) });

  const value = outcome.value;
  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      const id = crypto.randomUUID();
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id });

      if (value.kind === "stored") {
        // C09: same question as before, answered from storage for 0 credits.
        if (value.answer.kind === "answer") writer.write({ type: "text-delta", id, delta: value.answer.text });
        writer.write({ type: "text-end", id });
        writer.write({
          type: "data-citations",
          data:
            value.answer.kind === "answer"
              ? { citations: value.answer.citations, refused: false }
              : { citations: [], refused: true },
        });
        writer.write({ type: "finish" });
        return;
      }

      let sent = "";
      try {
        for await (const partial of value.partials) {
          const text = partial.found === false ? "" : (partial.answer ?? "");
          if (text.length > sent.length && text.startsWith(sent)) {
            writer.write({ type: "text-delta", id, delta: text.slice(sent.length) });
            sent = text;
          }
        }
      } catch {
        log("chat.stream_interrupted", { documentId: body.data.documentId });
      }
      writer.write({ type: "text-end", id });
      const result = await value.done;
      if (!result.ok) throw new Error(result.error.kind);
      writer.write({
        type: "data-citations",
        data:
          result.value.kind === "answer"
            ? { citations: result.value.citations, refused: false }
            : { citations: [], refused: true },
      });
      writer.write({ type: "finish" });
    },
    // Only the error kind reaches the browser, never internal details.
    onError: (error) => (error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "error"),
  });
  return createUIMessageStreamResponse({ stream });
}
