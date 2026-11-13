import { type NextRequest, NextResponse } from "next/server";
import { titleFromFilename } from "@/modules/documents/domain/document";
import { container } from "@/server/container";
import { log } from "@/shared/lib/log";

/**
 * H10: the installed app accepts a shared PDF or photo (manifest share_target). A signed-in user
 * or an existing guest gets the analysis page; without a session the documents page opens, because
 * a new guest needs the Turnstile check first (E01).
 */
export async function POST(request: NextRequest) {
  const lang = request.headers.get("accept-language")?.slice(0, 2);
  const locale = lang === "fr" || lang === "zh" ? lang : "en";
  const fallback = new URL(`/${locale}/documents`, request.nextUrl.origin);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.redirect(fallback, 303);

  const c = await container();
  const user = await c.currentUser();
  if (!user) return NextResponse.redirect(fallback, 303);
  const created = await c.uploadDocument({
    userId: user.id,
    source: "file",
    title: titleFromFilename(file.name, "Document"),
    mediaType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  log("document.shared", { ok: created.ok });
  if (!created.ok) return NextResponse.redirect(fallback, 303);
  return NextResponse.redirect(new URL(`/${locale}/documents/${created.value.id}`, request.nextUrl.origin), 303);
}
