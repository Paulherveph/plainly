import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  CheckIcon,
  FileTextIcon,
  LockIcon,
  OctagonAlertIcon,
  PlusIcon,
  QuoteIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/shared/i18n/navigation";
import { buttonVariants } from "./button";
import { HeroOrb } from "./hero-orb";
import { InstallButtons } from "./install-app";
import { ExplainerButton, HowSteps } from "./landing-video";

/** Plain <a>: the sample route creates a document, so it must never be prefetched. */
function TrySampleLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const locale = useLocale();
  return (
    <a href={`/${locale}/documents/try?sample=lease`} className={className} data-testid="try-sample">
      {children}
    </a>
  );
}

export function Hero() {
  const t = useTranslations("Landing");
  return (
    <section
      className="hero-stage relative isolate overflow-hidden pt-14 md:pt-16"
      aria-labelledby="hero-title"
    >
      <div aria-hidden="true" className="-z-10 pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(148_120_255/0.2),transparent_70%),radial-gradient(40%_40%_at_15%_70%,rgb(60_80_200/0.12),transparent_70%),radial-gradient(40%_40%_at_85%_60%,rgb(148_120_255/0.1),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] bg-size-[64px_64px] opacity-40 [mask-image:radial-gradient(60%_55%_at_50%_30%,#000_20%,transparent_75%)]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-marketing flex-col items-center px-5 text-center md:px-8">
        <span className="eyebrow">
          <span className="eyebrow-dot" />
          {t("eyebrow")}
        </span>
        <h1
          id="hero-title"
          className="text-gradient mt-5.5 max-w-[16ch] text-balance font-semibold text-[clamp(2.75rem,1.4rem+4.6vw,5.5rem)] leading-[1.05] tracking-[-0.045em]"
        >
          {t("titleStart")} <span className="text-brand-gradient">{t("titleEnd")}</span>
        </h1>
        <p className="mt-5 max-w-[34em] text-[clamp(1rem,0.9rem+0.4vw,1.25rem)] text-muted-foreground">
          {t("sub")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <TrySampleLink className={buttonVariants({ size: "lg" })}>
            {t("ctaSample")}
            <ArrowRightIcon className="size-4" />
          </TrySampleLink>
          <Link
            prefetch={false}
            href="/documents"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <UploadIcon className="size-4" />
            {t("ctaUpload")}
          </Link>
        </div>
        <ul className="mt-5.5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
          {(["trustSignup", "trustDeleted", "trustLanguages"] as const).map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-3.5 text-ok" aria-hidden="true" />
              {t(k)}
            </li>
          ))}
        </ul>
        <ExplainerButton />
      </div>

      <div className="relative mx-auto mt-2 aspect-square w-(--orb)">
        <div
          aria-hidden="true"
          className="-translate-x-1/2 absolute top-0 left-1/2 h-[46%] w-0.5 bg-[linear-gradient(180deg,transparent,rgb(190_175_255/0.6)_45%,#fff)] shadow-[0_0_24px_6px_var(--brand-glow),0_0_120px_40px_rgb(148_120_255/0.18)]"
        />
        <HeroOrb />
      </div>

      <div className="reveal relative mx-auto -mt-[calc(var(--orb)*0.3)] max-w-marketing px-5 pb-10 md:px-8">
        <div className="[filter:blur(calc((1-var(--calm,1))*2px))] [opacity:calc(0.8+var(--calm,1)*0.2)]">
          <ProductPreview />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,transparent,var(--bg))]"
        />
      </div>
    </section>
  );
}

