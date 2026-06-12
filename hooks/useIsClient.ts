"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only after client mount (server snapshot = false). No setState-in-effect. */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
