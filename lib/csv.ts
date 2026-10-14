import type { ReadingView } from "@/lib/types";
import { formatReceivedAt } from "@/lib/time";

const headers = ["수신 시각", "기기명", "센서명", "온도", "습도", "위치명", "위도", "경도", "발신자명"];

function formatCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : "";
}

function formatMeasure(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

function quoteCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvText(value: string) {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return quoteCell(guarded);
}

export function readingsToCsv(readings: ReadingView[], timeZone: string) {
  const lines = [
    headers.map(csvText).join(","),
    ...readings.map((reading) =>
      [
        csvText(formatReceivedAt(reading.receivedAt, true, timeZone)),
        csvText(reading.deviceName),
        csvText(reading.sensorName),
        quoteCell(formatMeasure(reading.temperature)),
        quoteCell(formatMeasure(reading.humidity)),
        csvText(reading.locationName),
        quoteCell(formatCoordinate(reading.latitude)),
        quoteCell(formatCoordinate(reading.longitude)),
        csvText(reading.senderName),
      ].join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function csvFilename(sheetName: string, date = new Date(), timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const stamp = `${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}`;
  const name = sheetName.trim() || "sheet";
  return `${name}-${stamp}.csv`;
}

export function attachmentDisposition(filename: string) {
  const cleaned = filename.replace(/[\r\n"]/g, "").replace(/[\\/:*?<>|]/g, "-").trim() || "readings.csv";
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii || "readings.csv"}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}
