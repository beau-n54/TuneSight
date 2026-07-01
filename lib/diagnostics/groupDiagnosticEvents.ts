export type DiagnosticEventGroup =
  | "Fueling"
  | "Boost Control"
  | "Ignition"
  | "Thermal"
  | "Airflow"
  | "Drivetrain"
  | "General";

export type GroupableDiagnosticEvent = {
  category?: string;
  source?: string;
  event?: {
    type?: string;
  };
};

export function getDiagnosticEventGroup(
  event: GroupableDiagnosticEvent
): DiagnosticEventGroup {
  const searchableText = [
    event.category,
    event.source,
    event.event?.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    searchableText.includes("fuel") ||
    searchableText.includes("rail") ||
    searchableText.includes("lpfp") ||
    searchableText.includes("hpfp") ||
    searchableText.includes("afr") ||
    searchableText.includes("lambda")
  ) {
    return "Fueling";
  }

  if (
    searchableText.includes("boost") ||
    searchableText.includes("wgdc") ||
    searchableText.includes("wastegate") ||
    searchableText.includes("turbo")
  ) {
    return "Boost Control";
  }

  if (
    searchableText.includes("timing") ||
    searchableText.includes("ignition") ||
    searchableText.includes("knock") ||
    searchableText.includes("correction") ||
    searchableText.includes("misfire")
  ) {
    return "Ignition";
  }

  if (
    searchableText.includes("iat") ||
    searchableText.includes("temp") ||
    searchableText.includes("thermal") ||
    searchableText.includes("coolant") ||
    searchableText.includes("oil")
  ) {
    return "Thermal";
  }

  if (
    searchableText.includes("air") ||
    searchableText.includes("load") ||
    searchableText.includes("maf") ||
    searchableText.includes("map") ||
    searchableText.includes("throttle")
  ) {
    return "Airflow";
  }

  if (
    searchableText.includes("torque") ||
    searchableText.includes("trans") ||
    searchableText.includes("gear") ||
    searchableText.includes("drivetrain")
  ) {
    return "Drivetrain";
  }

  return "General";
}

export function groupDiagnosticEvents<T extends GroupableDiagnosticEvent>(
  events: T[]
): Record<DiagnosticEventGroup, T[]> {
  const groups: Record<DiagnosticEventGroup, T[]> = {
    Fueling: [],
    "Boost Control": [],
    Ignition: [],
    Thermal: [],
    Airflow: [],
    Drivetrain: [],
    General: [],
  };

  for (const event of events) {
    const group = getDiagnosticEventGroup(event);
    groups[group].push(event);
  }

  return groups;
}