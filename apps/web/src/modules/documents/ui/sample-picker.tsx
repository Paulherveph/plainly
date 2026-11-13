"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createSampleAction } from "@/server/actions/documents";
import { useRouter } from "@/shared/i18n/navigation";
import type { SampleId } from "../application/ports";

const SAMPLES: { id: SampleId; title: "sampleLease" | "sampleVisa" | "sampleOffer"; pages: number }[] = [
  { id: "lease", title: "sampleLease", pages: 3 },
  { id: "visa", title: "sampleVisa", pages: 2 },
  { id: "offer", title: "sampleOffer", pages: 2 },
];

export function SamplePicker() {
  const t = useTranslations("Documents");
  const router = useRouter();
  // `pending` ends when the navigation completes, so a restored page is never stuck "busy".
  const [picked, setPicked] = useState<SampleId | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = pending ? picked : null;

  function open(id: SampleId) {
    setPicked(id);
    startTransition(async () => {
      const res = await createSampleAction(id);
      if (res.ok) router.push(`/documents/${res.value.id}`);
      else {
        toast.error(t("errorGeneric"));
      }
    });
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {SAMPLES.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => open(s.id)}
          disabled={busy !== null}
          data-testid={`sample-${s.id}`}
          className="group flex items-start gap-3.5 rounded-xl border bg-surface p-4.5 text-left transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-brand/40 hover:bg-surface-2 disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className="grid h-14 w-11 shrink-0 content-start gap-[3px] rounded-md bg-paper px-1.5 py-2 shadow-[0_6px_20px_-8px_rgb(0_0_0/0.6)]"
          >
            <i className="h-[3px] w-[70%] rounded-sm bg-[#9c9ca8]" />
            <i className="h-[3px] rounded-sm bg-[#cfcfd6]" />
            <i className="h-[3px] rounded-sm bg-[#cfcfd6]" />
            <i className="h-[3px] w-4/5 rounded-sm bg-[#cfcfd6]" />
            <i className="h-[3px] rounded-sm bg-[#cfcfd6]" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold text-[15px] tracking-tight">
              {t(s.title)}
              {busy === s.id ? <Loader2Icon className="size-3.5 animate-spin text-brand-text" /> : null}
            </span>
            <span className="mt-1 block text-muted-foreground text-[13px]">{t(`${s.title}Body`)}</span>
            <span className="mt-2.5 inline-flex h-6 items-center rounded-full border bg-surface-2 px-2.5 font-mono text-[11px] text-muted-foreground">
              PDF · {t("pages", { count: s.pages })}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
