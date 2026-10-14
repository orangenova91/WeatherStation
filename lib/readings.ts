import { connectDb } from "@/lib/db";
import type { IngestInput } from "@/lib/ingest";
import { Reading } from "@/models/Reading";
import "@/models/Sheet";
import type { PublicReading, ReadingView } from "@/lib/types";

type ReadingLike = {
  _id: { toString(): string };
  senderName?: string;
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
    senderName: doc.senderName ?? "",
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

export async function countSheetReadings(sheetId: string) {
  await connectDb();
  return Reading.countDocuments({ sheetId });
}

export async function listAllSheetReadings(sheetId: string) {
  await connectDb();
  const docs = await Reading.find({ sheetId }).sort({ receivedAt: -1 }).lean();
  return docs.map((doc) => toReadingView(doc));
}

type LatestPublicReading = ReadingLike & {
  sheet?: Array<{ name?: string }>;
};

export async function listPublicReadings(limit = 200): Promise<PublicReading[]> {
  await connectDb();
  const docs = await Reading.aggregate<LatestPublicReading>([
    { $sort: { receivedAt: -1 } },
    {
      $group: {
        _id: {
          sheetId: "$sheetId",
          senderName: "$senderName",
          deviceName: "$deviceName",
          locationName: "$locationName",
        },
        doc: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$doc" } },
    { $sort: { receivedAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "sheets",
        localField: "sheetId",
        foreignField: "_id",
        as: "sheet",
      },
    },
  ]);

  return docs.map((doc) => ({
    ...toReadingView(doc),
    sheetName: doc.sheet?.[0]?.name ?? "알 수 없는 시트",
  }));
}

export async function createReading(sheetId: string, input: IngestInput) {
  await connectDb();
  const doc = await Reading.create({
    sheetId,
    senderName: input.senderName,
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
