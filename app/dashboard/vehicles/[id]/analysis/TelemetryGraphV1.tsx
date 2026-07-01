"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TelemetryGraphV1Props = {
  telemetry: any;
};

type ChartPoint = {
  index: number;
  rpm: number;
  value: number;
};

type ChartConfig = {
  title: string;
  values: number[];
  unit: string;
  min: number;
  max: number;
  color: string;
};

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter(Number.isFinite);
}

function getSeries(telemetry: any, keys: string[]): number[] {
  if (!telemetry || typeof telemetry !== "object") return [];

  for (const key of keys) {
    const values = toNumberArray(telemetry[key]);
    if (values.length > 0) return values;
  }

  return [];
}

function getMinMax(values: number[]) {
  if (!values.length) return { min: 0, max: 0 };

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "N/A";
}

function buildChartData(values: number[], rpm: number[]): ChartPoint[] {
  const hasRealRpm = rpm.length === values.length;

  return values.map((value, index) => {
    const estimatedRpm =
      values.length > 1 ? 1500 + (index / (values.length - 1)) * 5000 : 1500;

    return {
      index,
      rpm: hasRealRpm ? rpm[index] : estimatedRpm,
      value,
    };
  });
}

function TelemetryChart({
  title,
  values,
  rpm,
  unit,
  min,
  max,
  color,
}: ChartConfig & { rpm: number[] }) {
  const data = buildChartData(values, rpm);
  const latest = values.length ? values[values.length - 1] : null;
  const actual = getMinMax(values);
  const hasRpm = rpm.length === values.length;

  return (
    <div
      className="rounded-2xl border bg-zinc-950/80 p-4 shadow-lg shadow-black/30"
      style={{
        borderColor: `${color}55`,
        boxShadow: `0 0 22px ${color}14`,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color }}>
            {title}
          </h3>
          <p className="text-xs text-zinc-500">{values.length} samples</p>
        </div>

        <div className="text-right text-xs text-sky-200">
          <div>
            Latest:{" "}
            <span className="font-semibold">
              {latest === null ? "N/A" : formatNumber(latest)} {unit}
            </span>
          </div>
          <div>
            Min/Max: {formatNumber(actual.min)} / {formatNumber(actual.max)}{" "}
            {unit}
          </div>
        </div>
      </div>

      {data.length >= 2 ? (
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 14, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                stroke="#3f3f46"
                strokeDasharray="3 3"
                opacity={0.65}
              />

              <XAxis
                dataKey={hasRpm ? "rpm" : "index"}
                type="number"
                domain={hasRpm ? [1000, 7500] : ["dataMin", "dataMax"]}
                tickFormatter={(value) =>
                  hasRpm ? `${Math.round(Number(value))}` : `${value}`
                }
                tick={{ fill: "#d4d4d8", fontSize: 11 }}
                axisLine={{ stroke: "#71717a" }}
                tickLine={{ stroke: "#71717a" }}
                label={{
                  value: hasRpm ? "Engine RPM" : "Sample",
                  position: "insideBottom",
                  offset: -4,
                  fill: "#d4d4d8",
                  fontSize: 12,
                }}
              />

              <YAxis
                domain={[min, max]}
                tick={{ fill: "#d4d4d8", fontSize: 11 }}
                axisLine={{ stroke: "#71717a" }}
                tickLine={{ stroke: "#71717a" }}
                width={44}
                label={{
                  value: unit,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#d4d4d8",
                  fontSize: 12,
                }}
              />

              <Tooltip
                contentStyle={{
                  background: "#09090b",
                  border: `1px solid ${color}88`,
                  borderRadius: "12px",
                  color: "#e4e4e7",
                }}
                labelFormatter={(label) =>
                  hasRpm
                    ? `RPM: ${Math.round(Number(label))}`
                    : `Sample: ${label}`
                }
                formatter={(value) => [
                  `${formatNumber(Number(value))} ${unit}`,
                  title,
                ]}
              />

              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: color,
                  strokeWidth: 2,
                  fill: "#09090b",
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-500">
          No telemetry samples available
        </div>
      )}
    </div>
  );
}

