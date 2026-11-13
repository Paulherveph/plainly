import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import type { ChatUIMessage } from "@/modules/chat/ui/chat-message";
import { container } from "@/server/container";
import { log } from "@/shared/lib/log";

export const maxDuration = 60;

const Body = z.object({
  documentId: z.uuid(),
  locale: z.enum(["en", "fr", "zh"]),
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
 */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
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
    retry: body.data.trigger === "regenerate-message",
  });
  if (!outcome.ok) {
    const status = outcome.error.kind === "quota_exceeded" ? 429 : 400;
    return Response.json({ error: outcome.error.kind }, { status });
  }

  const { partials, done } = outcome.value;
  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      const id = crypto.randomUUID();
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id });
      let sent = "";
      try {
        for await (const partial of partials) {
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
      const result = await done;
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
    // Never send internal error details to the browser.
    onError: () => "error",
  });
  return createUIMessageStreamResponse({ stream });
}
