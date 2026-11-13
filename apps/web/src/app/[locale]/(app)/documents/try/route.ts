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
  // No user yet: the documents page starts the sample after the guest check (E01).
  if (!user) {
    fallback.searchParams.set("sample", sample);
    return NextResponse.redirect(fallback, 303);
  }
  const created = await c.uploadDocument({ userId: user.id, source: "sample", sampleId: sample });
  if (!created.ok) return NextResponse.redirect(fallback);
  return NextResponse.redirect(
    new URL(`/${locale}/documents/${created.value.id}`, request.nextUrl.origin),
    303,
  );
}
