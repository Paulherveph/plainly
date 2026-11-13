import { container } from "@/server/container";
import { log } from "@/shared/lib/log";

export const maxDuration = 60;

/** E11: "Export my data" as a zip of JSON plus the original files. Never cached. */
export async function GET() {
  const c = await container();
  const user = await c.currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const zip = await c.exportData(user.id);
  if (!zip.ok) {
    log("account.export_failed", { kind: zip.error.kind });
    return Response.json({ error: zip.error.kind }, { status: 500 });
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(zip.value, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="plainly-export-${date}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
