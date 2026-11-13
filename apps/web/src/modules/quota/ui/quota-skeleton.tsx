import { Skeleton } from "@/shared/ui/skeleton";

export function QuotaSkeleton() {
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      <Skeleton className="h-1.5 w-18 rounded-full" />
      <Skeleton className="h-3.5 w-36" />
    </div>
  );
}
