import { connectDb } from "@/lib/db";
import type { IngestInput } from "@/lib/ingest";
import { Reading } from "@/models/Reading";
import { Sheet } from "@/models/Sheet";
import type { PublicMapStats, PublicReading, ReadingView, SheetSummary } from "@/lib/types";
import mongoose from "mongoose";

/** 공유 지도에 올리는 시트. sharedOnMap이 없거나 true인 기존 문서 포함 */
export async function listSharedSheetIds() {
  await connectDb();
  return Sheet.find({ sharedOnMap: { $ne: false } }).distinct("_id");
}

export const FRESH_WINDOW_MS = 60 * 60 * 1000;

function buildPublicMapStats(readings: PublicReading[], totalReadings: number): PublicMapStats {
  const stations = readings.filter(
    (reading) => Number.isFinite(reading.latitude) && Number.isFinite(reading.longitude),
  );
  const now = Date.now();
  let lastReceivedAt: string | null = null;
  let freshStationCount = 0;

  for (const reading of stations) {
    const received = new Date(reading.receivedAt).getTime();
    if (Number.isFinite(received) && now - received <= FRESH_WINDOW_MS) {
      freshStationCount += 1;
    }
    if (!lastReceivedAt || reading.receivedAt > lastReceivedAt) {
      lastReceivedAt = reading.receivedAt;
    }
  }

  return {
    totalReadings,
    stationCount: stations.length,
    freshStationCount,
    lastReceivedAt,
  };
}

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
  const sharedSheetIds = await listSharedSheetIds();
  if (sharedSheetIds.length === 0) return [];

  const docs = await Reading.aggregate<LatestPublicReading>([
    { $match: { sheetId: { $in: sharedSheetIds } } },
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

export async function listPublicMapData(limit = 200): Promise<{
  readings: PublicReading[];
  stats: PublicMapStats;
}> {
  await connectDb();
  const sharedSheetIds = await listSharedSheetIds();
  const [readings, totalReadings] = await Promise.all([
    listPublicReadings(limit),
    sharedSheetIds.length === 0
      ? Promise.resolve(0)
      : Reading.countDocuments({ sheetId: { $in: sharedSheetIds } }),
  ]);
  return {
    readings,
    stats: buildPublicMapStats(readings, totalReadings),
  };
}

type SheetReadingAgg = {
  _id: mongoose.Types.ObjectId;
  totalReadings: number;
  lastReceivedAt: Date;
  locationNames: string[];
};

/** 소유자 시트 목록용: 시트별 관측 요약(건수·위치명·마지막 수신·활성) */
export async function attachSheetReadingSummaries(
  sheets: Array<{ id: string; name: string; createdAt: string; sharedOnMap: boolean }>,
): Promise<SheetSummary[]> {
  if (sheets.length === 0) return [];

  await connectDb();
  const objectIds = sheets
    .map((sheet) => sheet.id)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const rows =
    objectIds.length === 0
      ? []
      : await Reading.aggregate<SheetReadingAgg>([
          { $match: { sheetId: { $in: objectIds } } },
          {
            $group: {
              _id: "$sheetId",
              totalReadings: { $sum: 1 },
              lastReceivedAt: { $max: "$receivedAt" },
              locationNames: { $addToSet: "$locationName" },
            },
          },
        ]);

  const byId = new Map(
    rows.map((row) => [
      row._id.toString(),
      {
        totalReadings: row.totalReadings,
        lastReceivedAt: row.lastReceivedAt.toISOString(),
        locationNames: row.locationNames.filter((name) => name.trim().length > 0).sort((a, b) => a.localeCompare(b, "ko")),
      },
    ]),
  );

  const now = Date.now();
  return sheets.map((sheet) => {
    const summary = byId.get(sheet.id);
    const lastReceivedAt = summary?.lastReceivedAt ?? null;
    const receivedMs = lastReceivedAt ? new Date(lastReceivedAt).getTime() : NaN;
    const isFresh = Number.isFinite(receivedMs) && now - receivedMs <= FRESH_WINDOW_MS;
    return {
      ...sheet,
      totalReadings: summary?.totalReadings ?? 0,
      locationNames: summary?.locationNames ?? [],
      lastReceivedAt,
      isFresh,
    };
  });
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
