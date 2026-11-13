"use client";

import { CheckIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type InstallTarget, installTarget } from "@/shared/lib/install-target";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";

/** Chromium's install prompt event (not in the DOM typings yet). */
type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type Kind = "desktop" | "mobile";

/**
 * Two install buttons. Where the browser offers a native install prompt (Chrome, Edge, Android)
 * the button opens it; everywhere else it shows the exact steps for that device.
 */
export function InstallButtons() {
  const t = useTranslations("Install");
  const locale = useLocale();
  const [target, setTarget] = useState<InstallTarget>("other");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState<Kind | null>(null);

  useEffect(() => {
    setTarget(installTarget(navigator.userAgent, { touchPoints: navigator.maxTouchPoints }));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setUrl(`${window.location.origin}/${locale}`);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      toast.success(t("done"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [locale, t]);

  const onMobile = target === "ios" || target === "android";

  async function install(kind: Kind) {
    const native = kind === "desktop" ? !onMobile : target === "android";
    if (prompt && native) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      return;
    }
    setOpen(kind);
  }

  const cards = [
    {
      kind: "desktop" as const,
      icon: <MonitorIcon />,
      title: t("desktopTitle"),
      body: t("desktopBody"),
      cta: t("desktopCta"),
    },
    {
      kind: "mobile" as const,
      icon: <SmartphoneIcon />,
      title: t("mobileTitle"),
      body: t("mobileBody"),
      cta: t("mobileCta"),
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.kind} className="glass flex flex-col rounded-2xl p-5">
            <div className="grid size-10 place-items-center rounded-xl border border-brand/25 bg-brand-soft text-brand-text [&_svg]:size-4.5">
              {c.icon}
            </div>
            <h3 className="mt-4 font-semibold text-lg">{c.title}</h3>
            <p className="mt-1 mb-5 text-muted-foreground text-sm">{c.body}</p>
            <Button
              className="mt-auto"
              variant={c.kind === "desktop" ? "default" : "outline"}
              disabled={installed}
              onClick={() => install(c.kind)}
              data-testid={`install-${c.kind}`}
            >
              {installed ? <CheckIcon /> : null}
              {installed ? t("installed") : c.cta}
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{t("stepsTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {open === "mobile" ? t("mobileBody") : t("desktopBody")}
            </DialogDescription>
          </DialogHeader>
          {open === "desktop" && onMobile ? <Address label={t("onComputer")} url={url} /> : null}
          {open === "desktop" && !onMobile ? (
            <Steps
              title={t("stepsDesktop")}
              items={
                target === "desktop-chromium"
                  ? [t("chromium1"), t("chromium2")]
                  : target === "desktop-safari"
                    ? [t("safari1")]
                    : [t("firefox1")]
              }
            />
          ) : null}
          {open === "mobile" && !onMobile ? <Address label={t("onPhone")} url={url} /> : null}
          {open === "mobile" && target !== "android" ? (
            <Steps title={t("stepsIos")} items={[t("ios1"), t("ios2")]} />
          ) : null}
          {open === "mobile" && target !== "ios" ? (
            <Steps title={t("stepsAndroid")} items={[t("android1"), t("android2")]} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Steps({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-2.5 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.06em]">
        {title}
      </h3>
      <ol className="grid gap-2.5">
        {items.map((s, i) => (
          <li key={s} className="grid grid-cols-[auto_1fr] items-start gap-3 text-[15px]">
            <span className="grid size-6 place-items-center rounded-full bg-brand-soft font-mono text-brand-text text-xs">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Address({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-2 select-all rounded-lg border bg-surface-2 px-3 py-2 font-mono text-sm">{url}</p>
    </div>
  );
}