function ProductPreview() {
  const t = useTranslations("LandingDemo");
  const ta = useTranslations("Analysis");
  const tl = useTranslations("Landing");
  return (
    <figure
      aria-label={tl("previewLabel")}
      className="rounded-[20px] bg-[linear-gradient(180deg,rgb(190_175_255/0.35),rgb(148_120_255/0.06)_40%,transparent)] p-2 shadow-[0_0_80px_-10px_var(--brand-glow),0_40px_120px_-30px_rgb(0_0_0/0.8)]"
    >
      <div className="overflow-hidden rounded-[14px] border border-line-strong bg-background">
        <div className="flex items-center gap-2 border-b bg-surface px-4 py-3" aria-hidden="true">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <i key={i} className="size-2.5 rounded-full border border-line-strong bg-surface-2" />
            ))}
          </span>
          <span className="mx-auto rounded-full border bg-background px-3.5 py-1 font-mono text-muted-foreground text-xs">
            plainly.app/documents/lease
          </span>
          <span className="w-11" />
        </div>
        <div className="grid gap-4 p-5 md:p-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="grid min-w-0 gap-3">
            <div>
              <div className="font-semibold text-base tracking-tight">{t("docTitle")}</div>
              <div className="mt-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">
                <span className="rounded-full border bg-surface-2 px-2.5 py-0.5 text-xs">{t("kind")}</span>
                <span className="size-2 rounded-full bg-ok" />
                {ta("ready")}
              </div>
            </div>
            <MiniCard icon={<FileTextIcon />} title={ta("summary")}>
              <p className="text-[15px] leading-relaxed">{t("summary")}</p>
            </MiniCard>
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniCard icon={<CalendarIcon />} title={ta("actions")}>
                <MiniAction month="NOV" day="20" title={t("action1")} detail={t("action1Detail")} />
                <MiniAction month="DEC" day="01" title={t("action2")} detail={t("action2Detail")} />
              </MiniCard>
              <MiniCard icon={<TriangleAlertIcon />} title={ta("watchOuts")}>
                <MiniWatch tone="critical" title={t("watch1")} body={t("watch1Body")} />
                <MiniWatch tone="caution" title={t("watch2")} body={t("watch2Body")} />
              </MiniCard>
            </div>
          </div>
          <div className="hidden rounded-xl border bg-bg-deep p-4 lg:block" aria-hidden="true">
            <div className="rounded bg-paper px-5 py-5.5 text-[11px] text-paper-ink leading-[1.7]">
              <p className="font-semibold uppercase tracking-wide">Residential Lease Agreement</p>
              <p className="mt-2">
                This agreement is made between Marc Petit (the Landlord) and Amina Diallo (the Tenant) for the
                apartment at 14 Rue des Lilas, Apt 3B, 69003 Lyon.
              </p>
              <p className="mt-2">
                §1 Term. The lease begins on 1 December 2026 and runs for a period of twelve months.
              </p>
              <p className="mt-2">
                §2 Rent. The monthly rent is €850, payable on or before the 5th day of each month.
              </p>
              <p className="mt-2">
                §4 Deposit. The Tenant shall pay a{" "}
                <mark className="rounded-xs bg-brand/35 text-inherit">
                  security deposit of €1,700 no later than 20 November 2026
                </mark>
                .
              </p>
              <p className="mt-2">
                §5 Signature. The Tenant must sign and return this agreement by 5 November 2026.
              </p>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function MiniCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="mb-2.5 flex items-center gap-2 font-semibold text-[15px] [&_svg]:size-4 [&_svg]:text-brand-text">
        {icon}
        {title}
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function MiniAction({
  month,
  day,
  title,
  detail,
}: {
  month: string;
  day: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-[10px] border bg-background p-2.5">
      <div className="w-11 self-start overflow-hidden rounded-lg border border-line-strong bg-surface text-center">
        <div className="bg-brand-soft py-0.5 font-semibold text-[9px] text-brand-text tracking-widest">
          {month}
        </div>
        <div className="py-0.5 font-mono font-semibold text-base">{day}</div>
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-[13px]">{title}</div>
        <div className="text-muted-foreground text-xs">{detail}</div>
      </div>
    </div>
  );
}

