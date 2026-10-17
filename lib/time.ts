export function viewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function resolveTimeZone(value: string | null) {
  if (!value || value.length > 100) return "UTC";
  try {
    Intl.DateTimeFormat("ko-KR", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

function offsetLabel(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const zoned = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  const minutes = Math.round((zoned - date.getTime()) / 60000);
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  return remainder === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(remainder).padStart(2, "0")}`;
}

export function formatReceivedAt(value: string | number, withSeconds = true, timeZone = "UTC") {
  const date = new Date(value);
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hourCycle: "h23",
  })
    .format(date)
    .replace(/\s+/g, "");
  return `${formatted} ${offsetLabel(date, timeZone)}`;
}