export default function TelemetryGraphV1({ telemetry }: TelemetryGraphV1Props) {
  const rpm = getSeries(telemetry, [
    "rpm",
    "rpmValues",
    "engineRpm",
    "engineRPM",
    "RPM",
    "rpmSeries",
    "rpmData",
  ]);

  const boost = getSeries(telemetry, ["boost", "boostValues"]);
  const boostTarget = getSeries(telemetry, [
    "boostTarget",
    "boostTargetValues",
  ]);
  const wgdc = getSeries(telemetry, ["wgdc", "wgdcValues"]);

  const railPressure = getSeries(telemetry, [
    "railPressure",
    "rail_pressure",
    "railPressurePsi",
    "rail_pressure_psi",
    "fuelRailPressure",
    "fuel_rail_pressure",
    "fuelRailPressurePsi",
    "fuel_rail_pressure_psi",
    "hpfp",
    "hpfpPsi",
    "hpfp_psi",
    "railPsi",
  ]);

  const lpfp = getSeries(telemetry, ["lpfp", "lpfpValues", "lpfpPsi"]);
  const iat = getSeries(telemetry, ["iat", "iatValues", "intakeAirTemp"]);

  const timingCorrectionCyl1 = getSeries(telemetry, [
    "timing_correction_cyl_1",
  ]);
  const timingCorrectionCyl2 = getSeries(telemetry, [
    "timing_correction_cyl_2",
  ]);
  const timingCorrectionCyl3 = getSeries(telemetry, [
    "timing_correction_cyl_3",
  ]);
  const timingCorrectionCyl4 = getSeries(telemetry, [
    "timing_correction_cyl_4",
    "cyl4TimingCorrection",
    "cyl4_timing_correction",
  ]);
  const timingCorrectionCyl5 = getSeries(telemetry, [
    "timing_correction_cyl_5",
  ]);
  const timingCorrectionCyl6 = getSeries(telemetry, [
    "timing_correction_cyl_6",
  ]);

  const mainCharts: ChartConfig[] = [
    {
      title: "Boost",
      values: boost,
      unit: "psi",
      min: 0,
      max: 35,
      color: "#22d3ee",
    },
    {
      title: "Boost Target",
      values: boostTarget,
      unit: "psi",
      min: 0,
      max: 35,
      color: "#38bdf8",
    },
    {
      title: "WGDC",
      values: wgdc,
      unit: "%",
      min: 0,
      max: 100,
      color: "#f59e0b",
    },
    {
      title: "Rail Pressure",
      values: railPressure,
      unit: "psi",
      min: 0,
      max: 3500,
      color: "#22c55e",
    },
    {
      title: "LPFP",
      values: lpfp,
      unit: "psi",
      min: 0,
      max: 100,
      color: "#c084fc",
    },
    {
      title: "IAT",
      values: iat,
      unit: "°C",
      min: 0,
      max: 80,
      color: "#facc15",
    },
  ];

  const timingCharts: ChartConfig[] = [
    {
      title: "Cyl 1 Timing Correction",
      values: timingCorrectionCyl1,
      unit: "°",
      min: -10,
      max: 2,
      color: "#fda4af",
    },
    {
      title: "Cyl 2 Timing Correction",
      values: timingCorrectionCyl2,
      unit: "°",
      min: -10,
      max: 2,
      color: "#fb7185",
    },
    {
      title: "Cyl 3 Timing Correction",
      values: timingCorrectionCyl3,
      unit: "°",
      min: -10,
      max: 2,
      color: "#f43f5e",
    },
    {
      title: "Cyl 4 Timing Correction",
      values: timingCorrectionCyl4,
      unit: "°",
      min: -10,
      max: 2,
      color: "#e11d48",
    },
    {
      title: "Cyl 5 Timing Correction",
      values: timingCorrectionCyl5,
      unit: "°",
      min: -10,
      max: 2,
      color: "#be123c",
    },
    {
      title: "Cyl 6 Timing Correction",
      values: timingCorrectionCyl6,
      unit: "°",
      min: -10,
      max: 2,
      color: "#881337",
    },
  ];

  return (
    <section className="rounded-3xl bg-gradient-to-r from-sky-500/70 via-violet-500/60 to-red-500/60 p-[1px] shadow-lg shadow-sky-500/10">
      <div className="rounded-3xl bg-black/75 p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-100">
            Telemetry Graph V1.1
          </h2>
          <p className="text-sm text-zinc-400">
            Professional telemetry charts from engine_v2 telemetry.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {mainCharts.map((chart) => (
            <TelemetryChart key={chart.title} {...chart} rpm={rpm} />
          ))}
        </div>

        <div className="mt-6">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-zinc-100">
              Per-Cylinder Timing Corrections
            </h3>
            <p className="text-xs text-zinc-500">
              Individual cylinder timing correction traces plotted against
              engine RPM.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {timingCharts.map((chart) => (
              <TelemetryChart key={chart.title} {...chart} rpm={rpm} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}