function MiniWatch({ tone, title, body }: { tone: "critical" | "caution"; title: string; body: string }) {
  const Icon = tone === "critical" ? OctagonAlertIcon : TriangleAlertIcon;
  return (
    <div
      className={
        tone === "critical"
          ? "grid grid-cols-[auto_1fr] gap-2.5 rounded-[10px] border border-l-[3px] border-l-critical bg-[linear-gradient(90deg,var(--critical-soft),transparent_60%)] p-2.5"
          : "grid grid-cols-[auto_1fr] gap-2.5 rounded-[10px] border border-l-[3px] border-l-caution bg-[linear-gradient(90deg,var(--caution-soft),transparent_60%)] p-2.5"
      }
    >
      <Icon className={tone === "critical" ? "mt-0.5 size-4 text-critical" : "mt-0.5 size-4 text-caution"} />
      <div>
        <div className="font-semibold text-[13px]">{title}</div>
        <div className="text-muted-foreground text-xs">{body}</div>
      </div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  muted,
  id,
}: {
  eyebrow?: string;
  title: string;
  muted?: string;
  id: string;
}) {
  return (
    <div className="reveal mb-12 flex flex-col items-center text-center">
      {eyebrow ? (
        <span className="eyebrow mb-4.5">
          <span className="eyebrow-dot" />
          {eyebrow}
        </span>
      ) : null}
      <h2 id={id} className="font-semibold text-[28px] leading-[1.15] md:text-[40px] md:leading-[1.1]">
        {title}
        {muted ? (
          <>
            <br />
            <span className="text-muted-foreground">{muted}</span>
          </>
        ) : null}
      </h2>
    </div>
  );
}

export function HowItWorks() {
  const t = useTranslations("Landing");
  const steps = [
    { n: "01", icon: <UploadIcon />, title: t("how1Title"), body: t("how1Body") },
    { n: "02", icon: <BookOpenIcon />, title: t("how2Title"), body: t("how2Body") },
    { n: "03", icon: <CalendarIcon />, title: t("how3Title"), body: t("how3Body") },
  ];
  return (
    <section className="mx-auto max-w-marketing px-5 py-22 md:px-8 md:py-30" aria-labelledby="how-title">
      <SectionHead id="how-title" eyebrow={t("howEyebrow")} title={t("howTitle")} />
      <HowSteps steps={steps} />
      <Features />
    </section>
  );
}

export function Features() {
  const t = useTranslations("Landing");
  const d = useTranslations("LandingDemo");
  const tc = useTranslations("Chat");
  return (
    <div className="mt-20 md:mt-28">
      <h3
        id="feat-title"
        className="reveal mb-10 text-center font-semibold text-2xl leading-[1.15] md:text-[32px]"
      >
        {t("featTitle")} <span className="text-muted-foreground">{t("featTitleMuted")}</span>
      </h3>
      <div className="grid gap-4 lg:grid-cols-6">
        <Tile className="lg:col-span-4" title={t("featQuoteTitle")} body={t("featQuoteBody")}>
          <blockquote className="max-w-[520px] rounded-[10px] border border-l-[3px] border-l-brand bg-background p-4 font-mono text-[13.5px] leading-relaxed">
            “{d("quote")}”
          </blockquote>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-ok-soft px-2.5 font-medium text-ok text-xs">
              <CheckIcon className="size-3" aria-hidden="true" />
              {t("featQuoteVerified")}
            </span>
            <span className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2.5 font-mono text-muted-foreground text-xs">
              p.1 · §4
            </span>
          </div>
        </Tile>
        <Tile className="lg:col-span-2" title={t("featDeadlinesTitle")} body={t("featDeadlinesBody")}>
          <div className="grid gap-2">
            <MiniAction month="NOV" day="20" title={d("deadline1")} detail={d("deadline1Detail")} />
            <MiniAction month="DEC" day="01" title={d("deadline2")} detail={d("deadline2Detail")} />
          </div>
        </Tile>
        <Tile className="lg:col-span-3" title={t("featWatchTitle")} body={t("featWatchBody")}>
          <div className="grid gap-2">
            <MiniWatch tone="critical" title={d("watch1")} body={d("watch1Body")} />
            <MiniWatch tone="caution" title={d("watch2")} body={d("watch2Body")} />
          </div>
        </Tile>
        <Tile className="lg:col-span-3" title={t("featChatTitle")} body={t("featChatBody")}>
          <div className="grid gap-2.5 text-sm">
            <p className="max-w-[85%] justify-self-end rounded-[14px_14px_4px_14px] border bg-surface-2 px-3.5 py-2">
              {d("chatQ1")}
            </p>
            <p className="max-w-[90%]">
              {d("chatA1")}{" "}
              <span className="ml-1 inline-flex h-5.5 items-center gap-1 rounded-full border border-brand/25 bg-brand-soft px-2 align-middle text-brand-text text-xs">
                <QuoteIcon className="size-3" aria-hidden="true" />
                p.2
              </span>
            </p>
            <p className="max-w-[85%] justify-self-end rounded-[14px_14px_4px_14px] border bg-surface-2 px-3.5 py-2">
              {d("chatQ2")}
            </p>
            <p className="text-muted-foreground italic">{tc("refusal")}</p>
          </div>
        </Tile>
      </div>
    </div>
  );
}

