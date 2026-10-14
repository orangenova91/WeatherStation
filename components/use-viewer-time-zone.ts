"use client";

import { useSyncExternalStore } from "react";
import { viewerTimeZone } from "@/lib/time";

export function useViewerTimeZone() {
  return useSyncExternalStore(
    () => () => {},
    viewerTimeZone,
    () => "UTC",
  );
}
