"use client";

import { CalendarPlusIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { addDeadlineFromActionAction } from "@/server/actions/deadlines";
import { Button } from "@/shared/ui/button";
import type { OutputLocale } from "../domain/analysis";

/** B03/B04: the document gives a rule or an unclear date; the reader picks the real date. */
export function RuleDate(props: {
  documentId: string;
  locale: OutputLocale;
  index: number;
  rule: string | null;
  ambiguous: boolean;
}) {
  const t = useTranslations("Analysis");
  const id = useId();
  const [date, setDate] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await addDeadlineFromActionAction({
        documentId: props.documentId,
        locale: props.locale,
        index: props.index,
        dueOn: date,
      });
      if (res.ok) setSaved(true);
      else toast.error(t("ruleDateFailed"));
    });

  return (
    <div className="mt-2.5 grid gap-2 rounded-lg border border-dashed p-2.5">
      <p className="text-muted-foreground text-[13px]">
        {props.ambiguous ? t("dateAmbiguous", { date: props.rule ?? "" }) : t("dueRule", { rule: props.rule ?? "" })}
      </p>
      {saved ? (
        <p className="inline-flex items-center gap-1.5 text-ok text-[13px]">
          <CheckIcon className="size-3.5" aria-hidden="true" />
          {t("ruleDateSaved")}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="sr-only">
            {t("ruleDateLabel")}
          </label>
          <input
            id={id}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-brand"
          />
          <Button size="sm" variant="outline" disabled={!date || pending} onClick={save}>
            <CalendarPlusIcon />
            {t("ruleDateAdd")}
          </Button>
        </div>
      )}
    </div>
  );
}
