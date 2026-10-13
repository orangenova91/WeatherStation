"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { EXAMPLE_READING, type ReadingView } from "@/lib/types";

type SheetLiveProps = {
  sheetId: string;
  name: string;
  ingestToken: string;
  initialReadings: ReadingView[];
};

type LiveStatus = "connecting" | "live" | "reconnecting";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatMeasure(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function SheetLive({ sheetId, name, ingestToken, initialReadings }: SheetLiveProps) {
  const [token, setToken] = useState(ingestToken);
  const [readings, setReadings] = useState(initialReadings);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const ingestUrl = `${origin}/api/ingest/${token}`;
  const example = useMemo(() => JSON.stringify(EXAMPLE_READING, null, 2), []);

  useEffect(() => {
    const source = new EventSource(`/api/sheets/${sheetId}/stream`);
    source.onopen = () => setStatus("live");
    source.onmessage = (event) => {
      const reading = JSON.parse(event.data) as ReadingView;
      setFreshId(reading.id);
      setReadings((current) => {
        if (current.some((item) => item.id === reading.id)) return current;
        return [reading, ...current].slice(0, 100);
      });
    };
    source.onerror = () => {
      setStatus("reconnecting");
    };
    return () => source.close();
  }, [sheetId]);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("복사하지 못했습니다.");
    }
  }

  async function rotateToken() {
    if (!window.confirm("송신 주소를 재발급하면 기존 주소는 바로 막힙니다. 계속할까요?")) return;
    setError("");
    const response = await fetch(`/api/sheets/${sheetId}/rotate-token`, { method: "POST" });
    const data = (await response.json()) as { error?: string; ingestToken?: string };
    if (!response.ok || !data.ingestToken) {
      setError(data.error ?? "송신 주소를 재발급하지 못했습니다.");
      return;
    }
    setToken(data.ingestToken);
  }

  async function reload() {
    const response = await fetch(`/api/sheets/${sheetId}/readings`);
    const data = (await response.json()) as { error?: string; readings?: ReadingView[] };
    if (!response.ok || !data.readings) {
      setError(data.error ?? "수신 기록을 불러오지 못했습니다.");
      return;
    }
    setReadings(data.readings);
  }

  const statusLabel =
    status === "live" ? "실시간 연결됨" : status === "connecting" ? "연결하는 중" : "다시 연결하는 중";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">{name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span className={`h-2 w-2 rounded-full ${status === "live" ? "bg-accent" : "bg-muted"}`} />
            {statusLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border border-line bg-card px-3 py-2 text-sm"
        >
          기록 다시 불러오기
        </button>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium">송신 주소</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          ESP32 등에서 이 주소로 JSON을 POST 하면 아래 표에 바로 쌓입니다. 주소의 토큰이 이 시트의 열쇠입니다.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs">
            {origin ? ingestUrl : `/api/ingest/${token}`}
          </code>
          <button
            type="button"
            onClick={() => copy("url", origin ? ingestUrl : `/api/ingest/${token}`)}
            className="rounded-md bg-sidebar px-3 py-2 text-sm text-white"
          >
            {copied === "url" ? "복사됨" : "주소 복사"}
          </button>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-paper p-3 font-mono text-xs leading-5">
          {example}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy("json", example)}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            {copied === "json" ? "복사됨" : "JSON 예시 복사"}
          </button>
          <button type="button" onClick={rotateToken} className="rounded-md border border-line px-3 py-2 text-sm">
            송신 주소 재발급
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-base font-medium">수신 기록</h2>
        </div>
        {readings.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">아직 수신된 값이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">수신 시각</th>
                  <th className="px-4 py-3 font-medium">기기명</th>
                  <th className="px-4 py-3 font-medium">센서명</th>
                  <th className="px-4 py-3 font-medium">온도</th>
                  <th className="px-4 py-3 font-medium">습도</th>
                  <th className="px-4 py-3 font-medium">위치명</th>
                  <th className="px-4 py-3 font-medium">위도</th>
                  <th className="px-4 py-3 font-medium">경도</th>
                  <th className="px-4 py-3 font-medium">발신자명</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => (
                  <tr
                    key={reading.id}
                    className={`border-t border-line ${reading.id === freshId ? "bg-accent/10" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{formatTime(reading.receivedAt)}</td>
                    <td className="px-4 py-3">{reading.deviceName}</td>
                    <td className="px-4 py-3">{reading.sensorName}</td>
                    <td className="px-4 py-3 font-mono">{formatMeasure(reading.temperature)} °C</td>
                    <td className="px-4 py-3 font-mono">{formatMeasure(reading.humidity)} %</td>
                    <td className="px-4 py-3">{reading.locationName}</td>
                    <td className="px-4 py-3 font-mono">{reading.latitude.toFixed(5)}</td>
                    <td className="px-4 py-3 font-mono">{reading.longitude.toFixed(5)}</td>
                    <td className="px-4 py-3">{reading.senderName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
