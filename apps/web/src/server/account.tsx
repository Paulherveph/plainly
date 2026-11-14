import { CreditMeter } from "@/modules/billing/ui/credit-meter";
import { AccountButton } from "@/shared/ui/account-button";
import { container } from "./container";

/** Streams in behind a Suspense boundary: it reads the session cookie. Credits show once a user exists. */
export async function Account() {
  const c = await container();
  const user = await c.currentUser();
  const balance = user ? await c.entitlements.balance() : null;
  return (
    <span className="inline-flex items-center gap-2">
      {balance?.ok ? <CreditMeter balance={balance.value} /> : null}
      <AccountButton
        email={user && !user.isAnonymous ? user.email : null}
        isGuest={Boolean(user?.isAnonymous)}
      />
    </span>
  );
}
