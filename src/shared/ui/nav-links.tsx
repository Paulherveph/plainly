"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/shared/i18n/navigation";

const ITEMS = [
  { href: "/documents", key: "documents" },
  { href: "/deadlines", key: "deadlines" },
  { href: "/privacy", key: "privacy" },
] as const;

export function NavLinks({
  variant = "bar",
  onNavigate,
}: {
  variant?: "bar" | "menu";
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  return ITEMS.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
