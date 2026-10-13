"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicReading } from "@/lib/types";

const stationIcon = L.divIcon({
  className: "station-marker",
  html: '<span class="station-marker-dot" style="display:block;box-sizing:border-box;width:18px;height:18px;border-radius:999px;background:#d89a2b;border:2px solid #12202a;box-shadow:0 0 0 4px rgba(216,154,43,.35)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -14],
});

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

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
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
      ${popupRow("Sender Name", escapeHtml(reading.senderName))}
      ${popupRow("Sheet Name", escapeHtml(reading.sheetName))}
      ${popupRow("Device Name", escapeHtml(reading.deviceName))}
      ${popupRow("Sensor Name", escapeHtml(reading.sensorName))}
      ${popupRow("Location Name", escapeHtml(reading.locationName))}
      ${popupRow("Lat", formatCoord(reading.latitude))}
      ${popupRow("Lon", formatCoord(reading.longitude))}
      ${popupRow("Temperature", `${formatMeasure(reading.temperature)}°C`)}
      ${popupRow("Humidity", `${formatMeasure(reading.humidity)}%`)}
      ${popupRow("Received", escapeHtml(formatTime(reading.receivedAt)))}
    </div>
  </div>`;
}

export default function MapCanvas({ readings }: { readings: PublicReading[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const placeKeyRef = useRef("");
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
    const map = L.map(node, { scrollWheelZoom: true }).setView(koreaCenter, 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(node);

    return () => {
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
      L.marker([reading.latitude, reading.longitude], { icon: stationIcon })
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

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute top-4 right-4 z-[500] rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
        {markers.length === 0 ? "아직 수신된 좌표가 없습니다." : `관측 지점 ${markers.length}곳`}
      </div>
    </section>
  );
}
