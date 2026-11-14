"use client";

import { cn } from "cn";
import { useRef } from "react";

const LENGTH = 6;

/**
 * Six boxes for the email code. Typing moves forward, Backspace moves back, and a pasted or autofilled code
 * (`autocomplete="one-time-code"`) fills every box. Calls `onComplete` once all six digits are in.
 * No `maxLength`: a full code typed or pasted into any box is spread across the boxes.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  labelId,
  digitLabel,
  invalid,
  describedBy,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  labelId: string;
  digitLabel: (n: number) => string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => boxes.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  function write(from: number, digits: string) {
    const chars = value.padEnd(LENGTH, " ").split("");
    for (let k = 0; k < digits.length && from + k < LENGTH; k++) chars[from + k] = digits[k] ?? " ";
    const next = chars.join("").replace(/\s+$/, "");
    onChange(next);
    focus(from + digits.length);
    if (/^\d{6}$/.test(next)) onComplete?.(next);
  }

  return (
    <fieldset
      aria-labelledby={labelId}
      className="m-0 flex min-w-0 justify-between gap-2 border-0 p-0 sm:gap-2.5"
    >
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          // biome-ignore lint/suspicious/noArrayIndexKey: the six boxes never reorder.
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={value[i]?.trim() ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            if (!digits) {
              const chars = value.padEnd(LENGTH, " ").split("");
              chars[i] = " ";
              onChange(chars.join("").replace(/\s+$/, ""));
              return;
            }
            // One new digit replaces this box; several (paste, autofill) spread from here.
            // Focus selects the box, so typing normally replaces it; if not, keep only the newest digit.
            write(i, digits.length === 2 && value[i]?.trim() ? digits.slice(-1) : digits);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i]?.trim()) {
              e.preventDefault();
              const chars = value.padEnd(LENGTH, " ").split("");
              chars[i - 1] = " ";
              if (i > 0) onChange(chars.join("").replace(/\s+$/, ""));
              focus(i - 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              focus(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              focus(i + 1);
            }
          }}
          onPaste={(e) => {
            const digits = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!digits) return;
            e.preventDefault();
            write(digits.length >= LENGTH ? 0 : i, digits.slice(0, LENGTH));
          }}
          className={cn(
            "h-13 w-full min-w-0 rounded-xl border border-line-strong bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] text-center font-mono text-xl tabular-nums outline-none transition-[border-color,box-shadow] duration-150",
            "focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30",
            "aria-invalid:border-critical/70 disabled:opacity-50",
          )}
        />
      ))}
    </fieldset>
  );
}
