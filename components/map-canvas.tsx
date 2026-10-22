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

const myLocationColor = "#2f7de1";
// Desktop Wi-Fi fixes can be off by kilometres; a circle that large hides the stations.
const approxAccuracyM = 1000;
const sheetNearbyM = 30000;
const sharedNearbyM = 50000;
const sharedNearbyCount = 3;
const myLocationHint = "위치는 이 브라우저에서만 쓰이며 서버로 전송되지 않습니다.";

const myLocationIcon = L.divIcon({
  className: "my-location-marker",
  html: `<span style="display:block;box-sizing:border-box;width:16px;height:16px;border-radius:999px;background:${myLocationColor};border:3px solid #fff;box-shadow:0 0 0 2px rgba(47,125,225,.45)"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -12],
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
  width: min(260px, calc(100vw - 72px)) !important;
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
.station-popup-title {
  margin: 0 0 8px !important;
  font-size: 13px;
  font-weight: 600;
}
.station-popup-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.station-popup-actions button {
  flex: 1;
  border: 1px solid #e3dbd0;
  border-radius: 8px;
  background: #fff;
  padding: 6px 8px;
  font: 12px "Noto Sans KR", sans-serif;
  color: #1c2830;
  cursor: pointer;
}
.station-popup-actions button:hover {
  background: #f3efe6;
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

function formatAccuracy(meters: number) {
  if (meters < 1000) return `±${Math.round(meters)}m`;
  return `±${(meters / 1000).toFixed(1)}km`;
}

function myLocationPopupHtml(location: MyLocation, withCopy: boolean) {
  const lat = location.lat.toFixed(5);
  const lng = location.lng.toFixed(5);
  const actions = withCopy
    ? `<div class="station-popup-actions">
      <button type="button" data-copy="${lat}" data-label="위도 복사">위도 복사</button>
      <button type="button" data-copy="${lng}" data-label="경도 복사">경도 복사</button>
    </div>`
    : "";
  return `<div class="station-popup-card">
    <p class="station-popup-title">내 위치</p>
    <div class="station-popup-facts">
      ${popupRow("Lat", lat)}
      ${popupRow("Lon", lng)}
      ${popupRow("Accuracy", formatAccuracy(location.accuracy))}
    </div>
    ${actions}
  </div>`;
}

function frameAroundStations(map: L.Map, stations: PublicReading[], here: [number, number]) {
  if (stations.length === 0) {
    map.setView(here, 15);
    return;
  }
  const nearest = Math.min(...stations.map((reading) => map.distance(here, [reading.latitude, reading.longitude])));
  if (nearest > sheetNearbyM) return;
  map.fitBounds(
    L.latLngBounds([...stations.map((reading) => [reading.latitude, reading.longitude] as [number, number]), here]),
    { padding: [48, 48], maxZoom: 15 },
  );
}

function frameNearbyStations(map: L.Map, stations: PublicReading[], here: [number, number]) {
  const nearby = stations
    .map((reading) => {
      const point: [number, number] = [reading.latitude, reading.longitude];
      return { point, distance: map.distance(here, point) };
    })
    .filter((station) => station.distance <= sharedNearbyM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, sharedNearbyCount);
  if (nearby.length === 0) {
    map.setView(here, 11);
    return;
  }
  map.fitBounds(L.latLngBounds([...nearby.map((station) => station.point), here]), {
    padding: [48, 48],
    maxZoom: 14,
  });
}

function frameMyLocation(mode: LocationMode, map: L.Map, stations: PublicReading[], location: MyLocation) {
  const here: [number, number] = [location.lat, location.lng];
  if (mode === "on-demand") frameNearbyStations(map, stations, here);
  else frameAroundStations(map, stations, here);
}

function bindCopyButtons(event: L.PopupEvent) {
  const root = event.popup.getElement();
  root?.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
    button.onclick = async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy ?? "");
        button.textContent = "복사됨";
      } catch {
        button.textContent = "복사 실패";
      }
      window.setTimeout(() => {
        button.textContent = button.dataset.label ?? "";
      }, 1500);
    };
  });
}

type MyLocation = { lat: number; lng: number; accuracy: number };
type LocationState = "idle" | "locating" | "ready" | "denied" | "unavailable";
// auto: ask on load (owner's sheet page). on-demand: show silently only if already granted, else wait for the button.
type LocationMode = "off" | "auto" | "on-demand";

type MapCanvasProps = {
  readings: PublicReading[];
  stats?: PublicMapStats;
  scrollZoom?: "always" | "click";
  locationMode?: LocationMode;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default function MapCanvas({
  readings,
  stats,
  scrollZoom = "always",
  locationMode = "off",
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markersDataRef = useRef<PublicReading[]>([]);
  const myLayerRef = useRef<L.LayerGroup | null>(null);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const myCircleRef = useRef<L.Circle | null>(null);
  const requestLocationRef = useRef<((frame: boolean) => void) | null>(null);
  const viewLockedRef = useRef(false);
  const placeKeyRef = useRef("");
  const scrollZoomRef = useRef(scrollZoom);
  const [pointer, setPointer] = useState<{ lat: number; lng: number } | null>(null);
  const [wheelOn, setWheelOn] = useState(scrollZoom === "always");
  const [infoOpen, setInfoOpen] = useState(false);
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);
  const geolocationSupported = "geolocation" in navigator;
  const [locationState, setLocationState] = useState<LocationState>(() => {
    if (locationMode !== "auto") return "idle";
    return geolocationSupported ? "locating" : "unavailable";
  });
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
    const lockTouchDrag = scrollZoomRef.current === "click" && window.matchMedia("(pointer: coarse)").matches;
    const map = L.map(node, {
      scrollWheelZoom: scrollZoomRef.current === "always",
      dragging: !lockTouchDrag,
    }).setView(koreaCenter, 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    myLayerRef.current = L.layerGroup().addTo(map);
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
    const container = map.getContainer();
    const enableWheel = (event: PointerEvent) => {
      if (scrollZoomRef.current !== "click" || event.pointerType === "touch") return;
      map.scrollWheelZoom.enable();
      setWheelOn(true);
    };
    const disableWheel = () => {
      if (scrollZoomRef.current !== "click") return;
      map.scrollWheelZoom.disable();
      setWheelOn(false);
    };
    const enableTouchDrag = () => {
      map.dragging.enable();
      setWheelOn(true);
    };
    const releaseTouchDrag = (event: PointerEvent) => {
      if (container.contains(event.target as Node)) return;
      map.dragging.disable();
      setWheelOn(false);
    };
    const lockView = () => {
      viewLockedRef.current = true;
    };
    map.on("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseOut);
    container.addEventListener("pointerdown", lockView);
    container.addEventListener("wheel", lockView, { passive: true });
    container.addEventListener("keydown", lockView);
    if (scrollZoomRef.current === "click") {
      container.addEventListener("pointerdown", enableWheel);
      container.addEventListener("mouseleave", disableWheel);
    }
    if (lockTouchDrag) {
      map.on("click", enableTouchDrag);
      document.addEventListener("pointerdown", releaseTouchDrag);
    }

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("click", enableTouchDrag);
      container.removeEventListener("mouseleave", onMouseOut);
      container.removeEventListener("pointerdown", lockView);
      container.removeEventListener("wheel", lockView);
      container.removeEventListener("keydown", lockView);
      container.removeEventListener("pointerdown", enableWheel);
      container.removeEventListener("mouseleave", disableWheel);
      document.removeEventListener("pointerdown", releaseTouchDrag);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      myLayerRef.current = null;
      viewLockedRef.current = false;
      placeKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    if (locationMode === "off" || !("geolocation" in navigator)) return;
    const withCopy = locationMode === "auto";
    let cancelled = false;
    let framed = false;
    let located = false;
    let permission: PermissionStatus | null = null;

    function clearMyLocation() {
      myLayerRef.current?.clearLayers();
      myMarkerRef.current = null;
      myCircleRef.current = null;
    }

    function place(location: MyLocation) {
      const layer = myLayerRef.current;
      if (!layer) return;
      const latLng: L.LatLngExpression = [location.lat, location.lng];

      if (location.accuracy <= approxAccuracyM) {
        if (myCircleRef.current) {
          myCircleRef.current.setLatLng(latLng).setRadius(location.accuracy);
        } else {
          myCircleRef.current = L.circle(latLng, {
            radius: location.accuracy,
            color: myLocationColor,
            weight: 1,
            fillOpacity: 0.12,
            interactive: false,
          }).addTo(layer);
        }
      } else if (myCircleRef.current) {
        myCircleRef.current.remove();
        myCircleRef.current = null;
      }

      if (myMarkerRef.current) {
        myMarkerRef.current.setLatLng(latLng).setPopupContent(myLocationPopupHtml(location, withCopy));
      } else {
        // Keep the viewer's own dot above every station marker.
        myMarkerRef.current = L.marker(latLng, { icon: myLocationIcon, zIndexOffset: 1_000_000 })
          .bindPopup(myLocationPopupHtml(location, withCopy), {
            className: "station-popup",
            autoPan: true,
            autoPanPadding: L.point(32, 32),
            minWidth: 220,
          })
          .on("popupopen", bindCopyButtons)
          .addTo(layer);
      }
    }

    function request(frame = false) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (cancelled) return;
          const location = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy };
          located = true;
          place(location);
          setMyLocation(location);
          setLocationState("ready");
          const map = mapRef.current;
          if (map && (frame || !framed)) {
            framed = true;
            viewLockedRef.current = true;
            frameMyLocation(locationMode, map, markersDataRef.current, location);
          }
        },
        (error) => {
          if (cancelled) return;
          if (error.code === error.PERMISSION_DENIED) {
            clearMyLocation();
            located = false;
            setMyLocation(null);
            // Closing the prompt also reports PERMISSION_DENIED but leaves the permission at "prompt".
            const dismissed = permission?.state === "prompt";
            setLocationState(dismissed && locationMode === "on-demand" ? "idle" : "denied");
            return;
          }
          setLocationState((current) => (current === "ready" ? current : "unavailable"));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    }

    function onPermissionChange() {
      if (!permission) return;
      if (permission.state === "granted") {
        request();
        return;
      }
      clearMyLocation();
      located = false;
      setMyLocation(null);
      setLocationState(permission.state === "denied" ? "denied" : "idle");
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (permission?.state === "denied") return;
      // on-demand must never prompt without a user gesture.
      if (locationMode === "on-demand" && !located) return;
      request();
    }

    async function start() {
      try {
        permission = await navigator.permissions.query({ name: "geolocation" });
        if (cancelled) return;
        permission.addEventListener("change", onPermissionChange);
        if (permission.state === "denied") {
          setLocationState("denied");
          return;
        }
        if (locationMode === "on-demand" && permission.state !== "granted") return;
      } catch {
        // Permissions API가 없으면 auto는 바로 요청하고, on-demand는 버튼을 기다린다.
        if (locationMode === "on-demand") return;
      }
      if (cancelled) return;
      setLocationState("locating");
      request();
    }

    requestLocationRef.current = (frame) => {
      setLocationState((current) => (current === "ready" ? current : "locating"));
      request(frame);
    };
    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      requestLocationRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      permission?.removeEventListener("change", onPermissionChange);
      clearMyLocation();
    };
  }, [locationMode]);

  function focusMyLocation() {
    const map = mapRef.current;
    if (!map || !myLocation) return;
    viewLockedRef.current = true;
    if (locationMode === "on-demand") {
      frameMyLocation(locationMode, map, markersDataRef.current, myLocation);
      return;
    }
    map.flyTo([myLocation.lat, myLocation.lng], Math.max(map.getZoom(), 15));
  }

  function onMyLocationButton() {
    if (locationState === "ready" && myLocation) {
      focusMyLocation();
      return;
    }
    requestLocationRef.current?.(true);
  }

  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    markersDataRef.current = markers;
    if (!map || !group) return;

    group.clearLayers();
    const ordered = [...markers].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    ordered.forEach((reading, index) => {
      // Leaflet z-index is pixel y + offset; the step must exceed the marker size so recency beats position.
      L.marker([reading.latitude, reading.longitude], {
        icon: stationIcon(isFresh(reading.receivedAt)),
        zIndexOffset: index * 100,
      })
        .bindPopup(popupHtml(reading), {
          className: "station-popup",
          autoPan: true,
          autoPanPadding: L.point(32, 32),
          minWidth: 260,
        })
        .addTo(group);
    });

    const placeKey = markers
      .map(
        (reading) =>
          `${stationKey(reading)}|${reading.latitude.toFixed(4)}|${reading.longitude.toFixed(4)}`,
      )
      .sort()
      .join(";");
    if (placeKey === placeKeyRef.current) return;
    const hadStations = placeKeyRef.current !== "";
    placeKeyRef.current = placeKey;
    // Once the viewer has moved the map (or it was framed on their location), refreshes must not yank it back.
    if (hadStations && viewLockedRef.current) return;

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
    <section className="relative min-h-[20rem] flex-1 overflow-hidden rounded-2xl border border-line md:min-h-[28rem]">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute top-3 right-3 z-[500] flex max-w-[min(100%-4.5rem,22rem)] flex-col items-end gap-2 md:top-4 md:right-4 md:max-w-[min(100%-5.5rem,22rem)]">
        <button
          type="button"
          onClick={() => setInfoOpen((open) => !open)}
          aria-expanded={infoOpen}
          className="pointer-events-auto rounded-full border border-line bg-card px-3 py-2 text-xs text-ink shadow-sm md:hidden"
        >
          지점 {formatCount(stationCount)}곳 · 활성 {formatCount(freshStationCount)}곳
          <span aria-hidden className="ml-1.5 text-muted">{infoOpen ? "▴" : "▾"}</span>
        </button>
        <div className={`${infoOpen ? "flex" : "hidden"} w-full flex-col items-end gap-2 md:flex`}>
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
            {locationMode === "auto" || (locationMode === "on-demand" && locationState === "ready") ? (
              <button
                type="button"
                onClick={focusMyLocation}
                disabled={!myLocation}
                title={myLocationHint}
                className="pointer-events-auto mt-1.5 flex items-center gap-2 text-left disabled:cursor-default enabled:hover:text-ink"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{
                    background: locationState === "ready" ? myLocationColor : "#c9d3da",
                    boxShadow: "0 0 0 2px #fff, 0 0 0 3px rgba(47,125,225,.5)",
                  }}
                />
                {locationState === "ready" && myLocation
                  ? myLocation.accuracy > approxAccuracyM
                    ? `내 위치 (대략 ${formatAccuracy(myLocation.accuracy)})`
                    : `내 위치 (${formatAccuracy(myLocation.accuracy)})`
                  : locationState === "denied"
                    ? "위치 권한 꺼짐"
                    : locationState === "unavailable"
                      ? "위치를 찾을 수 없음"
                      : "내 위치 찾는 중…"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {locationMode === "on-demand" && geolocationSupported ? (
        <button
          type="button"
          onClick={onMyLocationButton}
          disabled={locationState === "locating" || locationState === "denied"}
          title={
            locationState === "denied" ? "브라우저 설정에서 이 사이트의 위치 권한을 허용해 주세요." : myLocationHint
          }
          className="absolute right-3 bottom-8 z-[500] flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs text-ink shadow-sm disabled:text-muted md:right-4"
        >
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: locationState === "ready" ? myLocationColor : "#c9d3da" }}
          />
          {locationState === "locating"
            ? "위치 찾는 중…"
            : locationState === "denied"
              ? "위치 권한 꺼짐"
              : locationState === "unavailable"
                ? "다시 시도"
                : "내 위치"}
        </button>
      ) : null}
      {scrollZoom === "click" && !wheelOn ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
          <span className="pointer-coarse:hidden">클릭 후에 휠로 확대 할 수 있습니다.</span>
          <span className="hidden pointer-coarse:inline">지도를 탭하면 움직일 수 있습니다.</span>
        </div>
      ) : null}
      {pointer ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-full border border-line bg-card px-3 py-1 font-mono text-xs text-ink pointer-coarse:hidden">
          Lat {formatCoord(pointer.lat)} · Lon {formatCoord(pointer.lng)}
        </div>
      ) : null}
    </section>
  );
}
