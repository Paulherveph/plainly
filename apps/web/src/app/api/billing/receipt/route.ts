import { getFormatter, getTranslations } from "next-intl/server";
import { container } from "@/server/container";

/**
 * The signed-in user's latest receipt as a PDF, built from our own records. The built-in PDF fonts
 * are Latin-1 only, so Chinese receipts are printed in English.
 */
export async function GET(request: Request) {
  const c = await container();
  if (!(await c.currentUser())) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const res = await c.latestReceipt();
  if (!res.ok) return Response.json({ error: res.error.kind }, { status: 500 });
  const receipt = res.value;
  if (!receipt) return Response.json({ error: "not_found" }, { status: 404 });

  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en";
  const t = await getTranslations({ locale, namespace: "Billing" });
  const format = await getFormatter({ locale });
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long", timeZone: "UTC" });
  const amount = format.number(receipt.amountCents / 100, {
    style: "currency",
    currency: receipt.currency.toUpperCase(),
  });
  const credits =
    receipt.kind === "pack"
      ? t("creditsOnce", { count: receipt.credits })
      : t("creditsMonthly", { count: receipt.credits });
  const rows: [string, string][] = [
    [t("summaryPlan"), t(`plan_${receipt.productId}`)],
    [t("summaryBilling"), t(`billed_${receipt.interval}`)],
    [t("summaryCredits"), credits],
  ];
  if (receipt.periodEnd) rows.push([t("summaryRenews"), date(receipt.periodEnd)]);
  rows.push([t("summaryPayment"), receipt.demo ? t("summaryDemo") : amount]);

  const pdf = c.receiptPdf({
    brand: "Plainly",
    title: t("receiptTitle", { number: receipt.number }),
    subtitle: t("receiptIssued", { date: date(receipt.issuedAt) }),
    rows,
    total: [t("total"), amount],
    note: [receipt.demo ? t("receiptDemoNote") : "", t("receiptFooter")].filter(Boolean).join("  "),
  });
  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="plainly-receipt-${receipt.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
