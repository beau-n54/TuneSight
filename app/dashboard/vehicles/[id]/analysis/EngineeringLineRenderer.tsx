"use client";

import { useId } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatGraphValue,
  formatHorizontalAxisTick,
  type GraphPoint,
  type GraphRegion,
  type GraphRegionCoordinates,
  type GraphSeries,
} from "./telemetryGraphPresentation";

type EngineeringLineRendererProps = {
  chartId: string;
  chartTitle: string;
  domain?: readonly [number | "auto", number | "auto"];
  focusedChannel: string | null;
  horizontalAxisLabel: string;
  points: readonly GraphPoint[];
  regions: readonly GraphRegion[];
  relevantRegions: readonly GraphRegionCoordinates[];
  series: readonly GraphSeries[];
  units: string;
  usesRpm: boolean;
};

function GraphTooltip({
  active,
  payload,
  regions,
  usesRpm,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    name?: string;
    value?: number | string;
    color?: string;
    unit?: string;
    payload?: GraphPoint;
  }>;
  regions: readonly GraphRegion[];
  usesRpm: boolean;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  const authoritativePayload = [
    ...new Map(
      payload.map((item) => [String(item.dataKey), item])
    ).values(),
  ];
  const activeRegions = regions.filter(
    (region) =>
      point.index >= region.startIndex && point.index <= region.endIndex
  );
  const activePull = activeRegions.find((region) => region.kind === "pull");

  return (
    <div className="min-w-64 border border-sky-950 bg-zinc-950/95 p-3 text-xs shadow-2xl shadow-sky-950/40 backdrop-blur-sm">
      <div className="border-b border-zinc-800 pb-2">
        <p className="font-mono font-semibold text-sky-300">
          {usesRpm && point.rpm !== null
            ? `${Math.round(point.rpm).toLocaleString()} RPM`
            : `Sample Sequence ${point.index + 1}`}
        </p>
        <p className="mt-1 font-mono text-[10px] text-zinc-500">
          Source sample {point.index + 1}
          {!usesRpm && point.rpm !== null
            ? ` · ${Math.round(point.rpm).toLocaleString()} recorded RPM`
            : ""}
        </p>
        {activePull && (
          <p className="mt-1 text-[10px] uppercase tracking-wider text-sky-500">
            {activePull.label}
          </p>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {authoritativePayload.map((item) => {
          const value = Number(item.value);
          const unit = item.unit ?? "";

          return (
            <div
              key={String(item.dataKey)}
              className="flex items-center justify-between gap-5"
            >
              <span className="flex items-center gap-2 text-zinc-400">
                <span
                  aria-hidden="true"
                  className="h-0.5 w-4"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
              <span className="font-mono font-medium text-zinc-100">
                {formatGraphValue(value, unit)}
              </span>
            </div>
          );
        })}
      </div>

      {activeRegions.some((region) => region.kind === "event") && (
        <div className="mt-3 border-t border-zinc-800 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Active regions
          </p>
          {activeRegions
            .filter((region) => region.kind === "event")
            .map((region) => (
              <p key={region.id} className="mt-1 text-zinc-300">
                Event: {region.label}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

export default function EngineeringLineRenderer({
  chartId,
  chartTitle,
  domain,
  focusedChannel,
  horizontalAxisLabel,
  points,
  regions,
  relevantRegions,
  series,
  units,
  usesRpm,
}: EngineeringLineRendererProps) {
  const glowFilterId = useId();

  return (
    <div className="min-h-0 overflow-x-auto bg-black/80 p-2">
      <div
        aria-label={`${chartTitle} exact-point telemetry plot`}
        className="relative h-full min-w-[680px] overflow-hidden border border-sky-950/90 bg-[#020617] px-2 py-3 shadow-[inset_0_0_42px_rgba(2,132,199,0.13),0_0_0_1px_rgba(14,165,233,0.05)] lg:min-w-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(14,165,233,0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.075) 1px, transparent 1px), linear-gradient(rgba(14,165,233,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.025) 1px, transparent 1px), radial-gradient(circle at 50% 0%, rgba(14,165,233,0.16), transparent 52%)",
          backgroundSize:
            "56px 56px, 56px 56px, 14px 14px, 14px 14px, 100% 100%",
        }}
        tabIndex={0}
      >
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={points}
            margin={{ top: 14, right: 20, bottom: 24, left: 10 }}
          >
            <defs>
              <filter
                height="180%"
                id={glowFilterId}
                width="180%"
                x="-40%"
                y="-40%"
              >
                <feGaussianBlur stdDeviation="2.4" />
              </filter>
            </defs>
            <CartesianGrid
              opacity={0.48}
              stroke="#155e75"
              strokeDasharray="3 7"
            />

            <XAxis
              allowDataOverflow={false}
              dataKey="x"
              domain={["dataMin", "dataMax"]}
              label={{
                value: horizontalAxisLabel,
                position: "insideBottom",
                offset: -16,
                fill: "#bae6fd",
                fontSize: 12,
                fontWeight: 600,
              }}
              tick={{
                fill: "#a1a1aa",
                fontFamily: "monospace",
                fontSize: 10,
              }}
              tickFormatter={(value) =>
                formatHorizontalAxisTick(Number(value), points, usesRpm)
              }
              tickLine={{ stroke: "#0e7490" }}
              type="number"
            />

            <YAxis
              domain={domain ?? ["auto", "auto"]}
              label={{
                value: units,
                angle: -90,
                position: "insideLeft",
                fill: "#bae6fd",
                fontSize: 11,
                fontWeight: 600,
              }}
              tick={{
                fill: "#a1a1aa",
                fontFamily: "monospace",
                fontSize: 10,
              }}
              tickFormatter={(value) =>
                Math.abs(Number(value)) >= 1000
                  ? Math.round(Number(value)).toLocaleString()
                  : Number(value).toFixed(
                      Math.abs(Number(value)) < 10 ? 1 : 0
                    )
              }
              tickLine={{ stroke: "#0e7490" }}
              width={68}
            />

            {relevantRegions.map((region) => (
              <ReferenceArea
                key={`${chartId}-${region.id}`}
                fill={region.kind === "event" ? "#f59e0b" : "#38bdf8"}
                fillOpacity={region.kind === "event" ? 0.035 : 0.018}
                ifOverflow="hidden"
                stroke={region.kind === "event" ? "#f59e0b" : "#38bdf8"}
                strokeDasharray={region.kind === "event" ? "4 3" : "2 5"}
                strokeOpacity={region.kind === "event" ? 0.42 : 0.32}
                x1={region.x1}
                x2={region.x2}
              />
            ))}

            <Tooltip
              content={<GraphTooltip regions={regions} usesRpm={usesRpm} />}
              cursor={{
                stroke: "#7dd3fc",
                strokeDasharray: "2 3",
                strokeOpacity: 0.72,
              }}
              filterNull
              isAnimationActive={false}
            />

            {series.map((item) => (
              <Line
                key={`${item.id}-focus-glow`}
                activeDot={false}
                connectNulls={false}
                dataKey={item.id}
                dot={false}
                filter={`url(#${glowFilterId})`}
                isAnimationActive={false}
                legendType="none"
                opacity={
                  focusedChannel === item.id
                    ? 0.46
                    : focusedChannel === null
                      ? 0.16
                      : 0.055
                }
                stroke={item.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={focusedChannel === item.id ? 9 : 5}
                tooltipType="none"
                type="linear"
              />
            ))}

            {series.map((item) => (
              <Line
                key={item.id}
                activeDot={{
                  fill: "#09090b",
                  r: 4,
                  stroke: item.color,
                  strokeWidth: 2,
                }}
                connectNulls={false}
                dataKey={item.id}
                dot={false}
                isAnimationActive={false}
                name={item.label}
                opacity={
                  focusedChannel === null || focusedChannel === item.id
                    ? 1
                    : 0.26
                }
                stroke={item.color}
                strokeDasharray={item.strokeDasharray}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={focusedChannel === item.id ? 3.4 : 2.25}
                type="linear"
                unit={item.unit}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
