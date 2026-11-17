"use client";

import { cn } from "cn";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, FlaskConicalIcon, Loader2Icon, LockIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { simulateBillingAction } from "@/server/actions/billing";
import { Link } from "@/shared/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  type CardErrors,
  type CardField,
  type CardInput,
  formatExpiry,
  formatNumber,
  TEST_CARDS,
  testCardOutcome,
  validateCard,
} from "../domain/demo-card";
import { PaymentCard } from "./payment-card";

export type CheckoutProduct = {
  id: string;
  interval: "month" | "year" | "once";
  priceCents: number;
  currency: string;
  credits: number;
};

const FIELDS: CardField[] = ["name", "number", "expiry", "cvc"];
const EMPTY: CardInput = { name: "", number: "", expiry: "", cvc: "" };
const SHOWN: Record<CardField, boolean> = { name: false, number: false, expiry: false, cvc: false };
type Notice = "declined" | "notTestCard" | "payFailed" | null;
const ERROR_KEY = { required: "errRequired", invalid: "errInvalid", expired: "errExpired" } as const;

/** Keeps each field in its display format while the user types. */
function normalize(field: CardField, raw: string): string {
  switch (field) {
    case "number":
      return formatNumber(raw);
    case "expiry":
      return formatExpiry(raw);
    case "cvc":
      return raw.replace(/\D/g, "").slice(0, 4);
    case "name":
      return raw.slice(0, 40);
  }
}

/**
 * The fake provider's checkout page. Card details stay in this component: they are checked here and
 * never sent. Approval sends only "success" for the signed session, through the real webhook path.
 */
