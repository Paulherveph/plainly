"use client";

import { WifiOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/** Registers /sw.js in production (H01) and shows a calm offline note while the network is gone. */
export function ServiceWorker() {
  const t = useTranslations("Offline");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && location.hostname !== "localhost") {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <output className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border bg-surface p-3.5 text-sm shadow-lg print:hidden">
      <WifiOffIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p>
        <span className="font-medium">{t("title")}.</span>{" "}
        <span className="text-muted-foreground">{t("body")}</span>
      </p>
    </output>
  );
}

/** Called after sign-out and deletions so cached result pages never outlive the data. */
export function clearOfflineCache(): void {
  navigator.serviceWorker?.controller?.postMessage("clear");
}
