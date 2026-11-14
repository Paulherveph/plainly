"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * next-themes renders an inline <script> that sets the theme class before first paint. It only
 * runs from the server HTML. When the provider mounts on the client instead (a locale switch or
 * an error boundary remounts the layout), React warns about the script tag. Marking it as a
 * data block there silences the warning and changes nothing: the theme is already applied.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const clientMount = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      scriptProps={clientMount ? { type: "application/json" } : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
