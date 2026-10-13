import { Suspense } from "react";
import { connection } from "next/server";
import { MapPlaceholder } from "@/components/map-placeholder";
import { PlatformFrame } from "@/components/platform-frame";
import { SharedMap } from "@/components/shared-map";
import { listPublicReadings } from "@/lib/readings";
import type { PublicReading } from "@/lib/types";

export default function HomePage() {
  return (
    <PlatformFrame>
      <Suspense fallback={<MapPlaceholder loading />}>
        <HomeMap />
      </Suspense>
    </PlatformFrame>
  );
}

async function HomeMap() {
  await connection();
  let readings: PublicReading[] | null = null;
  try {
    readings = await listPublicReadings();
  } catch (error) {
    console.error(error);
  }
  if (!readings) return <MapPlaceholder offline />;
  return <SharedMap initialReadings={readings} />;
}
