import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/server/container";

const Sample = z.enum(["lease", "visa", "offer"]).catch("lease");
const Locale = z.enum(["en", "fr", "zh"]).catch("en");

/**
 * One-click "Try a sample" from the landing page: creates the sample document for the
 * (anonymous) user and opens its analysis. Linked with a plain <a>, never prefetched.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const locale = Locale.parse((await params).locale);
  const sample = Sample.parse(request.nextUrl.searchParams.get("sample"));
  const c = await container();
  const user = await c.currentUser();
  const fallback = new URL(`/${locale}/documents`, request.nextUrl.origin);
  if (!user) return NextResponse.redirect(fallback);
  const created = await c.uploadDocument({ userId: user.id, source: "sample", sampleId: sample });
  if (!created.ok) return NextResponse.redirect(fallback);
  return NextResponse.redirect(
    new URL(`/${locale}/documents/${created.value.id}`, request.nextUrl.origin),
    303,
  );
}