function Tile({
  className,
  title,
  body,
  children,
}: {
  className?: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`glass reveal flex min-h-[260px] flex-col overflow-hidden rounded-2xl p-7 ${className ?? ""}`}
    >
      <h3 className="font-semibold text-xl">{title}</h3>
      <p className="mt-1.5 max-w-[420px] text-[15px] text-muted-foreground">{body}</p>
      <div className="mt-auto pt-6">{children}</div>
    </article>
  );
}

export function PrivacyBand() {
  const t = useTranslations("Landing");
  return (
    <section className="mx-auto max-w-marketing px-5 pb-22 md:px-8 md:pb-30" aria-labelledby="priv-title">
      <div className="glass reveal grid items-center gap-8 rounded-2xl p-9 lg:grid-cols-2 lg:p-14">
        <div>
          <span className="eyebrow">
            <LockIcon className="size-3.5" aria-hidden="true" />
            {t("privEyebrow")}
          </span>
          <h2
            id="priv-title"
            className="mt-4.5 font-semibold text-[28px] leading-[1.15] md:text-[40px] md:leading-[1.1]"
          >
            {t("privTitle")}
          </h2>
          <p className="mt-3 max-w-[560px] text-muted-foreground">{t("privBody")}</p>
          <Link href="/privacy" className={`${buttonVariants({ variant: "outline" })} mt-6`}>
            {t("privCta")}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <ul className="grid gap-3.5">
          {(["priv1", "priv2", "priv3", "priv4"] as const).map((k) => (
            <li key={k} className="flex items-start gap-3 text-[15px]">
              <CheckIcon className="mt-0.5 size-4.5 shrink-0 text-ok" aria-hidden="true" />
              {t(k)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Real limits only, passed in from the quota domain. A pricing link joins the header after Stage S4. */
export function PricingTeaser({ guestLimit, memberLimit }: { guestLimit: number; memberLimit: number }) {
  const t = useTranslations("Landing");
  const items = [
    { value: String(guestLimit), label: t("pricingGuest"), decorative: false },
    { value: String(memberLimit), label: t("pricingMember"), decorative: false },
    { value: "✓", label: t("pricingRead"), decorative: true },
  ];
  return (
    <section className="mx-auto max-w-marketing px-5 pb-22 md:px-8 md:pb-30" aria-labelledby="pricing-title">
      <SectionHead id="pricing-title" title={t("pricingTitle")} />
      <ul className="reveal mx-auto grid max-w-[900px] gap-4 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.label} className="glass rounded-2xl p-6 text-center">
            <div aria-hidden={i.decorative} className="font-semibold text-4xl text-brand-text tabular-nums">
              {i.value}
            </div>
            <p className="mt-2 text-[15px] text-muted-foreground">{i.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shown only when a real number exists. Never pass an invented one. */
export function SocialProof({ documentsExplained }: { documentsExplained?: number }) {
  const t = useTranslations("Landing");
  if (!documentsExplained || documentsExplained <= 0) return null;
  return (
    <p className="mx-auto max-w-marketing px-5 pb-10 text-center text-muted-foreground text-sm md:px-8">
      {t("proofCount", { count: documentsExplained })}
    </p>
  );
}

export function Faq() {
  const t = useTranslations("Landing");
  return (
    <section className="mx-auto max-w-marketing px-5 pb-22 md:px-8 md:pb-30" aria-labelledby="faq-title">
      <SectionHead id="faq-title" title={t("faqTitle")} />
      <div className="mx-auto max-w-[760px]">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <details key={n} className="reveal group border-b">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-1 py-5.5 font-medium text-[17px] [&::-webkit-details-marker]:hidden">
              {t(`faq${n}Q`)}
              <PlusIcon
                className="size-4.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                aria-hidden="true"
              />
            </summary>
            <p className="max-w-[640px] px-1 pb-5.5 text-muted-foreground">{t(`faq${n}A`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  const t = useTranslations("Landing");
  return (
    <section className="mx-auto max-w-marketing px-5 pb-10 md:px-8">
      <div className="glass reveal relative overflow-hidden rounded-2xl px-6 py-16 text-center">
        <div
          aria-hidden="true"
          className="-translate-x-1/2 absolute -top-30 left-1/2 h-75 w-150 bg-[radial-gradient(closest-side,rgb(148_120_255/0.3),transparent)]"
        />
        <h2 className="relative font-semibold text-[28px] leading-[1.15] md:text-[40px]">
          {t("finalTitle")}
        </h2>
        <p className="relative mx-auto mt-3 max-w-[560px] text-muted-foreground">{t("finalBody")}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <TrySampleLink className={buttonVariants({ size: "lg" })}>
            {t("ctaSample")}
            <ArrowRightIcon className="size-4" />
          </TrySampleLink>
          <Link
            prefetch={false}
            href="/documents"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t("ctaUpload")}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function InstallSection() {
  const t = useTranslations("Install");
  return (
    <section
      id="install"
      className="mx-auto max-w-marketing scroll-mt-24 px-5 pb-22 md:px-8 md:pb-30"
      aria-labelledby="install-title"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
        <div className="reveal">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            {t("eyebrow")}
          </span>
          <h2
            id="install-title"
            className="mt-4.5 font-semibold text-[28px] leading-[1.15] md:text-[40px] md:leading-[1.1]"
          >
            {t("title")}
          </h2>
          <p className="mt-3 mb-8 max-w-[480px] text-muted-foreground">{t("body")}</p>
          <InstallButtons />
        </div>
        <DevicePreview desktopLabel={t("desktopPreview")} mobileLabel={t("mobilePreview")} />
      </div>
    </section>
  );
}

/** Real screenshots of the app (media/capture.ts) in a desktop window and a phone. */
function DevicePreview({ desktopLabel, mobileLabel }: { desktopLabel: string; mobileLabel: string }) {
  return (
    <div className="reveal relative pr-[12%] pb-[10%]">
      <figure className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_40px_100px_-40px_rgb(0_0_0/0.7),0_0_60px_-20px_var(--brand-glow)]">
        <div className="flex items-center gap-1.5 border-b bg-surface px-3 py-2.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <i key={i} className="size-2 rounded-full border border-line-strong bg-surface-2" />
          ))}
        </div>
        <Image
          src="/images/app-desktop.webp"
          alt={desktopLabel}
          width={1440}
          height={900}
          sizes="(min-width: 1024px) 560px, 90vw"
          className="block h-auto w-full"
        />
      </figure>
      <figure className="absolute right-0 bottom-0 w-[30%] overflow-hidden rounded-[22px] border-[5px] border-[#1b1b25] bg-black shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
        <Image
          src="/images/app-mobile.webp"
          alt={mobileLabel}
          width={780}
          height={1688}
          sizes="(min-width: 1024px) 180px, 30vw"
          className="block h-auto w-full"
        />
      </figure>
    </div>
  );
}
