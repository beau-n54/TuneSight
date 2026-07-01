import { getMissingCoreChannels, read } from "./helpers";
import type { TranslatedLog, TranslatedLogRow } from "./types";

export function translateBm3Rows(rawRows: Record<string, unknown>[]): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});

  const rows: TranslatedLogRow[] = rawRows.map((row) => {
    const boostPsi = read(row, ["Boost", "Boost (psi)", "Boost Pressure"]);
    const boostTargetPsi = read(row, ["Boost Target", "Target Boost", "Boost Target (psi)"]);
    const boostErrorPsi =
      boostPsi !== null && boostTargetPsi !== null ? boostTargetPsi - boostPsi : null;

    return {
      time: read(row, ["Time", "Time (s)", "Timestamp"]),
      rpm: read(row, ["RPM", "Engine Speed", "Engine Speed (RPM)"]),
      throttle: read(row, ["Throttle", "Throttle Position", "Pedal Position"]),
      boostPsi,
      boostTargetPsi,
      boostErrorPsi,
      wgdc: read(row, ["WGDC", "Wastegate Duty Cycle", "Wastegate (%)"]),
      railPressure: read(row, ["Rail Pressure", "Fuel Rail Pressure", "HPFP"]),
      lpfp: read(row, ["LPFP", "Low Pressure Fuel Pump", "Low Fuel Pressure"]),
      afr: read(row, ["AFR", "AFR Bank 1"]),
      lambda: read(row, ["Lambda", "Lambda Bank 1", "Lambda Actual"]),
      timingCyl1: read(row, ["Timing Cyl 1", "Ignition Timing Cyl 1", "Ignition Cyl 1"]),
      timingCyl2: read(row, ["Timing Cyl 2", "Ignition Timing Cyl 2", "Ignition Cyl 2"]),
      timingCyl3: read(row, ["Timing Cyl 3", "Ignition Timing Cyl 3", "Ignition Cyl 3"]),
      timingCyl4: read(row, ["Timing Cyl 4", "Ignition Timing Cyl 4", "Ignition Cyl 4"]),
      timingCyl5: read(row, ["Timing Cyl 5", "Ignition Timing Cyl 5", "Ignition Cyl 5"]),
      timingCyl6: read(row, ["Timing Cyl 6", "Ignition Timing Cyl 6", "Ignition Cyl 6"]),
      iat: read(row, ["IAT", "Intake Air Temperature", "Charge Air Temp"]),
    };
  });

  return {
    platform: "bm3",
    confidence: 0.9,
    rowCount: rawRows.length,
    rows,
    detectedHeaders: headers,
   missingCoreChannels: getMissingCoreChannels(rows),
  };
}