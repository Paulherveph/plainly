"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/shared/i18n/navigation";

const ITEMS = [
  { href: "/documents", key: "documents" },
  { href: "/deadlines", key: "deadlines" },
  { href: "/privacy", key: "privacy" },
] as const;

type Props = { variant?: "bar" | "menu"; onNavigate?: () => void };

/** The active state needs the URL, which streams in; the links themselves render in the static shell. */
export function NavLinks(props: Props) {
  return (
    <Suspense fallback={<Links {...props} pathname={null} />}>
      <ActiveLinks {...props} />
    </Suspense>
  );
}

function ActiveLinks(props: Props) {
  return <Links {...props} pathname={usePathname()} />;
}

function Links({ variant = "bar", onNavigate, pathname }: Props & { pathname: string | null }) {
  const t = useTranslations("Nav");
  return ITEMS.map((item) => {
    const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          variant === "bar"
            ? "rounded-full px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground aria-[current=page]:bg-surface-2 aria-[current=page]:text-foreground"
            : "block border-b py-3 text-base text-muted-foreground aria-[current=page]:text-foreground",
        )}
      >
        {t(item.key)}
      </Link>
    );
  });
}
