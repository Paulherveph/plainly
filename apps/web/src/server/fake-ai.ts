import "server-only";
import type { AiCall, AiMessage } from "@/modules/ai/application/ports";
import type { FakeReply } from "@/modules/ai/infrastructure/fake-ai-gateway";
import { LOCALES, type OutputLocale } from "@/modules/analysis/domain/analysis";
import { draftFor, fakeAnalysisPartials } from "@/modules/analysis/infrastructure/fake-analyzer";
import { FIXTURES } from "@/modules/analysis/infrastructure/fake-fixtures";
import { LANGUAGE_NAMES } from "@/modules/analysis/infrastructure/prompts";
import { fakeChatDraft, fakeChatPartials } from "@/modules/chat/infrastructure/fake-answerer";

/** Deterministic replies for the fake gateway, built from the call's own messages. */
export function fakeResponder(call: AiCall): FakeReply {
  const text = allText(call.messages);
  switch (call.task) {
    case "classify":
      return {
        value: { official: !/\b(recipe|once upon a time|ingredients)\b/i.test(text), language: "other" },
      };
    case "transcribe": {
      const pages = (text.match(/pages: ([\d, ]+)/)?.[1] ?? "1").split(",").map((n) => Number(n.trim()));
      return {
        value: {
          pages: pages.map((page) => ({ page, text: "(transcription is not available with the fake AI)" })),
        },
      };
    }
    case "translate": {
      // A sample's summary comes back in the target language; any other text is returned as is.
      const value = JSON.parse(text.slice(text.indexOf("{"))) as { summary: string };
      const to = LOCALES.find((l) => text.includes(`Translate into ${LANGUAGE_NAMES[l]}:`));
      const fixture = FIXTURES.find((f) => Object.values(f.summary).includes(value.summary));
      if (to && fixture) value.summary = fixture.summary[to];
      return { value };
    }
    case "summarize_history":
      return { value: "Earlier questions about this document." };
    case "chat": {
      const question = text.match(/<question>\n([\s\S]*?)\n<\/question>/)?.[1] ?? "";
      const draft = fakeChatDraft(pagesOf(text), question);
      return { value: draft, partials: fakeChatPartials(draft) };
    }
    default: {
      const locale = (LOCALES.find((l) => text.includes(LOCALE_NAMES[l])) ?? "en") as OutputLocale;
      const draft = draftFor(pagesOf(text), locale);
      return { value: draft, partials: fakeAnalysisPartials(draft) };
    }
  }
}

const LOCALE_NAMES: Record<OutputLocale, string> = {
  en: "in English",
  fr: "in French",
  zh: "in Simplified Chinese",
};

function allText(messages: AiMessage[]): string {
  return messages
    .flatMap((m) =>
      typeof m.content === "string" ? [m.content] : m.content.map((p) => (p.type === "text" ? p.text : "")),
    )
    .join("\n");
}

function pagesOf(text: string): string[] {
  const pages: string[] = [];
  for (const m of text.matchAll(/<page number="(\d+)">\n([\s\S]*?)\n<\/page>/g))
    pages[Number(m[1]) - 1] = m[2] ?? "";
  return Array.from(pages, (p) => p ?? "");
}
