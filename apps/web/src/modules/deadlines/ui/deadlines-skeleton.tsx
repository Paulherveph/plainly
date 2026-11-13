import { ids, Skeleton } from "@/shared/ui/skeleton";

/** Same shape as DeadlineList: filter + export on the right, then a group of rows. */
export function DeadlinesSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className="flex justify-end gap-2.5">
        <Skeleton className="h-8.5 w-32 rounded-full" />
        <Skeleton className="h-8.5 w-28 rounded-full" />
      </div>
      <Skeleton className="mt-7 mb-3 h-3.5 w-28" />
      <ul className="overflow-hidden rounded-xl border bg-surface">
        {ids(rows).map((i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[auto_88px_1fr_auto]"
          >
            <Skeleton className="size-5.5 rounded-[7px]" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <div className="grid gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="size-8 rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}
