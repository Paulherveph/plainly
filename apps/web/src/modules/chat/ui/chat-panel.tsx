"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { cn } from "cn";
import { MessageCircleIcon, RefreshCwIcon, SendIcon, SparklesIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Cite, OutputLocale } from "@/modules/analysis/domain/analysis";
import { CitationChip } from "@/modules/analysis/ui/citation-chip";
import { PaywallDialog, type PaywallReason } from "@/modules/billing/ui/paywall-dialog";
import { Button } from "@/shared/ui/button";
import { MAX_QUESTION_CHARS } from "../domain/grounding";
import type { ChatUIMessage, CitationsData } from "./chat-message";

export function ChatPanel({
  documentId,
  locale,
  initialMessages,
  onCite,
}: {
  documentId: string;
  locale: OutputLocale;
  initialMessages: ChatUIMessage[];
  onCite: (cite: Cite) => void;
}) {
  const t = useTranslations("Chat");
  const tq = useTranslations("Billing");
  const [input, setInput] = useState("");
  const [deep, setDeep] = useState(false);
  const deepRef = useRef(false);
  deepRef.current = deep;
  const listRef = useRef<HTMLDivElement>(null);
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        // Only the latest turn goes up: history is read from the database (never from the client).
        prepareSendMessagesRequest: ({ messages: all, trigger }) => ({
          body: { documentId, locale, trigger, deep: deepRef.current, messages: all.slice(-2) },
        }),
      }),
  );
  const { messages, sendMessage, status, stop, regenerate, error } = useChat<ChatUIMessage>({
    id: documentId,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const paywall: PaywallReason | null = error?.message.includes("feature_not_in_plan")
    ? { kind: "feature_not_in_plan", feature: "deep_chat" }
    : error?.message.includes("insufficient_credits")
      ? { kind: "insufficient_credits", needed: deep ? 3 : 1 }
      : null;
  const quotaHit = paywall !== null;
  const [paywallOpen, setPaywallOpen] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: open once per new paywall reason
  useEffect(() => {
    if (paywall) setPaywallOpen(true);
  }, [paywall?.kind]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keep the latest message in view while it streams
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    void sendMessage({ text: q });
    setInput("");
  }

  const last = messages.at(-1);
  const stopped = !busy && last?.role === "assistant" && !citationsOf(last);

  return (
    <>
      <section
        aria-labelledby="chat-title"
        className="overflow-hidden rounded-xl border bg-surface"
        data-testid="chat"
      >
        <div className="px-5.5 pt-4.5 pb-1.5">
          <h2 id="chat-title" className="flex items-center gap-2.5 font-semibold text-base tracking-tight">
            <MessageCircleIcon className="size-4.5 text-brand-text" aria-hidden="true" />
            {t("title")}
          </h2>
          <p className="mt-1 text-muted-foreground text-[13px]">{t("sub")}</p>
        </div>

        {messages.length > 0 ? (
          <div
            ref={listRef}
            className="grid max-h-[420px] gap-3.5 overflow-auto px-5.5 py-3"
            aria-live="polite"
          >
            {messages.map((m, i) => (
              <Message
                key={m.id}
                message={m}
                streaming={busy && i === messages.length - 1}
                onCite={onCite}
                thinking={t("thinking")}
                refusal={t("refusal")}
              />
            ))}
            {status === "submitted" ? (
              <span className="text-muted-foreground text-sm">{t("thinking")}</span>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-5.5 pt-1 pb-4">
            {(["suggest1", "suggest2", "suggest3"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => ask(t(k))}
                className="h-8 rounded-full border border-line-strong bg-background px-3 text-[13px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
              >
                {t(k)}
              </button>
            ))}
          </div>
        )}

        {error || stopped ? (
          <div
            role={error ? "alert" : undefined}
            className="flex items-center gap-2 px-5.5 pb-4 text-muted-foreground text-xs"
          >
            <span>{noticeText({ quotaHit, failed: Boolean(error), t, tq })}</span>
            {!quotaHit ? (
              <Button variant="ghost" size="sm" onClick={() => regenerate()}>
                <RefreshCwIcon />
                {t("retry")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="sticky bottom-3 z-30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 rounded-2xl border border-line-strong bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] py-2 pr-2 pl-4 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.6)] backdrop-blur-xl focus-within:border-brand/60 focus-within:shadow-[0_0_0_4px_var(--brand-soft)]"
        >
          <label htmlFor="chat-input" className="sr-only">
            {t("placeholder")}
          </label>
          <input
            id="chat-input"
            autoComplete="off"
            value={input}
            maxLength={MAX_QUESTION_CHARS}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            aria-pressed={deep}
            onClick={() => setDeep((d) => !d)}
            title={t("deepHint")}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-foreground"
          >
            <SparklesIcon className="size-3.5" aria-hidden="true" />
            {t("deep")}
          </button>
          {busy ? (
            <Button
              type="button"
              size="icon"
              onClick={() => stop()}
              aria-label={t("stop")}
              className="rounded-xl bg-primary text-primary-foreground hover:text-primary-foreground"
            >
              <SquareIcon className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label={t("send")}
              className="rounded-xl bg-primary text-primary-foreground hover:text-primary-foreground"
            >
              <SendIcon />
            </Button>
          )}
        </form>
      </div>
      {paywall ? <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} reason={paywall} /> : null}
    </>
  );
}

function noticeText({
  quotaHit,
  failed,
  t,
  tq,
}: {
  quotaHit: boolean;
  failed: boolean;
  t: (key: "error" | "stopped") => string;
  tq: (key: "chatPaywall") => string;
}): string {
  if (quotaHit) return tq("chatPaywall");
  if (failed) return t("error");
  return t("stopped");
}

function citationsOf(message: ChatUIMessage): CitationsData | null {
  for (const part of message.parts) if (part.type === "data-citations") return part.data;
  return null;
}

function textOf(message: ChatUIMessage): string {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function Message({
  message,
  streaming,
  onCite,
  thinking,
  refusal,
}: {
  message: ChatUIMessage;
  streaming: boolean;
  onCite: (cite: Cite) => void;
  thinking: string;
  refusal: string;
}) {
  const text = textOf(message);
  if (message.role === "user") {
    return (
      <div className="max-w-[92%] justify-self-end rounded-[14px_14px_4px_14px] border bg-surface-2 px-3.5 py-2.5 text-[15px]">
        {text}
      </div>
    );
  }
  const meta = citationsOf(message);
  if (meta?.refused) {
    return (
      <p
        className="max-w-[92%] justify-self-start text-[15px] text-muted-foreground italic"
        data-testid="chat-refusal"
      >
        {refusal}
      </p>
    );
  }
  return (
    <div className="max-w-[92%] justify-self-start text-[15px] leading-relaxed" data-testid="chat-answer">
      <p className={cn(!text && "text-muted-foreground")}>
        {text || thinking}
        {streaming ? (
          <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-brand align-[-2px]" />
        ) : null}
      </p>
      {meta && meta.citations.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.citations.map((c) => (
            <CitationChip key={`${c.page}-${c.quote}`} cite={c} onOpen={onCite} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
