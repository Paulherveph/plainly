import { ids, Skeleton } from "@/shared/ui/skeleton";

function CardSkeleton({ lines, className }: { lines: number; className?: string }) {
  return (
    <div className={`rounded-xl border bg-surface p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid gap-2.5">
        {ids(lines).map((i, n) => (
          <Skeleton key={i} className={n === lines - 1 ? "h-3.5 w-2/3" : "h-3.5"} />
        ))}
      </div>
    </div>
  );
}

/** Same layout as AnalysisScreen: header strip, sections on the left, document preview on the right. */
export function AnalysisSkeleton() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 pt-8 pb-10 md:px-8 md:pt-12" aria-hidden="true">
      <div className="mb-6 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-8 w-72 max-w-[80vw]" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8.5 w-44 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-7">
        <div className="flex flex-col gap-4">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
        <div className="hidden rounded-xl border bg-bg-deep p-4 lg:block">
          <div className="grid gap-2.5 rounded bg-surface p-6">
            <Skeleton className="h-4 w-1/2" />
            {ids(14).map((i, n) => (
              <Skeleton key={i} className={n % 4 === 3 ? "h-3 w-3/5" : "h-3"} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
