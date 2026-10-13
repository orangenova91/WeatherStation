export type IngestInput = {
  senderName: string;
  deviceName: string;
  sensorName: string;
  temperature: number;
  humidity: number;
  locationName: string;
  latitude: number;
  longitude: number;
};

function readText(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false as const, error: `${label} 값이 필요합니다.` };
  }
  const text = value.trim();
  if (text.length > max) {
    return { ok: false as const, error: `${label}은 ${max}자 이하여야 합니다.` };
  }
  return { ok: true as const, value: text };
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function parseIngestBody(
  body: unknown,
): { ok: true; value: IngestInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "JSON 본문이 필요합니다." };
  }

  const data = body as Record<string, unknown>;
  const senderName = readText(data.senderName, "발신자명", 80);
  if (!senderName.ok) return senderName;
  const deviceName = readText(data.deviceName, "기기명", 80);
  if (!deviceName.ok) return deviceName;
  const sensorName = readText(data.sensorName, "센서명", 80);
  if (!sensorName.ok) return sensorName;
  const locationName = readText(data.locationName, "위치명", 120);
  if (!locationName.ok) return locationName;

  const temperature = readNumber(data.temperature);
  const humidity = readNumber(data.humidity);
  const latitude = readNumber(data.latitude);
  const longitude = readNumber(data.longitude);
  if (temperature === null || humidity === null || latitude === null || longitude === null) {
    return { ok: false, error: "온도, 습도, 위도, 경도는 숫자여야 합니다." };
  }
  if (latitude < -90 || latitude > 90) {
    return { ok: false, error: "위도는 -90에서 90 사이여야 합니다." };
  }
  if (longitude < -180 || longitude > 180) {
    return { ok: false, error: "경도는 -180에서 180 사이여야 합니다." };
  }

  return {
    ok: true,
    value: {
      senderName: senderName.value,
      deviceName: deviceName.value,
      sensorName: sensorName.value,
      temperature,
      humidity,
      locationName: locationName.value,
      latitude,
      longitude,
    },
  };
}
