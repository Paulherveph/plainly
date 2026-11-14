import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  FileSignatureIcon,
  HouseIcon,
  MailIcon,
  PlaneIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/shared/i18n/navigation";
import { SectionHead } from "./landing";
import { LogoMark } from "./logo";

/**
 * Use-case hub (docs/DESIGN.md section 3b). Six document cards wired to a Plainly core.
 * Layout and wires share one 1000 x 620 coordinate space, so the SVG and the absolutely placed cards
 * line up at every width from `lg`. Below `lg` it falls back to a stacked grid without wires.
 * Motion is CSS and SVG only: a light pulse flows from each document into the core, and the wires
 * shimmer through a turbulence filter, echoing the hero orb. Reduced motion hides the moving layer.
 */

type Kind = "visa" | "lease" | "offer" | "contract" | "insurance" | "letter";

type Node = {
  kind: Kind;
  icon: React.ReactNode;
  /** Card anchor in the 1000 x 620 space: x is the edge facing the core, y the card's vertical center. */
  x: number;
  y: number;
  side: "left" | "right";
  /** Wire from the card anchor into a core port. */
  wire: string;
  sample?: "visa" | "lease" | "offer";
};

const W = 1000;
const H = 620;
const CARD_W = 210;

const NODES: Node[] = [
  {
    kind: "visa",
    icon: <PlaneIcon />,
    x: 260,
    y: 96,
    side: "left",
    wire: "M260 96 C320 96 310 210 370 210",
    sample: "visa",
  },
  {
    kind: "lease",
    icon: <HouseIcon />,
    x: 210,
    y: 310,
    side: "left",
    wire: "M210 310 C290 310 290 300 370 300",
    sample: "lease",
  },
  {
    kind: "contract",
    icon: <FileSignatureIcon />,
    x: 310,
    y: 532,
    side: "left",
    wire: "M310 532 C440 532 500 525 500 470",
  },
  {
    kind: "offer",
    icon: <BriefcaseBusinessIcon />,
    x: 740,
    y: 96,
    side: "right",
    wire: "M740 96 C680 96 690 210 630 210",
    sample: "offer",
  },
  {
    kind: "insurance",
    icon: <ShieldCheckIcon />,
    x: 790,
    y: 310,
    side: "right",
    wire: "M790 310 C710 310 710 300 630 300",
  },
  {
    kind: "letter",
    icon: <MailIcon />,
    x: 690,
    y: 532,
    side: "right",
    wire: "M690 532 C560 532 500 525 500 470",
  },
];

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

export function UseCases() {
  const t = useTranslations("UseCases");
  return (
    <section className="mx-auto max-w-marketing px-5 pb-22 md:px-8 md:pb-30" aria-labelledby="uses-title">
      <SectionHead id="uses-title" eyebrow={t("eyebrow")} title={t("title")} muted={t("muted")} />

      <div className="reveal relative mx-auto grid max-w-[1040px] grid-cols-2 gap-3 md:grid-cols-3 lg:block lg:aspect-[1000/620]">
        <Wires />
        <Core />
        {NODES.map((n) => (
          <UseCaseCard key={n.kind} node={n} />
        ))}
      </div>

      <p className="reveal mt-12 flex items-center justify-center gap-4 font-medium text-[12px] text-brand-text uppercase tracking-[0.28em]">
        <span
          aria-hidden="true"
          className="h-px w-10 bg-[linear-gradient(90deg,transparent,var(--brand))] md:w-20"
        />
        {t("tagline")}
        <span
          aria-hidden="true"
          className="h-px w-10 bg-[linear-gradient(90deg,var(--brand),transparent)] md:w-20"
        />
      </p>
    </section>
  );
}

function Wires() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden size-full overflow-visible lg:block"
      fill="none"
    >
      <defs>
        <radialGradient id="uc-halo">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <filter id="uc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* The "noise": turbulence re-seeded a few times a second makes the wires tremble like the orb. */}
        <filter id="uc-noise" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" result="n">
            <animate
              attributeName="seed"
              values="1;4;2;7;3;9;5"
              dur="0.9s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <ellipse cx="500" cy="310" rx="300" ry="250" fill="url(#uc-halo)" />
      <circle cx="500" cy="310" r="290" stroke="var(--line-strong)" strokeDasharray="2 7" />
      <circle cx="500" cy="310" r="380" stroke="var(--line)" strokeDasharray="2 9" />

      {/* Static wires: what reduced motion sees. */}
      <g stroke="var(--brand)" strokeOpacity="0.35" strokeWidth="1.25">
        {NODES.map((n) => (
          <path key={n.kind} d={n.wire} />
        ))}
      </g>

      <g className="uc-live">
        <g filter="url(#uc-noise)" stroke="var(--brand)" strokeOpacity="0.5" strokeWidth="1.5">
          {NODES.map((n) => (
            <path key={n.kind} d={n.wire} />
          ))}
        </g>
        <g filter="url(#uc-glow)" stroke="var(--uc-pulse)" strokeWidth="2.25" strokeLinecap="round">
          {NODES.map((n, i) => (
            <path
              key={n.kind}
              d={n.wire}
              pathLength={100}
              className="uc-pulse"
              style={{ animationDelay: `${i * -0.55}s` }}
            />
          ))}
        </g>
      </g>

      <g fill="var(--brand)" filter="url(#uc-glow)">
        {NODES.map((n) => (
          <circle key={n.kind} cx={n.x} cy={n.y} r="3.5" className="uc-node" />
        ))}
        {[
          [370, 210],
          [370, 300],
          [630, 210],
          [630, 300],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" />
        ))}
      </g>
    </svg>
  );
}

