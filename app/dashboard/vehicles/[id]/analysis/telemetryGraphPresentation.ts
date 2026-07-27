export type TelemetryRecord = Record<string, unknown>;

export type GraphChannel = {
  id: string;
  label: string;
  unit: string;
  aliases: readonly string[];
  color: string;
  strokeDasharray?: string;
};

export type GraphSeries = GraphChannel & {
  values: readonly number[];
};

export type GraphPoint = {
  index: number;
  x: number;
  rpm: number | null;
  [seriesId: string]: number | null;
};

export type GraphRegion = {
  id: string;
  label: string;
  startIndex: number;
  endIndex: number;
  kind: "pull" | "event";
  supportingChannels: readonly string[];
};

export type GraphRegionCoordinates = GraphRegion & {
  x1: number;
  x2: number;
};

export const TELEMETRY_SECTION_CLASS_NAME =
  "bmw-border border border-zinc-800 bg-black";

export const TELEMETRY_PANEL_CLASS_NAME =
  "bmw-border overflow-hidden border border-zinc-800 bg-zinc-950";

export const TELEMETRY_CHANNELS = {
  boostActual: {
    id: "boost_actual",
    label: "Boost Actual",
    unit: "psi",
    aliases: ["boost", "boostValues"],
    color: "#22d3ee",
  },
  boostTarget: {
    id: "boost_target",
    label: "Boost Target",
    unit: "psi",
    aliases: ["boostTarget", "boostTargetValues"],
    color: "#7dd3fc",
    strokeDasharray: "8 5",
  },
  wastegateDuty: {
    id: "wgdc",
    label: "Wastegate Duty Cycle",
    unit: "%",
    aliases: ["wgdc", "wgdcValues"],
    color: "#f59e0b",
  },
  throttlePosition: {
    id: "throttle",
    label: "Throttle Position",
    unit: "%",
    aliases: ["throttle", "throttleValues"],
    color: "#a3e635",
    strokeDasharray: "3 3",
  },
  highPressureFuel: {
    id: "rail_pressure",
    label: "High-Pressure Fuel",
    unit: "psi",
    aliases: [
      "railPressure",
      "rail_pressure",
      "rail",
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
    ],
    color: "#34d399",
  },
  lowPressureFuel: {
    id: "lpfp",
    label: "Low-Pressure Fuel",
    unit: "psi",
    aliases: ["lpfp", "lpfpValues", "lpfpPsi"],
    color: "#c084fc",
  },
  intakeAirTemperature: {
    id: "iat",
    label: "Intake Air Temperature",
    unit: "°C",
    aliases: ["iat", "iatValues", "intakeAirTemp"],
    color: "#facc15",
  },
  airFuelRatio: {
    id: "afr",
    label: "Air-Fuel Ratio",
    unit: "AFR",
    aliases: ["afr", "afrValues"],
    color: "#fb7185",
  },
} as const satisfies Record<string, GraphChannel>;

export const TIMING_CHANNELS: readonly GraphChannel[] = Array.from(
  { length: 6 },
  (_, index) => {
    const cylinder = index + 1;
    return {
      id: `timing_correction_cyl_${cylinder}`,
      label: `Timing Correction Cylinder ${cylinder}`,
      unit: "°",
      aliases: [
        `timing_correction_cyl_${cylinder}`,
        `cyl${cylinder}TimingCorrection`,
        `cyl${cylinder}_timing_correction`,
      ],
      color: [
        "#fda4af",
        "#fb7185",
        "#f43f5e",
        "#e11d48",
        "#be123c",
        "#9f1239",
      ][index],
    };
  }
);

export const RPM_ALIASES = [
  "rpm",
  "rpmValues",
  "engineRpm",
  "engineRPM",
  "RPM",
  "rpmSeries",
  "rpmData",
] as const;

export function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const samples = value.map(Number);

  return samples.every((sample) => Number.isFinite(sample))
    ? samples
    : [];
}

export function getSeries(
  telemetry: unknown,
  aliases: readonly string[]
): number[] {
  if (!telemetry || typeof telemetry !== "object") {
    return [];
  }

  const record = telemetry as TelemetryRecord;

  for (const alias of aliases) {
    const values = toNumberArray(record[alias]);
    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

export function resolveGraphSeries(
  telemetry: unknown,
  channels: readonly GraphChannel[]
): GraphSeries[] {
  return channels
    .map((channel) => ({
      ...channel,
      values: getSeries(telemetry, channel.aliases),
    }))
    .filter((series) => hasRecordedTelemetry(series.values));
}

export function buildGraphPoints(
  series: readonly GraphSeries[],
  rpm: readonly number[]
): {
  points: GraphPoint[];
  usesRpm: boolean;
  hasStoredRpm: boolean;
} {
  const sampleCount = series.reduce(
    (largest, item) => Math.max(largest, item.values.length),
    0
  );
  const hasRpm = sampleCount > 0 && rpm.length === sampleCount;
  const usesRpm =
    hasRpm &&
    rpm.every(
      (value, index) =>
        index === 0 || value >= rpm[index - 1]
    );

  const points = Array.from({ length: sampleCount }, (_, index) => {
    const point: GraphPoint = {
      index,
      x: usesRpm ? rpm[index] : index,
      rpm: hasRpm ? rpm[index] : null,
    };

    for (const item of series) {
      point[item.id] = item.values[index] ?? null;
    }

    return point;
  });

  return {
    points,
    usesRpm,
    hasStoredRpm: hasRpm,
  };
}

export function getHorizontalAxisPresentation(input: {
  usesRpm: boolean;
  hasStoredRpm: boolean;
}): {
  label: string;
  note: string;
} {
  if (input.usesRpm) {
    return {
      label: "Engine Speed (RPM)",
      note: "RPM-indexed record.",
    };
  }

  return {
    label: "Sample Sequence",
    note: input.hasStoredRpm
      ? "Sample-sequenced record. Hover for exact recorded RPM."
      : "Sample-sequenced record. RPM was not recorded.",
  };
}

export function hasRecordedTelemetry(
  values: readonly number[]
): boolean {
  return values.length > 0;
}

export function resolveRegionCoordinates(
  regions: readonly GraphRegion[],
  points: readonly GraphPoint[]
): GraphRegionCoordinates[] {
  return regions.flatMap((region) => {
    const start = points[region.startIndex];
    const end = points[region.endIndex];

    if (!start || !end) {
      return [];
    }

    return [
      {
        ...region,
        x1: start.x,
        x2: end.x,
      },
    ];
  });
}

export function formatGraphValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  const decimals =
    unit === "RPM" || Math.abs(value) >= 1000
      ? 0
      : Math.abs(value) >= 100
        ? 1
        : 2;

  return `${value.toFixed(decimals)} ${unit}`;
}
