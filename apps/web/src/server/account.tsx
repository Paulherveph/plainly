import { AccountButton } from "@/shared/ui/account-button";
import { createSupabase, getSessionUser } from "./supabase";

/** Streams in behind a Suspense boundary: it reads the session cookie. */
export async function Account() {
  const user = await getSessionUser(await createSupabase());
  return <AccountButton email={user && !user.isAnonymous ? user.email : null} />;
}
