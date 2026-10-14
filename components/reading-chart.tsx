"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatReceivedAt } from "@/lib/time";
import type { ReadingView } from "@/lib/types";

const seriesColors = ["#d89a2b", "#12202a", "#3d6b58", "#9f2d3a", "#2f5d8c", "#7a5b3a", "#5d6b74"];

type ChartRow = { time: number } & Record<string, number>;

type Series = {
  key: string;
  label: string;
  color: string;
  count: number;
};

function seriesKey(reading: ReadingView) {
  return `${reading.senderName}|${reading.deviceName}|${reading.sensorName}|${reading.locationName}`;
}

function formatMeasure(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function buildChart(readings: ReadingView[]) {
  const grouped = new Map<
    string,
    { locationName: string; deviceName: string; sensorName: string; senderName: string; count: number }
  >();

  for (const reading of readings) {
    const key = seriesKey(reading);
    const current = grouped.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    grouped.set(key, {
      locationName: reading.locationName,
      deviceName: reading.deviceName,
      sensorName: reading.sensorName,
      senderName: reading.senderName,
      count: 1,
    });
  }

  const sensorCounts = new Map<string, number>();
  for (const item of grouped.values()) {
    const deviceKey = `${item.senderName}|${item.deviceName}|${item.locationName}`;
    sensorCounts.set(deviceKey, (sensorCounts.get(deviceKey) ?? 0) + 1);
  }

  const baseLabels = [...grouped.entries()].map(([key, item]) => {
    const deviceKey = `${item.senderName}|${item.deviceName}|${item.locationName}`;
    const base =
      (sensorCounts.get(deviceKey) ?? 0) > 1
        ? `${item.locationName} · ${item.deviceName} · ${item.sensorName}`
        : `${item.locationName} · ${item.deviceName}`;
    return { key, base, senderName: item.senderName, count: item.count };
  });

  const labelCounts = new Map<string, number>();
  for (const item of baseLabels) {
    labelCounts.set(item.base, (labelCounts.get(item.base) ?? 0) + 1);
  }

  const series: Series[] = baseLabels.map((item, index) => ({
    key: item.key,
    label: (labelCounts.get(item.base) ?? 0) > 1 ? `${item.base} · ${item.senderName}` : item.base,
    color: seriesColors[index % seriesColors.length],
    count: item.count,
  }));

  const temperature = new Map<number, ChartRow>();
  const humidity = new Map<number, ChartRow>();

  for (const reading of readings) {
    const time = new Date(reading.receivedAt).getTime();
    if (!Number.isFinite(time)) continue;
    const key = seriesKey(reading);
    if (Number.isFinite(reading.temperature)) {
      const row = temperature.get(time) ?? { time };
      if (row[key] === undefined) row[key] = reading.temperature;
      temperature.set(time, row);
    }
    if (Number.isFinite(reading.humidity)) {
      const row = humidity.get(time) ?? { time };
      if (row[key] === undefined) row[key] = reading.humidity;
      humidity.set(time, row);
    }
  }

  const byTime = (rows: Map<number, ChartRow>) => [...rows.values()].sort((a, b) => a.time - b.time);

  return {
    series,
    temperature: byTime(temperature),
    humidity: byTime(humidity),
    maxPoints: series.reduce((max, item) => Math.max(max, item.count), 0),
  };
}

const axisTick = { fill: "#5d6b74", fontSize: 12 };

function MeasureChart({
  title,
  unit,
  data,
  series,
  timeZone,
}: {
  title: string;
  unit: string;
  data: ChartRow[];
  series: Series[];
  timeZone: string;
}) {
  const showDots = series.every((item) => item.count <= 30);

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">
        {title}
        <span className="ml-1 font-normal text-muted">{unit}</span>
      </h3>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 240 }}>
          <LineChart data={data} syncId="sheet-readings" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e3dbd0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) => formatReceivedAt(Number(value), false, timeZone)}
              tick={axisTick}
              stroke="#e3dbd0"
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(value) => formatMeasure(Number(value))}
              tick={axisTick}
              stroke="#e3dbd0"
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#fffdf8",
                border: "1px solid #e3dbd0",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => formatReceivedAt(Number(label), true, timeZone)}
              formatter={(value, name) => {
                const numeric = typeof value === "number" ? value : Number(value);
                const shown = Number.isFinite(numeric) ? `${formatMeasure(numeric)} ${unit}` : "-";
                return [shown, name];
              }}
            />
            {series.map((item) => (
              <Line
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2}
                connectNulls
                dot={showDots}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ReadingChart({ readings, timeZone }: { readings: ReadingView[]; timeZone: string }) {
  const chart = useMemo(() => buildChart(readings), [readings]);

  if (chart.maxPoints < 2) {
    return <p className="px-5 py-8 text-sm text-muted">비교할 수신 기록이 더 필요합니다.</p>;
  }

  return (
    <div className="space-y-6 px-3 py-5 sm:px-5">
      {chart.series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 px-2 text-xs text-muted">
          {chart.series.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <MeasureChart title="온도" unit="°C" data={chart.temperature} series={chart.series} timeZone={timeZone} />
      <MeasureChart title="습도" unit="%" data={chart.humidity} series={chart.series} timeZone={timeZone} />
    </div>
  );
}
