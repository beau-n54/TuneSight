"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildGraphPoints,
  formatGraphValue,
  formatHorizontalAxisTick,
  getRpmSeries,
  getHorizontalAxisPresentation,
  type GraphChannel,
  type GraphPoint,
  type GraphRegion,
  resolveGraphSeries,
  resolveRegionCoordinates,
  RPM_ALIASES,
  TELEMETRY_CHANNELS,
  TELEMETRY_PANEL_CLASS_NAME,
  TELEMETRY_SECTION_CLASS_NAME,
  TIMING_CHANNELS,
} from "./telemetryGraphPresentation";
import {
  STANDARD_INSPECTION_PANEL_GEOMETRY,
  WIDE_INSPECTION_PANEL_GEOMETRY,
} from "./analysisPresentation";

type PullWindowPresentation = {
  id?: string;
  startIndex?: number;
  endIndex?: number;
  quality?: "strong" | "usable" | "questionable";
};

type EventPresentation = {
  id?: string;
  type?: string;
  startIndex?: number;
  endIndex?: number;
  supportingChannels?: string[];
};

type TelemetryGraphV1Props = {
  telemetry: unknown;
  pullWindows?: readonly PullWindowPresentation[];
  events?: readonly EventPresentation[];
};

type ChartDefinition = {
  id: string;
  title: string;
  description: string;
  channels: readonly GraphChannel[];
  domain?: readonly [number | "auto", number | "auto"];
};

const CHARTS: readonly ChartDefinition[] = [
  {
    id: "boost",
    title: "Boost Control",
    description: "Actual boost compared directly with the requested target.",
    channels: [
      TELEMETRY_CHANNELS.boostActual,
      TELEMETRY_CHANNELS.boostTarget,
    ],
    domain: [0, "auto"],
  },
  {
    id: "air-control",
    title: "Air Control",
    description:
      "Wastegate demand and throttle position on a shared percentage scale.",
    channels: [
      TELEMETRY_CHANNELS.wastegateDuty,
      TELEMETRY_CHANNELS.throttlePosition,
    ],
    domain: [0, 100],
  },
  {
    id: "high-pressure-fuel",
    title: "High-Pressure Fuel",
    description: "Fuel-rail pressure throughout the recorded pull.",
    channels: [TELEMETRY_CHANNELS.highPressureFuel],
    domain: [0, "auto"],
  },
  {
    id: "low-pressure-fuel",
    title: "Low-Pressure Fuel",
    description: "Low-pressure fuel supply throughout the recorded pull.",
    channels: [TELEMETRY_CHANNELS.lowPressureFuel],
    domain: [0, "auto"],
  },
  {
    id: "temperature",
    title: "Charge Temperature",
    description: "Intake air temperature across the recorded samples.",
    channels: [TELEMETRY_CHANNELS.intakeAirTemperature],
    domain: ["auto", "auto"],
  },
  {
    id: "fueling",
    title: "Air-Fuel Ratio",
    description: "Measured air-fuel ratio where the source log provides it.",
    channels: [TELEMETRY_CHANNELS.airFuelRatio],
    domain: ["auto", "auto"],
  },
  {
    id: "timing",
    title: "Per-Cylinder Timing Correction",
    description:
      "All available cylinder corrections aligned on the same sample axis.",
    channels: TIMING_CHANNELS,
    domain: ["auto", "auto"],
  },
];

const EVENT_CHANNEL_ALIASES: Record<string, string> = {
  boost: "boost_actual",
  boost_target: "boost_target",
  boostTarget: "boost_target",
  wgdc: "wgdc",
  throttle: "throttle",
  rail: "rail_pressure",
  rail_pressure: "rail_pressure",
  hpfp: "rail_pressure",
  lpfp: "lpfp",
  iat: "iat",
  afr: "afr",
};

