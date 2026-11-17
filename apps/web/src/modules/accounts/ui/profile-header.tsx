import { CoinsIcon, SparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/shared/i18n/navigation";

/** Two initials from a real name ("Ada Lovelace" -> "AL"), one letter from an email ("ada@…" -> "A"). */
function initials(title: string): string {
  if (title.includes("@")) return (title[0] ?? "P").toUpperCase();
  const words = title.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "P";
}

/** Who is signed in, their plan and credits (image3 style), above the activity graph. */
export async function ProfileHeader(props: {
  locale: string;
  name: string | null;
  email: string | null;
  planId: string | null;
  credits: number | null;
}) {
  const t = await getTranslations({ locale: props.locale, namespace: "Account" });
  const tb = await getTranslations({ locale: props.locale, namespace: "Billing" });
  const title = props.name || props.email || t("title");
  const paid = props.planId !== null && !["free", "guest"].includes(props.planId);
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-surface p-5 md:p-6">
      <div
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand/50 font-semibold text-lg text-white shadow-[0_8px_24px_-8px_var(--brand-glow)]"
      >
        {initials(title)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-lg">{title}</p>
        {props.name && props.email ? (
          <p className="truncate text-muted-foreground text-sm">{props.email}</p>
        ) : null}
      </div>
      {props.planId ? (
        <Link
          href="/account?tab=plan"
          className="inline-flex items-center gap-3 rounded-full border bg-surface-2/60 py-1.5 pr-3.5 pl-2 text-sm transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span
            className={
              paid
                ? "inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-text"
                : "rounded-full bg-surface-2 px-2 py-0.5 font-medium text-muted-foreground"
            }
          >
            {paid ? <SparklesIcon className="size-3" aria-hidden="true" /> : null}
            {tb(`plan_${props.planId}`)}
          </span>
          {props.credits !== null ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
              <CoinsIcon className="size-3.5" aria-hidden="true" />
              {t("credits", { count: props.credits })}
            </span>
          ) : null}
        </Link>
      ) : null}
    </section>
  );
}
