"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MapPlaceholder } from "@/components/map-placeholder";
import type { PublicMapStats, PublicReading } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), {
  ssr: false,
  loading: () => <MapPlaceholder loading />,
});

const REFRESH_MS = 20000;

export function SharedMap({
  initialReadings,
  initialStats,
}: {
  initialReadings: PublicReading[];
  initialStats: PublicMapStats;
}) {
  const [readings, setReadings] = useState(initialReadings);
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/public/readings");
        if (!response.ok) return;
        const data = (await response.json()) as {
          readings?: PublicReading[];
          stats?: PublicMapStats;
        };
        if (cancelled) return;
        if (data.readings) setReadings(data.readings);
        if (data.stats) setStats(data.stats);
      } catch {
        // 직전 마커·통계를 유지한다.
      }
    }

    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return <MapCanvas readings={readings} stats={stats} />;
}
