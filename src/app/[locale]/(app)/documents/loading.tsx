import { DocumentInputSkeleton, LibrarySkeleton } from "@/modules/documents/ui/library-skeleton";
import { QuotaSkeleton } from "@/modules/quota/ui/quota-skeleton";
import { PageHeadSkeleton, SkeletonRegion } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion className="mx-auto max-w-[1120px] px-5 pt-10 pb-24 md:px-8 md:pt-14">
      <PageHeadSkeleton aside={<QuotaSkeleton />} />
      <DocumentInputSkeleton />
      <LibrarySkeleton />
    </SkeletonRegion>
  );
}
