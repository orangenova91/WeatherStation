"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MapPlaceholder } from "@/components/map-placeholder";
import type { PublicReading } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), {
  ssr: false,
  loading: () => <MapPlaceholder loading />,
});

const REFRESH_MS = 20000;

export function SharedMap({ initialReadings }: { initialReadings: PublicReading[] }) {
  const [readings, setReadings] = useState(initialReadings);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/public/readings");
        if (!response.ok) return;
        const data = (await response.json()) as { readings?: PublicReading[] };
        if (!cancelled && data.readings) setReadings(data.readings);
      } catch {
        // 직전 마커를 유지한다.
      }
    }

    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return <MapCanvas readings={readings} />;
}
