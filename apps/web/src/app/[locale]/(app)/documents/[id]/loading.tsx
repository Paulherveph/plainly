import { AnalysisSkeleton } from "@/modules/analysis/ui/analysis-skeleton";
import { SkeletonRegion } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion>
      <AnalysisSkeleton />
    </SkeletonRegion>
  );
}
