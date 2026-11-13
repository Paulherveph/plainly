"use client";

import { useEffect, useRef } from "react";
import { publicEnv } from "@/shared/config/env";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Cloudflare Turnstile. Renders nothing when no site key is configured (local work). */
export function Turnstile({
  siteKey,
  onToken,
  onError,
  action,
}: {
  siteKey: string | undefined;
  onToken: (token: string) => void;
  onError?: () => void;
  action?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onToken, onError });
  handlers.current = { onToken, onError };

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let id: string | null = null;
    let cancelled = false;
    load()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          theme: "auto",
          appearance: "interaction-only",
          callback: (token: string) => handlers.current.onToken(token),
          "error-callback": () => handlers.current.onError?.(),
          "expired-callback": () => handlers.current.onError?.(),
        });
      })
      .catch(() => handlers.current.onError?.());
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, action]);

  return siteKey ? <div ref={ref} className="min-h-[65px]" /> : null;
}

export const turnstileSiteKey = (): string | undefined => publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY;
