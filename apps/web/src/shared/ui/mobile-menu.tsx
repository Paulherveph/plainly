"use client";

import { cn } from "cn";
import { CalendarClockIcon, FileTextIcon, GemIcon, ShieldIcon, UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { LocaleSwitch } from "./locale-switch";
import { LogoMark } from "./logo";
import { useHydrated } from "./use-hydrated";

/** Closed -> full drawer -> icon rail -> closed, one step per press of the header button. */
type MenuState = "closed" | "full" | "mini";
const NEXT: Record<MenuState, MenuState> = { closed: "full", full: "mini", mini: "closed" };
const LABEL = { closed: "openMenu", full: "collapseMenu", mini: "closeMenu" } as const;

const ITEMS = [
  { href: "/documents", key: "documents", Icon: FileTextIcon },
  { href: "/deadlines", key: "deadlines", Icon: CalendarClockIcon },
  { href: "/pricing", key: "pricing", Icon: GemIcon },
  { href: "/privacy", key: "privacy", Icon: ShieldIcon },
] as const;

const BAR =
  "absolute left-0 h-[2px] w-full rounded-full bg-current transition-[translate,rotate,scale,opacity] duration-200 ease-out motion-reduce:transition-none";

/** Two bars that fold into a back arrow (the full drawer is open) and unfold again. */
function MenuGlyph({ arrow }: { arrow: boolean }) {
  return (
    <span aria-hidden="true" className="relative block h-[2px] w-4">
      <span
        className={cn(
          BAR,
          "origin-left",
          arrow ? "translate-y-0 -rotate-45 scale-x-[0.6]" : "-translate-y-[3px]",
        )}
      />
      <span className={cn(BAR, arrow ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0")} />
      <span
        className={cn(
          BAR,
          // The lower bar is shorter, and keeps that length as one side of the arrow.
          "origin-left scale-x-[0.6]",
          arrow ? "translate-y-0 rotate-45" : "translate-y-[3px]",
        )}
      />
    </span>
  );
}

/** Phones and tablets: a round two-bar button that opens a drawer, then shrinks it to an icon rail. */
export function MobileMenu({ account }: { account: React.ReactNode }) {
  const t = useTranslations("Nav");
  const [state, setState] = useState<MenuState>("closed");
  const hydrated = useHydrated();

  useEffect(() => {
    if (state === "closed") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState("closed");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  return (
    <>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full border bg-surface text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand lg:hidden"
        aria-expanded={state !== "closed"}
        aria-controls="mobile-menu"
        aria-label={t(LABEL[state])}
        onClick={() => setState(NEXT[state])}
      >
        <MenuGlyph arrow={state === "full"} />
      </button>
      {hydrated && state !== "closed"
        ? // The header's backdrop blur would trap a fixed drawer inside it, so the drawer lives on <body>.
          createPortal(
            <Drawer state={state} account={account} onClose={() => setState("closed")} />,
            document.body,
          )
        : null}
    </>
  );
}

function Drawer(props: {
  state: Exclude<MenuState, "closed">;
  account: React.ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations("Nav");
  const full = props.state === "full";
  return (
    <>
      {full ? (
        <div
          aria-hidden="true"
          onClick={props.onClose}
          className="fixed inset-0 z-30 animate-in bg-black/40 backdrop-blur-[2px] duration-200 fade-in lg:hidden motion-reduce:animate-none"
        />
      ) : null}
      <aside
        id="mobile-menu"
        aria-label={t("main")}
        className={cn(
          "fixed top-2 bottom-2 left-2 z-50 flex animate-in flex-col overflow-hidden rounded-2xl border bg-surface shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)] duration-200 ease-out slide-in-from-left-4 fade-in transition-[width] lg:hidden motion-reduce:animate-none motion-reduce:transition-none",
          full ? "w-[min(288px,calc(100vw-5rem))]" : "w-16",
        )}
      >
        <Link
          href="/"
          onClick={props.onClose}
          aria-label={t("home")}
          className={cn(
            "flex h-16 shrink-0 items-center gap-2.5 font-semibold text-[17px] tracking-tight",
            full ? "px-5" : "justify-center",
          )}
        >
          <LogoMark />
          {full ? "Plainly" : null}
        </Link>

        <nav aria-label={t("main")} className="grid gap-1 px-2.5 pt-2">
          <Suspense fallback={<Items full={full} pathname={null} onNavigate={props.onClose} />}>
            <ActiveItems full={full} onNavigate={props.onClose} />
          </Suspense>
        </nav>

        <div className="mt-auto border-t p-3">
          {full ? (
            // Members change language on their profile, so the switch is for visitors and guests only.
            <div className="group grid gap-3">
              <LocaleSwitch className="w-fit group-has-[[data-member]]:hidden" />
              <div className="min-w-0 [&_a]:max-w-full [&_button]:max-w-full [&>*]:flex [&>*]:min-w-0 [&>*]:flex-wrap">
                {props.account}
              </div>
            </div>
          ) : (
            <Link
              href="/account"
              prefetch={false}
              onClick={props.onClose}
              aria-label={t("account")}
              title={t("account")}
              className="mx-auto grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
            >
              <UserIcon className="size-5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

function ActiveItems(props: { full: boolean; onNavigate: () => void }) {
  return <Items {...props} pathname={usePathname()} />;
}

function Items({
  full,
  pathname,
  onNavigate,
}: {
  full: boolean;
  pathname: string | null;
  onNavigate: () => void;
}) {
  const t = useTranslations("Nav");
  return ITEMS.map(({ href, key, Icon }) => {
    const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
    return (
      <Link
        key={href}
        href={href}
        // App pages create a guest on first visit; a prefetch would create one per link and race the cookies.
        prefetch={false}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={full ? undefined : t(key)}
        title={full ? undefined : t(key)}
        className={cn(
          "flex h-11 items-center gap-3 rounded-xl text-muted-foreground text-[15px] transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-text",
          full ? "px-3" : "justify-center",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        {full ? t(key) : null}
      </Link>
    );
  });
}