export function DemoCheckout({ token, product }: { token: string; product: CheckoutProduct }) {
  const t = useTranslations("Billing");
  const format = useFormatter();
  const id = useId();
  const [card, setCard] = useState<CardInput>(EMPTY);
  const [hidden, setHidden] = useState(SHOWN);
  const [errors, setErrors] = useState<CardErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [flipped, setFlipped] = useState(false);
  const [shake, setShake] = useState(0);
  const [pending, start] = useTransition();
  const inputs = useRef<Partial<Record<CardField, HTMLInputElement | null>>>({});

  const price = format.number(product.priceCents / 100, {
    style: "currency",
    currency: product.currency.toUpperCase(),
  });
  const allHidden = FIELDS.every((f) => hidden[f]);
  const label: Record<CardField, string> = {
    name: t("cardName"),
    number: t("cardNumber"),
    expiry: t("cardExpiry"),
    cvc: t("cardCvc"),
  };

  function update(field: CardField, raw: string) {
    const value = normalize(field, raw);
    setCard((c) => ({ ...c, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setNotice(null);
  }

  function fillTestCard(number: string) {
    const year = (new Date().getFullYear() + 3) % 100;
    setCard((c) => ({
      name: c.name || t("testName"),
      number: formatNumber(number),
      expiry: `12/${year}`,
      cvc: "123",
    }));
    setErrors({});
    setNotice(null);
  }

  function refuse(next: Notice) {
    setNotice(next);
    setShake((s) => s + 1);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const now = new Date();
    const found = validateCard(card, { year: now.getFullYear(), month: now.getMonth() + 1 });
    setErrors(found);
    const first = FIELDS.find((f) => found[f]);
    if (first) {
      inputs.current[first]?.focus();
      return;
    }
    const outcome = testCardOutcome(card.number);
    if (outcome !== "approve") return refuse(outcome === "decline" ? "declined" : "notTestCard");
    start(async () => {
      const res = await simulateBillingAction({ session: token, event: "success" });
      if (res.ok) window.location.assign(res.value.next);
      else refuse("payFailed");
    });
  }

  function field(name: CardField, props: React.ComponentProps<"input">) {
    const error = errors[name];
    const errorId = `${id}-${name}-error`;
    return (
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-${name}`} className="font-medium text-sm">
          {label[name]}
        </label>
        <div className="relative">
          <Input
            id={`${id}-${name}`}
            ref={(el) => {
              inputs.current[name] = el;
            }}
            // Masked fields use type=password; autoComplete=off keeps browsers from offering real cards.
            type={hidden[name] ? "password" : "text"}
            autoComplete="off"
            spellCheck={false}
            value={card[name]}
            onChange={(e) => update(name, e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-11 rounded-xl pr-10"
            {...props}
          />
          <button
            type="button"
            onClick={() => setHidden((h) => ({ ...h, [name]: !h[name] }))}
            aria-label={t(hidden[name] ? "showField" : "hideField", { field: label[name] })}
            aria-pressed={hidden[name]}
            className="absolute inset-y-0 right-1 my-auto grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
          >
            {hidden[name] ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
        {error ? (
          <p id={errorId} className="text-critical text-xs">
            {t(ERROR_KEY[error])}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Link
        href="/pricing"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t("backToPricing")}
      </Link>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
        <div className="grid gap-6">
          <PaymentCard
            key={shake}
            card={card}
            hidden={hidden}
            onToggle={(f) => setHidden((h) => ({ ...h, [f]: !h[f] }))}
            flipped={flipped}
            shake={shake > 0}
          />
          <section aria-labelledby={`${id}-summary`} className="rounded-2xl border bg-surface p-5">
            <h2 id={`${id}-summary`} className="font-semibold">
              {t("orderSummary")}
            </h2>
            <dl className="mt-4 grid gap-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-medium">{t(`plan_${product.id}`)}</dt>
                <dd className="tabular-nums">{price}</dd>
              </div>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>{t(`billed_${product.interval}`)}</dt>
                <dd>
                  {product.interval === "once"
                    ? t("creditsOnce", { count: product.credits })
                    : t("creditsMonthly", { count: product.credits })}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>{t("subtotal")}</dt>
                <dd className="tabular-nums">{price}</dd>
              </div>
              <div className="mt-1 flex justify-between gap-4 border-t pt-3 font-semibold text-base">
                <dt>{t("dueToday")}</dt>
                <dd className="tabular-nums">{price}</dd>
              </div>
            </dl>
          </section>
        </div>

        <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border bg-surface p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-semibold text-2xl tracking-tight">{t("checkoutTitle")}</h1>
            <button
              type="button"
              onClick={() =>
                setHidden(() => Object.fromEntries(FIELDS.map((f) => [f, !allHidden])) as typeof SHOWN)
              }
              aria-pressed={allHidden}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
            >
              {allHidden ? (
                <EyeIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <EyeOffIcon className="size-3.5" aria-hidden="true" />
              )}
              {allHidden ? t("showCard") : t("hideCard")}
            </button>
          </div>

          <p className="flex gap-2 rounded-xl bg-brand-soft px-3.5 py-2.5 text-brand-text text-sm">
            <FlaskConicalIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("checkoutDemo")}
          </p>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-muted-foreground text-xs">{t("testCards")}</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  [TEST_CARDS.approve, t("testApprove"), "bg-ok"],
                  [TEST_CARDS.decline, t("testDecline"), "bg-critical"],
                ] as const
              ).map(([number, outcome, dot]) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => fillTestCard(number)}
                  className="inline-flex items-center gap-2 rounded-full border bg-surface-2/60 px-3 py-1.5 font-mono text-xs transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot)} />
                  {formatNumber(number)}
                  <span className="font-sans text-muted-foreground">{outcome}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {field("name", { placeholder: t("cardNamePlaceholder"), autoCapitalize: "words" })}
          {field("number", { inputMode: "numeric", placeholder: "1234 1234 1234 1234" })}
          <div className="grid grid-cols-2 gap-4">
            {field("expiry", { inputMode: "numeric", placeholder: "MM/YY" })}
            {field("cvc", {
              inputMode: "numeric",
              placeholder: "123",
              onFocus: () => setFlipped(true),
              onBlur: () => setFlipped(false),
            })}
          </div>

          <p role="alert" className="min-h-5 text-critical text-sm">
            {notice ? t(notice) : null}
          </p>

          <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-xl text-base">
            {pending ? (
              <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <LockIcon className="size-4" aria-hidden="true" />
            )}
            {pending ? t("paying") : t("pay", { amount: price })}
          </Button>
        </form>
      </div>
    </div>
  );
}
