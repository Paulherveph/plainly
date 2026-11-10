"use client";

import { PlayIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";
import { LoopVideo, type LoopVideoHandle } from "./loop-video";

/** Hero button that opens the 30-second explainer (V3) with native controls. */
export function ExplainerButton() {
  const t = useTranslations("Video");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-4 text-muted-foreground" data-testid="explainer-open">
          <PlayIcon className="size-3.5" />
          {t("explainerCta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-3 p-2 sm:max-w-4xl">
        <DialogTitle className="sr-only">{t("explainerTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("explainerLabel")}</DialogDescription>
        <video
          className="aspect-video w-full rounded-lg bg-black"
          poster="/videos/explainer.webp"
          controls
          autoPlay
          muted
          playsInline
          aria-label={t("explainerLabel")}
        >
          <source src="/videos/explainer.webm" type="video/webm" />
          <source src="/videos/explainer.mp4" type="video/mp4" />
        </video>
      </DialogContent>
    </Dialog>
  );
}

type Step = { n: string; title: string; body: string; icon: React.ReactNode };

/** How it works: the step video (V2) plays its three 4-second chapters; the cards follow it and jump it. */
export function HowSteps({ steps }: { steps: Step[] }) {
  const t = useTranslations("Video");
  const player = useRef<LoopVideoHandle>(null);
  const [active, setActive] = useState(0);
  return (
    <div className="grid gap-6">
      <figure className="reveal overflow-hidden rounded-[20px] border border-line-strong bg-background shadow-[0_0_80px_-20px_var(--brand-glow),0_40px_100px_-40px_rgb(0_0_0/0.7)]">
        <LoopVideo
          ref={player}
          name="steps"
          label={t("howLabel")}
          controls
          onTime={(s) => setActive(Math.min(2, Math.floor(s / 4)))}
        />
      </figure>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.n} className="reveal">
            <button
              type="button"
              aria-pressed={active === i}
              onClick={() => {
                setActive(i);
                player.current?.seek(i * 4);
              }}
              className="glass relative h-full w-full overflow-hidden rounded-2xl p-7 text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 aria-pressed:border-brand/45 aria-pressed:shadow-[0_0_40px_-12px_var(--brand-glow)]"
            >
              <span className="font-mono text-[13px] text-brand-text">{s.n}</span>
              <div className="mt-4.5 grid size-11 place-items-center rounded-xl border border-brand/25 bg-brand-soft text-brand-text [&_svg]:size-4.5">
                {s.icon}
              </div>
              <h3 className="mt-4.5 font-semibold text-xl">{s.title}</h3>
              <p className="mt-2 text-[15px] text-muted-foreground">{s.body}</p>
              <span
                aria-hidden="true"
                className="absolute inset-x-7 bottom-0 h-0.5 origin-left scale-x-0 rounded-full bg-brand transition-transform duration-200 [[aria-pressed=true]_&]:scale-x-100"
              />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
