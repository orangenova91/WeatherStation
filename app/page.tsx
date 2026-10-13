import { Suspense } from "react";
import { connection } from "next/server";
import { MapPlaceholder } from "@/components/map-placeholder";
import { PlatformFrame } from "@/components/platform-frame";
import { listPublicReadings } from "@/lib/readings";

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
  let count = 0;
  let offline = false;
  try {
    const readings = await listPublicReadings();
    count = readings.length;
  } catch (error) {
    console.error(error);
    offline = true;
  }
  if (offline) return <MapPlaceholder offline />;
  return <MapPlaceholder count={count} />;
}