function Core() {
  const t = useTranslations("UseCases");
  return (
    <div
      className="uc-core-frame relative col-span-full mx-auto mb-4 w-full max-w-[300px] rounded-[22px] p-px shadow-[0_0_60px_-12px_var(--brand-glow),0_30px_80px_-30px_rgb(0_0_0/0.6)] lg:absolute lg:top-(--t) lg:left-(--l) lg:mb-0 lg:h-(--h) lg:w-(--w) lg:max-w-none"
      style={
        {
          "--l": pct(370, W),
          "--t": pct(150, H),
          "--w": pct(260, W),
          "--h": pct(320, H),
        } as React.CSSProperties
      }
    >
      <div className="relative flex h-full flex-col items-center justify-center gap-4 rounded-[21px] bg-[linear-gradient(180deg,var(--surface-2),var(--surface))] px-5 pt-5 pb-8 text-center">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[11px] text-brand-text uppercase tracking-[0.22em]">
          <SparklesIcon className="size-3.5" aria-hidden="true" />
          {t("coreLabel")}
        </span>
        <div aria-hidden="true" className="relative grid size-28 place-items-center xl:size-32">
          <div className="uc-orb-ring absolute inset-0 rounded-full" />
          <div className="absolute inset-2 rounded-full border border-brand/30 bg-[radial-gradient(circle_at_50%_40%,rgb(148_120_255/0.45),rgb(60_40_160/0.25)_55%,transparent_75%)] shadow-[inset_0_0_30px_rgb(148_120_255/0.35),0_0_40px_-6px_var(--brand-glow)]" />
          <LogoMark className="relative size-11" />
        </div>
        <p className="text-[14px] leading-snug">
          {t("coreRead")} <span className="text-brand-text">{t("coreExplain")}</span>
          <br />
          {t("coreRemind")}
        </p>
        <span
          aria-hidden="true"
          className="-bottom-3 -translate-x-1/2 absolute left-1/2 hidden h-6 w-12 place-items-center rounded-lg border border-brand/40 bg-surface shadow-[0_0_18px_-2px_var(--brand-glow)] lg:grid"
        >
          <span className="size-1.5 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" />
        </span>
      </div>
    </div>
  );
}

function UseCaseCard({ node }: { node: Node }) {
  const t = useTranslations("UseCases");
  const locale = useLocale();
  const name = t(node.kind);
  const left = node.side === "left" ? node.x - CARD_W : node.x;
  const body = (
    <>
      <span className="grid size-11 place-items-center rounded-xl border border-brand/25 bg-brand-soft text-brand-text shadow-[0_0_24px_-8px_var(--brand-glow)] [&_svg]:size-5">
        {node.icon}
      </span>
      <span className="font-semibold text-[16px] tracking-tight">{name}</span>
      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-[12px] leading-tight sm:text-[12.5px] text-muted-foreground transition-colors duration-200 group-hover:border-brand/40 group-hover:text-foreground">
        {t(`${node.kind}Action`)}
        <ArrowRightIcon
          className="hidden size-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
          aria-hidden="true"
        />
      </span>
    </>
  );
  const className =
    "glass group flex flex-col items-center gap-2.5 rounded-2xl px-2.5 py-4 text-center sm:px-4 outline-none transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_18px_50px_-24px_var(--brand-glow)] focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 lg:absolute lg:top-(--t) lg:left-(--l) lg:w-(--w) lg:-translate-y-1/2 lg:hover:-translate-y-[calc(50%+2px)]";
  const style = { "--l": pct(left, W), "--t": pct(node.y, H), "--w": pct(CARD_W, W) } as React.CSSProperties;

  // Samples create a document, so they use a plain <a> that is never prefetched (like the hero CTA).
  return node.sample ? (
    <a
      href={`/${locale}/documents/try?sample=${node.sample}`}
      aria-label={t("sampleAria", { name })}
      className={className}
      style={style}
    >
      {body}
    </a>
  ) : (
    <Link
      href="/documents"
      prefetch={false}
      aria-label={t("uploadAria", { name })}
      className={className}
      style={style}
    >
      {body}
    </Link>
  );
}
