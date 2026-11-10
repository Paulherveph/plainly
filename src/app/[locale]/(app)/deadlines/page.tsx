import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DeadlineList } from "@/modules/deadlines/ui/deadline-list";
import { DeadlinesSkeleton } from "@/modules/deadlines/ui/deadlines-skeleton";
import { container } from "@/server/container";
import { RevealSuspense } from "@/shared/ui/reveal-suspense";
import { SkeletonRegion } from "@/shared/ui/skeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/deadlines">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Deadlines" });
  return { title: t("title") };
}

export default async function DeadlinesPage({ params }: PageProps<"/[locale]/deadlines">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Deadlines" });
  return (
    <section className="mx-auto max-w-[1120px] px-5 pt-10 pb-24 md:px-8 md:pt-14">
      <div className="mb-5">
        <h1 className="font-semibold text-3xl tracking-tight md:text-[40px] md:leading-[1.1]">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("sub")}</p>
      </div>
      <RevealSuspense
        fallback={
          <SkeletonRegion>
            <DeadlinesSkeleton />
          </SkeletonRegion>
        }
      >
        <Deadlines />
      </RevealSuspense>
    </section>
  );
}

async function Deadlines() {
  const t = await getTranslations("Deadlines");
  const c = await container();
  const user = await c.currentUser();
  const list = user ? await c.listDeadlines(user.id) : null;
  if (!list?.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border bg-surface px-4 py-6 text-center text-muted-foreground text-sm"
      >
        {t("loadError")}
      </p>
    );
  }
  return <DeadlineList deadlines={list.value} today={new Date().toISOString().slice(0, 10)} />;
}
