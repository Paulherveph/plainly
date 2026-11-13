import { ViewTransition } from "react";

/**
 * Templates remount on every navigation, so this one wrapper gives every page the same
 * enter/exit motion (fade + small rise). Header and footer are named elsewhere, so they stay put.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
