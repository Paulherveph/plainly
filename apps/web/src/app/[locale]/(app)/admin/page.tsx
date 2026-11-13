import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FlagSwitches } from "@/modules/ai/ui/flag-switches";
import { aiProfiles, flagStore, providerHealth } from "@/server/ai";
import { createSupabase } from "@/server/supabase";
import { serverEnv } from "@/shared/config/env";
import { Skeleton } from "@/shared/ui/skeleton";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/**
 * Operations view (docs/SCALING.md section 5): read-only except flags. Admins only (404 otherwise).
 * Internal tool, English only on purpose.
 */
export default function AdminPage() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pt-10 pb-24 md:px-8">
      <h1 className="font-semibold text-3xl tracking-tight">Admin</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-80 w-full rounded-2xl" />}>
        <Admin />
      </Suspense>
    </section>
  );
}

async function Admin() {
  const supabase = await createSupabase();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();
  const { data } = await supabase.rpc("admin_stats").maybeSingle();
  const flags = await flagStore().all();
  const env = serverEnv();
  const spend = Number(data?.spend_today_micros ?? 0) / 1e6;
  const requests = data?.requests_24h ?? 0;
  const errorRate = requests ? Math.round((1000 * (data?.failed_24h ?? 0)) / requests) / 10 : 0;
  const stats: [string, string][] = [
    [
      "AI cost today",
      `$${spend.toFixed(2)} of $${env.AI_DAILY_BUDGET_USD} (${Math.round((spend / env.AI_DAILY_BUDGET_USD) * 100)}%)`,
    ],
    ["AI requests, 24 h", String(requests)],
    ["Failed attempts, 24 h", `${data?.failed_24h ?? 0} (${errorRate}%)`],
    ["Requests with a fallback, 24 h", String(data?.fallbacks_24h ?? 0)],
    ["Analyses today", String(data?.analyses_today ?? 0)],
    ["Active subscriptions", String(data?.active_subscriptions ?? 0)],
  ];
  const profiles = Object.entries(aiProfiles()).map(
    ([p, refs]) => [p, refs.map((r) => `${r.provider}:${r.model}`).join(" → ")] as const,
  );
  return (
    <div className="mt-8 grid gap-4">
      <dl className="grid gap-3 rounded-2xl border bg-surface p-5 sm:grid-cols-3">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-muted-foreground text-xs">{k}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">Providers and profiles</h2>
        <ul className="mt-3 grid gap-1 font-mono text-sm">
          {providerHealth().map((p) => (
            <li key={p.provider}>
              {p.provider}: {p.state}
            </li>
          ))}
          {profiles.map(([p, list]) => (
            <li key={p} className="text-muted-foreground">
              {p}: {list}
            </li>
          ))}
        </ul>
      </section>
      <FlagSwitches flags={Object.fromEntries(flags)} providers={env.AI_PROVIDERS_ALLOWED} />
    </div>
  );
}
