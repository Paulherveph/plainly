import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False in the server HTML and during hydration, true once React has attached its handlers.
 * Disable controls with it when a click before that moment would be lost.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
