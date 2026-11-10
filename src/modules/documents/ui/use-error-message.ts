"use client";

import { useTranslations } from "next-intl";
import type { AppError } from "@/shared/lib/errors";

/** Maps a typed error to friendly copy. Never shows raw error text. */
export function useErrorMessage() {
  const t = useTranslations("Documents");
  return (error: AppError): string => {
    if (error.kind !== "invalid_input") return t("errorGeneric");
    switch (error.reason) {
      case "unsupported_type":
        return t("errorUnsupported");
      case "too_large":
        return t("errorTooLarge");
      case "too_many_pages":
        return t("errorTooManyPages");
      case "empty":
        return t("errorEmpty");
      case "unreadable":
        return t("errorUnreadable");
    }
  };
}
