export type TelemetryWorkspaceMode = "engineer" | "individual_pull";

export type TelemetryWorkspacePull = {
  id: string;
  startIndex: number;
  endIndex: number;
  rpmStart?: number;
  rpmEnd?: number;
  durationSec?: number;
  quality?: "strong" | "usable" | "questionable";
  issues?: readonly string[];
};

export type TelemetryWorkspacePullInput = {
  id?: string;
  startIndex?: number;
  endIndex?: number;
  rpmStart?: number;
  rpmEnd?: number;
  durationSec?: number;
  quality?: "strong" | "usable" | "questionable";
  issues?: readonly string[];
};

export type TelemetryWorkspaceEvent = {
  id?: string;
  startIndex?: number;
  endIndex?: number;
};

export const DEFAULT_TELEMETRY_WORKSPACE_MODE: TelemetryWorkspaceMode =
  "engineer";

function isSourceBoundary(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export function collectAuthoritativePulls(
  pulls: readonly TelemetryWorkspacePullInput[],
  sampleCount: number
): TelemetryWorkspacePull[] {
  return pulls.flatMap((pull) => {
    if (
      typeof pull.id !== "string" ||
      pull.id.trim().length === 0 ||
      !isSourceBoundary(pull.startIndex) ||
      !isSourceBoundary(pull.endIndex) ||
      pull.startIndex > pull.endIndex ||
      pull.endIndex >= sampleCount
    ) {
      return [];
    }

    return [{ ...pull, id: pull.id, startIndex: pull.startIndex, endIndex: pull.endIndex }];
  });
}

export function sliceTelemetryToPull(
  telemetry: unknown,
  pull: TelemetryWorkspacePull
): unknown {
  if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry)) {
    return telemetry;
  }

  return Object.fromEntries(
    Object.entries(telemetry).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.slice(pull.startIndex, pull.endIndex + 1)
        : value,
    ])
  );
}

export function eventsWithinPull<T extends TelemetryWorkspaceEvent>(
  events: readonly T[],
  pull: TelemetryWorkspacePull
): T[] {
  return events.filter(
    (event) =>
      isSourceBoundary(event.startIndex) &&
      isSourceBoundary(event.endIndex) &&
      event.startIndex >= pull.startIndex &&
      event.endIndex <= pull.endIndex
  );
}
