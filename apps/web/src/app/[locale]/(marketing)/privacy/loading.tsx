import { Skeleton, SkeletonRegion } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion className="mx-auto max-w-[1120px] px-5 pt-12 pb-24 md:px-8 md:pt-16">
      <div className="grid max-w-[720px] gap-4" aria-hidden="true">
        <Skeleton className="h-7.5 w-28 rounded-full" />
        <Skeleton className="h-11 w-3/4" />
        <Skeleton className="h-5 w-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mt-8 grid gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
