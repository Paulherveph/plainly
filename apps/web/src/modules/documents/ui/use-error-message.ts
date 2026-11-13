"use client";

import { useTranslations } from "next-intl";
import type { AppError } from "@/shared/lib/errors";

/** Maps a typed error to friendly copy. Never shows raw error text. */
export function useErrorMessage() {
  const t = useTranslations("Documents");
  return (error: AppError): string => {
    switch (error.kind) {
      case "invalid_input":
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
          case "encrypted":
            return t("errorEncrypted");
          case "too_short":
            return t("errorTooShort");
          case "too_long":
            return t("errorTooLong");
        }
        return t("errorGeneric");
      case "page_limit":
        return t("errorPageLimit", { max: error.max });
      case "file_too_large":
        return t("errorFileLimit", { max: Math.round(error.maxBytes / (1024 * 1024)) });
      case "captcha_failed":
        return t("errorCaptcha");
      case "rate_limited":
        return t("errorRateLimited");
      default:
        return t("errorGeneric");
    }
  };
}
