"use client";

import { cn } from "cn";
import { ClipboardIcon, OctagonAlertIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useGuestGate } from "@/shared/ui/guest-gate";
import { uploadFileAction, uploadTextAction } from "@/server/actions/documents";
import { useRouter } from "@/shared/i18n/navigation";
import type { AppError } from "@/shared/lib/errors";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { useHydrated } from "@/shared/ui/use-hydrated";
import { MAX_FILE_BYTES, MAX_PASTE_CHARS, MIN_PASTE_CHARS, UPLOAD_MEDIA_TYPES } from "../domain/document";
import { useErrorMessage } from "./use-error-message";

export function DocumentInput() {
  const t = useTranslations("Documents");
  return (
    <Tabs defaultValue="upload">
      <TabsList aria-label={t("inputMethod")}>
        <TabsTrigger value="upload">
          <UploadIcon />
          {t("tabUpload")}
        </TabsTrigger>
        <TabsTrigger value="paste">
          <ClipboardIcon />
          {t("tabPaste")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="upload">
        <DropZone />
      </TabsContent>
      <TabsContent value="paste">
        <PasteForm />
      </TabsContent>
    </Tabs>
  );
}

function DropZone() {
  const t = useTranslations("Documents");
  const router = useRouter();
  const { ensure } = useGuestGate();
  const toMessage = useErrorMessage();
  const inputId = useId();
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The input is in the server HTML. Until React attaches onChange, a chosen file would be lost.
  const hydrated = useHydrated();
  const uploading = pending ? fileName : null;

  function submit(file: File) {
    setError(null);
    // Same checks as the server, for instant feedback. The server re-validates.
    if (!(UPLOAD_MEDIA_TYPES as readonly string[]).includes(file.type))
      return setError(t("errorUnsupported"));
    if (file.size > MAX_FILE_BYTES) return setError(t("errorTooLarge"));
    if (file.size === 0) return setError(t("errorEmpty"));
    setFileName(file.name);
    const data = new FormData();
    data.set("file", file);
    startTransition(async () => {
      if (!(await ensure())) return;
      const res = await uploadFileAction(data);
      if (res.ok) router.push(`/documents/${res.value.id}`);
      else {
        setError(toMessage(res.error));
      }
    });
  }

  // Paste a file (e.g. a screenshot) anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = e.clipboardData?.files[0];
      if (file) submit(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target; the file input inside is the accessible control
    <div
      ref={zoneRef}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) submit(file);
      }}
      className={cn(
        "relative mt-4 rounded-2xl border-[1.5px] border-line-strong border-dashed bg-surface px-6 py-12 text-center transition-[border-color,transform] duration-150",
        "bg-[radial-gradient(60%_80%_at_50%_0%,var(--brand-soft),transparent_70%)]",
        dragging && "scale-[1.005] border-brand",
      )}
    >
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-brand-text shadow-[0_0_40px_-6px_var(--brand-glow)]">
        <UploadIcon className="size-5.5" />
      </div>
      <h2 className="font-semibold text-xl">{t("dropTitle")}</h2>
      <p className="mt-1.5 text-muted-foreground text-sm">{t("dropSub")}</p>

      {uploading ? (
        <div className="mx-auto mt-6 max-w-sm text-left" aria-live="polite">
          <p className="mb-2 truncate text-sm">{t("uploading", { name: uploading })}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-[linear-gradient(90deg,transparent,var(--brand),transparent)] bg-size-[200%_100%]" />
          </div>
          <p className="mt-2 text-muted-foreground text-xs">{t("reading")}</p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button asChild>
            <label htmlFor={inputId}>{t("dropChoose")}</label>
          </Button>
          <input
            id={inputId}
            type="file"
            className="sr-only"
            disabled={!hydrated}
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) submit(file);
              e.target.value = "";
            }}
          />
          <p className="text-faint text-xs">{t("dropPasteHint")}</p>
        </div>
      )}
      {error ? <ErrorAlert message={error} /> : null}
    </div>
  );
}

function PasteForm() {
  const t = useTranslations("Documents");
  const router = useRouter();
  const { ensure } = useGuestGate();
  const toMessage = useErrorMessage();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tooShort = text.trim().length < MIN_PASTE_CHARS;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (!(await ensure())) return;
      const res = await uploadTextAction({ text, title });
      if (res.ok) router.push(`/documents/${res.value.id}`);
      else setError(toMessage(res.error as AppError));
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="paste-title" className="text-muted-foreground text-sm">
          {t("pasteTitleLabel")}
        </label>
        <Input
          id="paste-title"
          value={title}
          maxLength={120}
          placeholder={t("pasteTitlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11"
        />
      </div>
      <label htmlFor="paste-text" className="sr-only">
        {t("pasteLabel")}
      </label>
      <Textarea
        id="paste-text"
        value={text}
        maxLength={MAX_PASTE_CHARS}
        placeholder={t("pastePlaceholder")}
        onChange={(e) => setText(e.target.value)}
        className="min-h-56 text-[15px] leading-relaxed"
      />
      {error ? <ErrorAlert message={error} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-faint text-xs tabular-nums">
          {t("pasteCount", { count: text.length.toLocaleString(), max: MAX_PASTE_CHARS.toLocaleString() })}
        </span>
        <Button type="submit" disabled={tooShort || pending}>
          {t("pasteSubmit")}
        </Button>
      </div>
    </form>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mx-auto mt-4 flex max-w-lg items-start gap-2.5 rounded-lg border border-critical/30 bg-critical-soft px-3.5 py-3 text-left text-critical text-sm"
    >
      <OctagonAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
