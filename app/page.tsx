import { Suspense } from "react";
import { connection } from "next/server";
import { HomeIntro } from "@/components/home-intro";
import { MapPlaceholder } from "@/components/map-placeholder";
import { PlatformFrame } from "@/components/platform-frame";
import { SharedMap } from "@/components/shared-map";
import { listPublicMapData } from "@/lib/readings";
import type { PublicMapStats, PublicReading } from "@/lib/types";

export default function HomePage() {
  return (
    <PlatformFrame>
      <div className="flex flex-1 flex-col gap-4">
        <HomeIntro />
        <Suspense fallback={<MapPlaceholder loading />}>
          <HomeMap />
        </Suspense>
      </div>
    </PlatformFrame>
  );
}

async function HomeMap() {
  await connection();
  let readings: PublicReading[] | null = null;
  let stats: PublicMapStats | null = null;
  try {
    const data = await listPublicMapData();
    readings = data.readings;
    stats = data.stats;
  } catch (error) {
    console.error(error);
  }
  if (!readings || !stats) return <MapPlaceholder offline />;
  return <SharedMap initialReadings={readings} initialStats={stats} />;
}
