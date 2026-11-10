import "server-only";
import { SupabaseExpiredDocuments } from "@/modules/documents/infrastructure/supabase-expired-documents";
import { SupabaseFileStore } from "@/modules/documents/infrastructure/supabase-file-store";
import { createSupabaseAdmin } from "./supabase-admin";

/** Composition for the retention job (service client). */
export function retentionDeps() {
  const admin = createSupabaseAdmin();
  if (!admin) return null;
  return {
    expired: new SupabaseExpiredDocuments(admin),
    files: new SupabaseFileStore(admin),
    now: () => new Date(),
  };
}
