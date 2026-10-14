"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReadingChart } from "@/components/reading-chart";
import { useViewerTimeZone } from "@/components/use-viewer-time-zone";
import { formatReceivedAt } from "@/lib/time";
import { formatIngestToken } from "@/lib/tokens";
import { EXAMPLE_READING, type PublicReading, type ReadingView } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-2xl border border-line bg-[#e7f0ea] text-sm text-muted">
      지도를 불러오는 중…
    </div>
  ),
});

type SheetLiveProps = {
  sheetId: string;
  name: string;
  ingestToken: string;
  initialReadings: ReadingView[];
  initialTotal: number;
};

type LiveStatus = "connecting" | "live" | "reconnecting";
type ReadingViewMode = "table" | "chart";

function formatMeasure(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function stationKey(reading: ReadingView) {
  return `${reading.senderName}|${reading.deviceName}|${reading.locationName}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function SheetLive({ sheetId, name, ingestToken, initialReadings, initialTotal }: SheetLiveProps) {
  const [token, setToken] = useState(ingestToken);
  const [readings, setReadings] = useState(initialReadings);
  const [total, setTotal] = useState(initialTotal);
  const seenIds = useRef(new Set(initialReadings.map((reading) => reading.id)));
  const [freshId, setFreshId] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [view, setView] = useState<ReadingViewMode>("table");
  const [stationFilter, setStationFilter] = useState("all");
  const timeZone = useViewerTimeZone();
  const displayToken = formatIngestToken(token);
  const example = useMemo(() => JSON.stringify(EXAMPLE_READING, null, 2), []);
  const stations = useMemo(() => {
    const seen = new Set<string>();
    const latest: PublicReading[] = [];
    for (const reading of readings) {
      const key = stationKey(reading);
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push({ ...reading, sheetName: name });
    }
    return latest;
  }, [readings, name]);
  const chartReadings = useMemo(() => {
    if (stationFilter === "all") return readings;
    return readings.filter((reading) => stationKey(reading) === stationFilter);
  }, [readings, stationFilter]);

  useEffect(() => {
    if (stationFilter === "all") return;
    if (stations.some((station) => stationKey(station) === stationFilter)) return;
    setStationFilter("all");
  }, [stationFilter, stations]);

  useEffect(() => {
    const source = new EventSource(`/api/sheets/${sheetId}/stream`);
    source.onopen = () => setStatus("live");
    source.onmessage = (event) => {
      const reading = JSON.parse(event.data) as ReadingView;
      setFreshId(reading.id);
      if (!seenIds.current.has(reading.id)) {
        seenIds.current.add(reading.id);
        setTotal((count) => count + 1);
      }
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
    if (!window.confirm("토큰을 재발급하면 기존 토큰은 바로 막힙니다. 계속할까요?")) return;
    setError("");
    const response = await fetch(`/api/sheets/${sheetId}/rotate-token`, { method: "POST" });
    const data = (await response.json()) as { error?: string; ingestToken?: string };
    if (!response.ok || !data.ingestToken) {
      setError(data.error ?? "토큰을 재발급하지 못했습니다.");
      return;
    }
    setToken(data.ingestToken);
  }

  async function reload() {
    const response = await fetch(`/api/sheets/${sheetId}/readings`);
    const data = (await response.json()) as { error?: string; readings?: ReadingView[]; total?: number };
    if (!response.ok || !data.readings || typeof data.total !== "number") {
      setError(data.error ?? "수신 기록을 불러오지 못했습니다.");
      return;
    }
    for (const reading of data.readings) seenIds.current.add(reading.id);
    setReadings(data.readings);
    setTotal(data.total);
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

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-base font-medium">송신 토큰</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            ESP32 설정 화면의 Token 칸에 이 토큰만 넣으면 아래 표에 쌓입니다.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs">
              {displayToken}
            </code>
            <button
              type="button"
              onClick={() => copy("token", displayToken)}
              className="rounded-md bg-sidebar px-3 py-2 text-sm text-white"
            >
              {copied === "token" ? "복사됨" : "토큰 복사"}
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
              토큰 재발급
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </section>
        <div className="flex h-full min-h-[28rem] flex-col">
          <MapCanvas readings={stations} scrollZoom="click" />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium">수신 기록</h2>
            <p className="text-sm text-muted">total: {formatCount(total)}건</p>
            <a
              href={`/api/sheets/${sheetId}/export?timeZone=${encodeURIComponent(timeZone)}`}
              className="rounded-md border border-line px-3 py-1 text-sm"
            >
              CSV 받기
            </a>
            <p className="text-sm text-muted">아래 표에는 최신 100건만 표시됩니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === "chart" && stations.length > 1 ? (
              <label className="flex items-center gap-2 text-sm text-muted">
                관측소
                <select
                  value={stationFilter}
                  onChange={(event) => setStationFilter(event.target.value)}
                  className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none"
                >
                  <option value="all">전체</option>
                  {stations.map((station) => (
                    <option key={stationKey(station)} value={stationKey(station)}>
                      {station.locationName} · {station.deviceName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div role="group" aria-label="수신 기록 보기" className="flex rounded-md border border-line p-0.5 text-sm">
              <button
                type="button"
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
                className={`rounded px-3 py-1 ${view === "table" ? "bg-sidebar text-white" : "text-muted"}`}
              >
                표
              </button>
              <button
                type="button"
                aria-pressed={view === "chart"}
                onClick={() => setView("chart")}
                className={`rounded px-3 py-1 ${view === "chart" ? "bg-sidebar text-white" : "text-muted"}`}
              >
                그래프
              </button>
            </div>
          </div>
        </div>
        {readings.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">아직 수신된 값이 없습니다.</p>
        ) : view === "chart" ? (
          <ReadingChart readings={chartReadings} timeZone={timeZone} />
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
                    <td className="px-4 py-3 font-mono text-xs">{formatReceivedAt(reading.receivedAt, true, timeZone)}</td>
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