function humanizeIdentifier(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isValidBoundary(
  value: number | undefined
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function buildRegions(
  pulls: readonly PullWindowPresentation[],
  events: readonly EventPresentation[]
): GraphRegion[] {
  const pullRegions = pulls.flatMap((pull, index) => {
    if (
      !isValidBoundary(pull.startIndex) ||
      !isValidBoundary(pull.endIndex)
    ) {
      return [];
    }

    return [
      {
        id: pull.id ?? `pull_${index + 1}`,
        label: `Pull ${index + 1}${
          pull.quality ? ` · ${humanizeIdentifier(pull.quality)}` : ""
        }`,
        startIndex: pull.startIndex,
        endIndex: pull.endIndex,
        kind: "pull" as const,
        supportingChannels: [],
      },
    ];
  });

  const eventRegions = events.flatMap((event, index) => {
    if (
      !isValidBoundary(event.startIndex) ||
      !isValidBoundary(event.endIndex)
    ) {
      return [];
    }

    return [
      {
        id: event.id ?? `event_${index + 1}`,
        label: humanizeIdentifier(event.type ?? `Event ${index + 1}`),
        startIndex: event.startIndex,
        endIndex: event.endIndex,
        kind: "event" as const,
        supportingChannels: event.supportingChannels ?? [],
      },
    ];
  });

  return [...pullRegions, ...eventRegions];
}

function regionSupportsChart(
  region: GraphRegion,
  channelIds: ReadonlySet<string>
): boolean {
  if (region.kind === "pull") {
    return true;
  }

  return region.supportingChannels.some((channel) => {
    const normalized =
      EVENT_CHANNEL_ALIASES[channel] ??
      channel.replace(/^cyl(inder)?_?/, "timing_correction_cyl_");

    return channelIds.has(normalized);
  });
}

function GraphTooltip({
  active,
  payload,
  regions,
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
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  const activeRegions = regions.filter(
    (region) =>
      point.index >= region.startIndex &&
      point.index <= region.endIndex
  );

  return (
    <div className="min-w-56 border border-zinc-700 bg-zinc-950 p-3 text-xs shadow-xl shadow-black/50">
      <p className="font-mono text-zinc-300">
        {point.rpm !== null
          ? `${Math.round(point.rpm)} RPM`
          : `Sample ${point.index + 1}`}
      </p>

      <div className="mt-2 space-y-1.5">
        {payload.map((item) => {
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

      {activeRegions.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Active regions
          </p>
          {activeRegions.map((region) => (
            <p key={region.id} className="mt-1 text-zinc-300">
              {region.kind === "event" ? "Event" : "Pull"}: {region.label}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function EngineeringTelemetryChart({
  definition,
  telemetry,
  rpm,
  regions,
  sharedSampleCount,
  wide = false,
}: {
  definition: ChartDefinition;
  telemetry: unknown;
  rpm: readonly (number | null)[];
  regions: readonly GraphRegion[];
  sharedSampleCount: number;
  wide?: boolean;
}) {
  const series = useMemo(
    () => resolveGraphSeries(telemetry, definition.channels),
    [definition.channels, telemetry]
  );
  const { points, usesRpm, hasStoredRpm } = useMemo(
    () =>
      buildGraphPoints(
        series,
        rpm,
        sharedSampleCount,
        regions.filter((region) => region.kind === "pull").length > 1
      ),
    [regions, rpm, series, sharedSampleCount]
  );
  const horizontalAxis = getHorizontalAxisPresentation({
    usesRpm,
    hasStoredRpm,
  });
  const plottedRegions = useMemo(
    () => resolveRegionCoordinates(regions, points),
    [points, regions]
  );
  const [focusedChannel, setFocusedChannel] = useState<string | null>(
    null
  );
  const channelIds = useMemo(
    () => new Set(series.map((item) => item.id)),
    [series]
  );
  const relevantRegions = plottedRegions.filter((region) =>
    regionSupportsChart(region, channelIds)
  );
  const units = [...new Set(series.map((item) => item.unit))].join(" / ");

  if (series.length === 0) {
    return null;
  }

  return (
    <article
      aria-label={`${definition.title} Engineering Inspection Panel`}
      className={`${TELEMETRY_PANEL_CLASS_NAME} ${
        wide
          ? WIDE_INSPECTION_PANEL_GEOMETRY
          : STANDARD_INSPECTION_PANEL_GEOMETRY
      }`}
    >
      <header className="overflow-y-auto border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400">
              Engineering Inspection Panel
            </p>
            <h3 className="text-sm font-semibold text-zinc-100">
              {definition.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {definition.description}
            </p>
          </div>

          <div
            aria-label={`${definition.title} channel focus`}
            className="flex flex-wrap gap-1.5"
            role="group"
          >
            <button
              aria-pressed={focusedChannel === null}
              className="min-h-8 border border-zinc-700 px-2.5 text-xs text-zinc-300 transition hover:border-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              onClick={() => setFocusedChannel(null)}
              type="button"
            >
              All
            </button>
            {series.map((item) => (
              <button
                key={item.id}
                aria-pressed={focusedChannel === item.id}
                className="min-h-8 border px-2.5 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={() =>
                  setFocusedChannel((current) =>
                    current === item.id ? null : item.id
                  )
                }
                style={{
                  borderColor:
                    focusedChannel === item.id
                      ? item.color
                      : "#3f3f46",
                  color:
                    focusedChannel === null ||
                    focusedChannel === item.id
                      ? item.color
                      : "#71717a",
                }}
                type="button"
              >
                <span aria-hidden="true">
                  {item.strokeDasharray ? "┄ " : "━ "}
                </span>
                {item.label} · {item.unit}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="min-h-0 overflow-x-auto">
        <div className="h-full min-w-[680px] px-2 py-3 lg:min-w-0">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart
              data={points}
              margin={{ top: 14, right: 20, bottom: 24, left: 10 }}
            >
              <CartesianGrid
                opacity={0.32}
                stroke="#52525b"
                strokeDasharray="2 6"
                vertical={false}
              />

              <XAxis
                allowDataOverflow={false}
                dataKey="x"
                domain={["dataMin", "dataMax"]}
                label={{
                  value: horizontalAxis.label,
                  position: "insideBottom",
                  offset: -16,
                  fill: "#a1a1aa",
                  fontSize: 11,
                }}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={(value) =>
                  formatHorizontalAxisTick(
                    Number(value),
                    points,
                    usesRpm
                  )
                }
                tickLine={{ stroke: "#52525b" }}
                type="number"
              />

              <YAxis
                domain={definition.domain ?? ["auto", "auto"]}
                label={{
                  value: units,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#a1a1aa",
                  fontSize: 11,
                }}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={(value) =>
                  Math.abs(Number(value)) >= 1000
                    ? Math.round(Number(value)).toLocaleString()
                    : Number(value).toFixed(
                        Math.abs(Number(value)) < 10 ? 1 : 0
                      )
                }
                tickLine={{ stroke: "#52525b" }}
                width={68}
              />

              {relevantRegions.map((region) => (
                <ReferenceArea
                  key={`${definition.id}-${region.id}`}
                  fill={
                    region.kind === "event"
                      ? "#f59e0b"
                      : "#38bdf8"
                  }
                  fillOpacity={region.kind === "event" ? 0.055 : 0.025}
                  ifOverflow="hidden"
                  stroke={
                    region.kind === "event"
                      ? "#f59e0b"
                      : "#38bdf8"
                  }
                  strokeDasharray={
                    region.kind === "event" ? "4 3" : "2 5"
                  }
                  strokeOpacity={0.55}
                  x1={region.x1}
                  x2={region.x2}
                />
              ))}

              <Tooltip
                content={
                  <GraphTooltip
                    regions={regions}
                  />
                }
                cursor={{
                  stroke: "#e4e4e7",
                  strokeDasharray: "3 3",
                  strokeOpacity: 0.55,
                }}
                filterNull
                isAnimationActive={false}
              />

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
                    focusedChannel === null ||
                    focusedChannel === item.id
                      ? 1
                      : 0.22
                  }
                  stroke={item.color}
                  strokeDasharray={item.strokeDasharray}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={
                    focusedChannel === item.id ? 2.75 : 1.8
                  }
                  type="linear"
                  unit={item.unit}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <footer className="flex flex-wrap content-center items-center gap-x-4 gap-y-1 overflow-y-auto border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-500">
        <span>{points.length.toLocaleString()} unchanged samples</span>
        <span>{horizontalAxis.note}</span>
        {relevantRegions.some((region) => region.kind === "pull") && (
          <span>Blue region · detected pull</span>
        )}
        {relevantRegions.some((region) => region.kind === "event") && (
          <span>Amber region · detected event</span>
        )}
      </footer>
    </article>
  );
}

export default function TelemetryGraphV1({
  telemetry,
  pullWindows = [],
  events = [],
}: TelemetryGraphV1Props) {
  const rpm = useMemo(
    () => getRpmSeries(telemetry, RPM_ALIASES),
    [telemetry]
  );
  const regions = useMemo(
    () => buildRegions(pullWindows, events),
    [events, pullWindows]
  );
  const availableCharts = CHARTS.filter(
    (definition) =>
      resolveGraphSeries(telemetry, definition.channels).length > 0
  );
  const sharedSampleCount = Math.max(
    0,
    ...availableCharts.flatMap((definition) =>
      resolveGraphSeries(telemetry, definition.channels).map(
        (series) => series.values.length
      )
    )
  );

  return (
    <section
      aria-labelledby="engineering-telemetry-heading"
      className={TELEMETRY_SECTION_CLASS_NAME}
    >
      <header className="border-b border-zinc-800 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
              Engineering inspection
            </p>
            <h2
              className="mt-1 text-lg font-semibold text-zinc-100"
              id="engineering-telemetry-heading"
            >
              Engineering Inspection Panels
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
              Exact recorded samples with detected pull and event regions
              aligned to their original boundaries.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>{rpm.length.toLocaleString()} RPM samples</span>
            <span>{pullWindows.length} detected pulls</span>
            <span>{events.length} detected events</span>
          </div>
        </div>
      </header>

      {availableCharts.length > 0 ? (
        <div className="grid gap-3 bg-black p-3 lg:grid-cols-2">
          {availableCharts.map((definition) => {
            const isWidePanel = definition.id === "timing";

            return (
              <div
                key={definition.id}
                className={isWidePanel ? "lg:col-span-2" : undefined}
              >
                <EngineeringTelemetryChart
                  definition={definition}
                  regions={regions}
                  rpm={rpm}
                  sharedSampleCount={sharedSampleCount}
                  telemetry={telemetry}
                  wide={isWidePanel}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-[31rem] items-center justify-center px-5 py-10 text-sm text-zinc-500">
          No telemetry samples are available for graph inspection.
        </div>
      )}
    </section>
  );
}
