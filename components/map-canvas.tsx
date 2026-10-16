"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicMapStats, PublicReading } from "@/lib/types";
import { formatReceivedAt, viewerTimeZone } from "@/lib/time";

const freshWindowMs = 60 * 60 * 1000;

function isFresh(receivedAt: string) {
  const received = new Date(receivedAt).getTime();
  return Number.isFinite(received) && Date.now() - received <= freshWindowMs;
}

function stationIcon(fresh: boolean) {
  const background = fresh ? "#d89a2b" : "#9aa6ae";
  const halo = fresh ? "rgba(216,154,43,.35)" : "rgba(154,166,174,.45)";
  return L.divIcon({
    className: "station-marker",
    html: `<span class="station-marker-dot" style="display:block;box-sizing:border-box;width:18px;height:18px;border-radius:999px;background:${background};border:2px solid #12202a;box-shadow:0 0 0 4px ${halo}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -14],
  });
}

const koreaCenter: L.LatLngExpression = [36.4, 127.8];
const popupStyleId = "station-popup-style";

const popupCss = `
.station-popup .leaflet-popup-content-wrapper {
  background: #fffdf8;
  color: #1c2830;
  border: 1px solid #e3dbd0;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(18, 32, 42, 0.16);
  padding: 0;
}
.station-popup .leaflet-popup-content {
  margin: 0;
  width: 260px !important;
  font-family: "Noto Sans KR", sans-serif;
  line-height: 1.4;
}
.station-popup .leaflet-popup-content p {
  margin: 0;
}
.station-popup .leaflet-popup-tip {
  background: #fffdf8;
  border: 1px solid #e3dbd0;
  box-shadow: none;
}
.station-popup .leaflet-popup-close-button {
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  padding: 0;
  font: 16px/20px "Noto Sans KR", sans-serif;
  color: #5d6b74;
  border-radius: 999px;
}
.station-popup .leaflet-popup-close-button:hover {
  color: #1c2830;
  background: #f3efe6;
}
.station-popup-card { padding: 14px 36px 12px 16px; }
.station-popup-facts {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.station-popup-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.station-popup-key {
  flex: none;
  margin: 0;
  color: #5d6b74;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
}
.station-popup-val {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  text-align: right;
  overflow-wrap: anywhere;
}
`;

function ensurePopupStyle() {
  let style = document.getElementById(popupStyleId);
  if (!style) {
    style = document.createElement("style");
    style.id = popupStyleId;
    document.head.appendChild(style);
  }
  style.textContent = popupCss;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


function formatMeasure(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCoord(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  }).format(value);
}

function stationKey(reading: PublicReading) {
  return `${reading.sheetName}|${reading.senderName}|${reading.deviceName}|${reading.locationName}`;
}

function popupRow(label: string, value: string) {
  return `<div class="station-popup-row"><span class="station-popup-key">${label}</span><span class="station-popup-val">${value}</span></div>`;
}

function popupHtml(reading: PublicReading) {
  return `<div class="station-popup-card">
    <div class="station-popup-facts">
      ${popupRow("Sheet Name", escapeHtml(reading.sheetName))}
      ${popupRow("Device Name", escapeHtml(reading.deviceName))}
      ${popupRow("Sensor Name", escapeHtml(reading.sensorName))}
      ${popupRow("Location Name", escapeHtml(reading.locationName))}
      ${popupRow("Lat", formatCoord(reading.latitude))}
      ${popupRow("Lon", formatCoord(reading.longitude))}
      ${popupRow("Temperature", `${formatMeasure(reading.temperature)}°C`)}
      ${popupRow("Humidity", `${formatMeasure(reading.humidity)}%`)}
      ${popupRow("Received", escapeHtml(formatReceivedAt(reading.receivedAt, true, viewerTimeZone())))}
      ${popupRow("Sender Name", escapeHtml(reading.senderName))}
    </div>
  </div>`;
}

type MapCanvasProps = {
  readings: PublicReading[];
  stats?: PublicMapStats;
  scrollZoom?: "always" | "click";
};

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default function MapCanvas({ readings, stats, scrollZoom = "always" }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const placeKeyRef = useRef("");
  const scrollZoomRef = useRef(scrollZoom);
  const [pointer, setPointer] = useState<{ lat: number; lng: number } | null>(null);
  const [wheelOn, setWheelOn] = useState(scrollZoom === "always");
  const markers = useMemo(
    () => readings.filter((reading) => Number.isFinite(reading.latitude) && Number.isFinite(reading.longitude)),
    [readings],
  );

  useEffect(() => {
    ensurePopupStyle();
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node || mapRef.current) return;

    ensurePopupStyle();
    const map = L.map(node, { scrollWheelZoom: scrollZoomRef.current === "always" }).setView(koreaCenter, 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(node);

    const onMouseMove = (event: L.LeafletMouseEvent) => {
      setPointer({ lat: event.latlng.lat, lng: event.latlng.lng });
    };
    const onMouseOut = () => {
      setPointer(null);
    };
    const enableWheel = () => {
      if (scrollZoomRef.current !== "click") return;
      map.scrollWheelZoom.enable();
      setWheelOn(true);
    };
    const disableWheel = () => {
      if (scrollZoomRef.current !== "click") return;
      map.scrollWheelZoom.disable();
      setWheelOn(false);
    };
    const container = map.getContainer();
    map.on("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseOut);
    if (scrollZoomRef.current === "click") {
      container.addEventListener("pointerdown", enableWheel);
      container.addEventListener("mouseleave", disableWheel);
    }

    return () => {
      map.off("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseOut);
      container.removeEventListener("pointerdown", enableWheel);
      container.removeEventListener("mouseleave", disableWheel);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      placeKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;

    group.clearLayers();
    for (const reading of markers) {
      L.marker([reading.latitude, reading.longitude], { icon: stationIcon(isFresh(reading.receivedAt)) })
        .bindPopup(popupHtml(reading), {
          className: "station-popup",
          autoPan: true,
          autoPanPadding: L.point(32, 32),
          minWidth: 260,
        })
        .addTo(group);
    }

    const placeKey = markers
      .map(
        (reading) =>
          `${stationKey(reading)}|${reading.latitude.toFixed(4)}|${reading.longitude.toFixed(4)}`,
      )
      .sort()
      .join(";");
    if (placeKey === placeKeyRef.current) return;
    placeKeyRef.current = placeKey;

    if (markers.length === 0) {
      map.setView(koreaCenter, 7);
      return;
    }
    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], 13);
      return;
    }
    map.fitBounds(
      L.latLngBounds(markers.map((reading) => [reading.latitude, reading.longitude] as [number, number])),
      { padding: [48, 48], maxZoom: 13 },
    );
  }, [markers]);

  const stationCount = stats?.stationCount ?? markers.length;
  const freshStationCount =
    stats?.freshStationCount ?? markers.filter((reading) => isFresh(reading.receivedAt)).length;
  const lastReceivedAt =
    stats?.lastReceivedAt ??
    markers.reduce<string | null>((latest, reading) => {
      if (!latest || reading.receivedAt > latest) return reading.receivedAt;
      return latest;
    }, null);

  return (
    <section className="relative min-h-[28rem] flex-1 overflow-hidden rounded-2xl border border-line">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute top-4 right-4 z-[500] flex max-w-[min(100%-5.5rem,22rem)] flex-col items-end gap-2">
        {stats ? (
          <div className="w-full rounded-2xl border border-line bg-card px-3 py-2 text-xs text-muted shadow-sm">
            <p className="font-medium text-ink">관측 현황</p>
            <p className="mt-1.5 leading-5">
              전체 관측 {formatCount(stats.totalReadings)}회
              <span className="mx-1.5 opacity-40">·</span>
              지점 {formatCount(stationCount)}곳
              <span className="mx-1.5 opacity-40">·</span>
              활성 {formatCount(freshStationCount)}곳
            </p>
            <p className="mt-1 leading-5">
              {lastReceivedAt
                ? `마지막 수신 ${formatReceivedAt(lastReceivedAt, false, viewerTimeZone())}`
                : "아직 수신된 관측이 없습니다."}
            </p>
            <p className="mt-1 text-[11px] opacity-80">약 20초마다 자동 갱신</p>
          </div>
        ) : (
          <div className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
            {markers.length === 0 ? "아직 수신된 좌표가 없습니다." : `관측 지점 ${markers.length}곳`}
          </div>
        )}
        <div className="rounded-2xl border border-line bg-card px-3 py-2 text-xs text-muted">
          <p className="mb-1.5 font-medium text-ink">마커 색</p>
          <p className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: "#d89a2b", boxShadow: "0 0 0 2px #12202a" }}
            />
            1시간 이내 수신
          </p>
          <p className="mt-1.5 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: "#9aa6ae", boxShadow: "0 0 0 2px #12202a" }}
            />
            1시간 넘게 없음
          </p>
        </div>
      </div>
      {scrollZoom === "click" && !wheelOn ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
          클릭 후에 휠로 확대 할 수 있습니다.
        </div>
      ) : null}
      {pointer ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-full border border-line bg-card px-3 py-1 font-mono text-xs text-ink">
          Lat {formatCoord(pointer.lat)} · Lon {formatCoord(pointer.lng)}
        </div>
      ) : null}
    </section>
  );
}
