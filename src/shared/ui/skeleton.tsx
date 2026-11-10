import { cn } from "cn";
import { useTranslations } from "next-intl";

/** One shimmering block. Size it with classes; it matches the content it stands in for. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" aria-hidden="true" className={cn("skeleton-line", className)} {...props} />
  );
}

/** Wraps a page or section skeleton: announces "Loading…" once to screen readers. */
function SkeletonRegion({ className, children }: { className?: string; children: React.ReactNode }) {
  const t = useTranslations("Common");
  return (
    <output data-testid="skeleton" className={cn("block", className)}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </output>
  );
}

/** Page title + subtitle, shared by every app page skeleton. */
function PageHeadSkeleton({ aside }: { aside?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-3">
        <Skeleton className="h-9 w-64 md:h-11 md:w-80" />
        <Skeleton className="h-4 w-72 max-w-[80vw]" />
      </div>
      {aside}
    </div>
  );
}

/** Stable keys for placeholder rows. */
function ids(count: number) {
  return Array.from({ length: count }, (_, n) => `sk-${n}`);
}

export { ids, PageHeadSkeleton, Skeleton, SkeletonRegion };
