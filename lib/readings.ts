import { connectDb } from "@/lib/db";
import type { IngestInput } from "@/lib/ingest";
import { Reading } from "@/models/Reading";
import "@/models/Sheet";
import type { PublicReading, ReadingView } from "@/lib/types";

type ReadingLike = {
  _id: { toString(): string };
  deviceName: string;
  sensorName: string;
  temperature: number;
  humidity: number;
  locationName: string;
  latitude: number;
  longitude: number;
  receivedAt: Date;
};

export function toReadingView(doc: ReadingLike): ReadingView {
  return {
    id: doc._id.toString(),
    deviceName: doc.deviceName,
    sensorName: doc.sensorName,
    temperature: doc.temperature,
    humidity: doc.humidity,
    locationName: doc.locationName,
    latitude: doc.latitude,
    longitude: doc.longitude,
    receivedAt: doc.receivedAt.toISOString(),
  };
}

export async function listSheetReadings(sheetId: string, limit = 100) {
  await connectDb();
  const docs = await Reading.find({ sheetId }).sort({ receivedAt: -1 }).limit(limit);
  return docs.map((doc) => toReadingView(doc));
}

export async function listPublicReadings(limit = 100): Promise<PublicReading[]> {
  await connectDb();
  const docs = await Reading.find().sort({ receivedAt: -1 }).limit(limit).populate("sheetId", "name");
  return docs.map((doc) => {
    const sheet = doc.sheetId as unknown as { name?: string } | null;
    return {
      ...toReadingView(doc),
      sheetName: sheet?.name ?? "알 수 없는 시트",
    };
  });
}

export async function createReading(sheetId: string, input: IngestInput) {
  await connectDb();
  const doc = await Reading.create({
    sheetId,
    deviceName: input.deviceName,
    sensorName: input.sensorName,
    temperature: input.temperature,
    humidity: input.humidity,
    locationName: input.locationName,
    latitude: input.latitude,
    longitude: input.longitude,
    location: {
      type: "Point",
      coordinates: [input.longitude, input.latitude],
    },
    receivedAt: new Date(),
  });
  return toReadingView(doc);
}
