"use client";

import { useCallback, useSyncExternalStore } from "react";

function supported(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Matches a CSS media query from React. Server rendering and hydration report
 * `false`, so anything gated on it mounts on the client rather than mismatching.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => (supported() ? window.matchMedia(query).matches : false), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
