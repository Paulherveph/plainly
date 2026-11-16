import { describe, expect, it, vi } from "vitest";
import type { AiCall, AiPart } from "@/modules/ai/application/ports";
import { FakeAiGateway } from "@/modules/ai/infrastructure/fake-ai-gateway";
import type { AnalysisRepository, CreditPort } from "@/modules/analysis/application/ports";
import type { DocumentRepository } from "@/modules/documents/application/ports";
import type { Document } from "@/modules/documents/domain/document";
import { ok } from "@/shared/lib/result";
import { fakeChatDraft } from "../infrastructure/fake-answerer";
import { GatewayAnswerer } from "../infrastructure/gateway-answerer";
import { makeAnswerQuestion } from "./answer-question";
import type { MessageRepository, StoredMessage } from "./ports";

const PAGES = [
  "§2 Rent. The monthly rent is €850, payable on or before the 5th day of each month.",
  "§9 Pets. No animals may be kept in the premises without the prior written consent of the Landlord.",
];

const doc = (pages: string[], chatSummary: string | null = null): Document => ({
  id: "d1",
  userId: "u1",
  title: "Lease",
  kind: null,
  status: "ready",
  pageCount: pages.length,
  createdAt: "",
  expiresAt: "",
  mediaType: "application/pdf",
  storagePath: "p",
  sourceLang: "en",
  pages,
  visionPages: [],
  contentHash: null,
  sampleId: null,
  chatSummary,
});

function setup(
  opts: {
    pages?: string[];
    history?: StoredMessage[];
    previous?: StoredMessage | null;
    abort?: boolean;
  } = {},
) {
  const pages = opts.pages ?? PAGES;
  const gateway = new FakeAiGateway((call: AiCall) => {
    if (call.task === "summarize_history") return { value: "Earlier: rent questions." };
    const text = JSON.stringify(call.messages);
    const question = text.match(/<question>\\n(.*?)\\n<\/question>/)?.[1] ?? "";
    return { value: fakeChatDraft(pages, question) };
  });
  const appended: unknown[] = [];
  const messages: MessageRepository = {
    list: vi.fn(async () => ok(opts.history ?? [])),
    append: vi.fn(async (_u, _d, m) => {
      appended.push(m);
      return ok(null);
    }),
    findAnswer: vi.fn(async () => opts.previous ?? null),
  };
  const documents = {
    getOwned: vi.fn(async () => ok(doc(pages))),
    update: vi.fn(async () => ok(null)),
    searchPages: vi.fn(async () => ok([{ page: 2, text: pages[1] ?? "" }])),
  } as unknown as DocumentRepository;
  const analyses = { findAny: vi.fn(async () => ok(null)) } as unknown as AnalysisRepository;
  const credits: CreditPort = {
    reserve: vi.fn(async () => ok({ holdId: "h" })),
    settle: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  };
  const answer = makeAnswerQuestion({
    documents,
    analyses,
    messages,
    answerer: new GatewayAnswerer(gateway),
    credits,
    admission: { admit: async () => ok({ degraded: false }) },
    canUseDeepChat: async () => ok(null),
    creditsFor: (deep) => (deep ? 3 : 1),
    hash: async (s) => s,
  });
  const controller = new AbortController();
  if (opts.abort) controller.abort();
  const ask = async (question: string) => {
    const res = await answer({
      userId: "u1",
      documentId: "d1",
      question,
      locale: "en",
      requestId: "r",
      signal: controller.signal,
    });
    if (!res.ok || res.value.kind === "stored") return res;
    for await (const _ of res.value.partials) {
      // drain
    }
    return res.value.done;
  };
  return { ask, gateway, credits, messages, documents, appended };
}

const turn = (i: number): StoredMessage => ({
  id: String(i),
  role: i % 2 ? "assistant" : "user",
  text: `turn ${i}`,
  citations: [],
  refused: false,
  createdAt: "",
});

describe("answerQuestion", () => {
  it("C01/C07: answers with a verified quote; the whole document is a cached prefix", async () => {
    const s = setup();
    const res = await s.ask("What is the monthly rent?");
    expect(res.ok && "kind" in res.value && res.value.kind).toBe("answer");
    const first = s.gateway.calls[0]?.messages[0]?.content as AiPart[];
    expect(first[0]?.cache).toBe(true);
    expect(s.credits.settle).toHaveBeenCalledWith("h", 1);
  });

  it("C02: not in the document becomes a refusal", async () => {
    const res = await setup().ask("Who won the football match?");
    expect(res.ok && "kind" in res.value && res.value.kind).toBe("refusal");
  });

  it("C09: the same question returns the stored answer for 0 credits", async () => {
    const s = setup({ previous: { ...turn(1), text: "Stored.", citations: [{ page: 1, quote: "q" }] } });
    const res = await s.ask("What is the monthly rent?");
    expect(res.ok && "kind" in res.value && res.value.kind).toBe("stored");
    expect(s.gateway.calls).toHaveLength(0);
    expect(s.credits.reserve).not.toHaveBeenCalled();
  });

  it("C08: above 10 turns, older turns become a rolling summary", async () => {
    const s = setup({ history: Array.from({ length: 14 }, (_, i) => turn(i)) });
    await s.ask("What is the monthly rent?");
    expect(s.gateway.calls.map((c) => c.task)).toEqual(["summarize_history", "chat"]);
    const chat = s.gateway.calls[1];
    const sentTurns = (chat?.messages ?? []).filter(
      (m) => typeof m.content === "string" && m.content.startsWith("turn"),
    );
    expect(sentTurns).toHaveLength(6);
  });

  it("C11: a stopped answer is aborted and free", async () => {
    const s = setup({ abort: true });
    const res = await s.ask("What is the monthly rent?");
    expect(res).toEqual({ ok: false, error: { kind: "aborted" } });
    expect(s.credits.release).toHaveBeenCalledWith("h");
    expect(s.credits.settle).not.toHaveBeenCalled();
  });

  it("C14: long documents send the summary plus matching pages, not everything", async () => {
    const long = [PAGES[0] as string, `${PAGES[1]} ${"filler text ".repeat(3_000)}`];
    const s = setup({ pages: long });
    await s.ask("Can I keep a pet?");
    expect(s.documents.searchPages).toHaveBeenCalled();
    const first = s.gateway.calls[0]?.messages[0]?.content as AiPart[];
    expect(first[0]?.type === "text" && first[0].text).toContain("<document_excerpts>");
  });
});
