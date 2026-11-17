"use client";

import { cn } from "cn";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { brandOf, type CardField, type CardInput, cardFaceNumber, digitsOnly } from "../domain/demo-card";

const BRAND_LABEL = { visa: "VISA", mastercard: "mastercard", amex: "AMEX", card: "" } as const;

/** Dots for a hidden value, the placeholder for an empty one. */
function face(value: string, hidden: boolean, placeholder: string): string {
  if (!value) return placeholder;
  return hidden ? "•".repeat(Math.min(value.length, 12)) : value;
}

/**
 * The live card preview of the demo checkout. It mirrors the form and turns over while the CVC field
 * has focus. Its eye buttons repeat the form's (mouse only); the form's eyes are the keyboard path.
 */
export function PaymentCard(props: {
  card: CardInput;
  hidden: Record<CardField, boolean>;
  onToggle: (field: CardField) => void;
  flipped: boolean;
  shake: boolean;
}) {
  const t = useTranslations("Billing");
  const brand = brandOf(digitsOnly(props.card.number));
  const eye = (field: CardField, label: string) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => props.onToggle(field)}
      aria-label={t(props.hidden[field] ? "showField" : "hideField", { field: label })}
      className="grid size-6 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
    >
      {props.hidden[field] ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
    </button>
  );

  return (
    <div className={cn("pay-card mx-auto w-full max-w-[380px]", props.shake && "pay-card-shake")}>
      <div
        className="pay-card-inner relative aspect-[1.586] w-full"
        data-flipped={props.flipped}
        data-testid="payment-card"
      >
        {/* Front */}
        <div
          inert={props.flipped}
          className="pay-card-face pay-card-front absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-[0_24px_48px_-20px_rgb(40_20_110/0.6)] ring-1 ring-white/10"
          style={{ background: "linear-gradient(135deg, #17131f 0%, #2a2150 48%, #6c56dc 100%)" }}
        >
          <div
            aria-hidden="true"
            className="-right-16 -top-20 pointer-events-none absolute size-56 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative flex items-start justify-between">
            <span className="font-semibold text-sm tracking-tight">Plainly</span>
            <span className="font-bold text-base italic tracking-wide" data-testid="card-brand">
              {BRAND_LABEL[brand]}
            </span>
          </div>
          <div className="relative grid gap-3">
            <div
              aria-hidden="true"
              className="h-7 w-10 rounded-md bg-gradient-to-br from-[#e9e4f5] to-[#9d97b0] ring-1 ring-black/10"
            />
            <div className="flex items-center gap-1.5">
              <span
                className="font-mono text-[clamp(15px,4.6vw,20px)] tracking-[0.12em]"
                data-testid="card-number"
              >
                {cardFaceNumber(props.card.number, props.hidden.number)}
              </span>
              {eye("number", t("cardNumber"))}
            </div>
          </div>
          <div className="relative flex items-end justify-between gap-4 text-xs">
            <div className="min-w-0">
              <p className="text-[10px] text-white/55 uppercase tracking-wider">{t("cardFaceName")}</p>
              <div className="flex items-center gap-1">
                <p className="truncate font-medium text-sm uppercase tracking-wide" data-testid="card-name">
                  {face(props.card.name, props.hidden.name, t("cardNamePlaceholder"))}
                </p>
                {eye("name", t("cardName"))}
              </div>
            </div>
            <div className="shrink-0">
              <p className="text-[10px] text-white/55 uppercase tracking-wider">{t("cardFaceExpiry")}</p>
              <div className="flex items-center gap-1">
                <p className="font-mono text-sm" data-testid="card-expiry">
                  {face(props.card.expiry, props.hidden.expiry, "MM/YY")}
                </p>
                {eye("expiry", t("cardExpiry"))}
              </div>
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          inert={!props.flipped}
          className="pay-card-face pay-card-back absolute inset-0 overflow-hidden rounded-2xl text-white shadow-[0_24px_48px_-20px_rgb(40_20_110/0.6)] ring-1 ring-white/10"
          style={{ background: "linear-gradient(225deg, #17131f 0%, #2a2150 52%, #5b47c4 100%)" }}
        >
          <div aria-hidden="true" className="mt-6 h-11 w-full bg-black/70" />
          <div className="mt-5 flex items-center gap-3 px-5">
            <div
              aria-hidden="true"
              className="h-9 flex-1 rounded bg-[repeating-linear-gradient(90deg,#efedf5_0_6px,#dcd8e6_6px_12px)]"
            />
            <div className="flex items-center gap-1 rounded bg-white px-3 py-1.5 text-[#17131f]">
              <span className="font-mono text-sm" data-testid="card-cvc">
                {face(props.card.cvc, props.hidden.cvc, "•••")}
              </span>
            </div>
            {eye("cvc", t("cardCvc"))}
          </div>
          <p className="mt-4 px-5 text-[10px] text-white/50 uppercase tracking-wider">{t("cardCvc")}</p>
        </div>
      </div>
    </div>
  );
}
