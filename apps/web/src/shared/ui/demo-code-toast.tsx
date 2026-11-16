"use client";

import { toast } from "sonner";

const ID = "demo-code";

type Copy = { title: string; body: string; copy: string; copied: string };

/**
 * Demo codes (docs/TEST_ACCOUNTS.md): shows the sign-up code with a Copy button, because the demo sends no email.
 * It stays until copied or closed; a new code replaces it. If the clipboard is blocked, it stays so the code can
 * be typed instead.
 */
export function showDemoCode(code: string, text: Copy) {
  toast(text.title, {
    id: ID,
    description: (
      <span className="grid gap-1">
        <span>{text.body}</span>
        <span
          data-testid="demo-code"
          className="font-mono font-semibold text-base text-foreground tracking-[0.3em]"
        >
          {code}
        </span>
      </span>
    ),
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    action: {
      label: text.copy,
      onClick: (event) => {
        // Sonner closes the toast on any action click; keep it open until the copy succeeds.
        event.preventDefault();
        navigator.clipboard.writeText(code).then(
          () => {
            toast.dismiss(ID);
            toast.success(text.copied);
          },
          () => {},
        );
      },
    },
  });
}

export function dismissDemoCode() {
  toast.dismiss(ID);
}
