import { Suspense, ViewTransition } from "react";

/** Suspense whose skeleton fades out and whose content fades and rises in (globals.css). */
export function RevealSuspense({
  fallback,
  children,
}: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="skeleton-out" default="none">
          {fallback}
        </ViewTransition>
      }
    >
      <ViewTransition enter="content-in" default="none">
        {children}
      </ViewTransition>
    </Suspense>
  );
}
