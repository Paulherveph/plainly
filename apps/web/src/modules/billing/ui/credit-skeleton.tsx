import { Skeleton } from "@/shared/ui/skeleton";

export function CreditSkeleton() {
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      <Skeleton className="size-5 rounded-full" />
      <Skeleton className="h-3.5 w-24" />
    </div>
  );
}
