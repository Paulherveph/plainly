import { ids, Skeleton } from "@/shared/ui/skeleton";

/** Same shape as DocumentLibrary: search + filter, then rows of icon, title/meta, status. */
export function LibrarySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Skeleton className="h-10.5 flex-[1_1_240px] rounded-lg" />
        <Skeleton className="h-10.5 w-36 rounded-lg" />
      </div>
      <ul className="mt-3 overflow-hidden rounded-xl border bg-surface">
        {ids(rows).map((i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 border-b px-4 py-3.5 last:border-b-0"
          >
            <Skeleton className="size-9 rounded-[10px]" />
            <div className="grid gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Upload card + three sample cards, as on /documents. */
export function DocumentInputSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="grid h-[308px] place-items-center rounded-2xl border border-dashed bg-surface">
        <div className="grid justify-items-center gap-3">
          <Skeleton className="size-14 rounded-2xl" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-64" />
          <Skeleton className="mt-2 h-10 w-32 rounded-full" />
        </div>
      </div>
      <Skeleton className="mt-12 h-3.5 w-32" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 rounded-xl border bg-surface p-4.5">
            <Skeleton className="h-14 w-11 rounded-md" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
