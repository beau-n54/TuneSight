import { getMissingCoreChannels, read, readTemperatureC } from "./helpers.ts";
import type { TranslatedLog, TranslatedLogRow } from "./types.ts";

export function translateBm3Rows(rawRows: Record<string, unknown>[]): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});

  const rows: TranslatedLogRow[] = rawRows.map((row) => {
    const boostPsi = read(row, ["Boost (psi)", "Boost Pressure (psi)", "Boost (Pre-Throttle)[psig]"]);
    const boostTargetPsi = read(row, ["Boost Target (psi)", "Target Boost (psi)", "Boost pressure (Target)[psig]"]);
    const throttlePlate = read(row, ["Throttle Angle[%]", "Throttle Position (%)"]);
    const acceleratorPedal = read(row, ["Accel. Pedal[%]", "Pedal Position (%)"]);
    const boostErrorPsi =
      boostPsi !== null && boostTargetPsi !== null ? boostTargetPsi - boostPsi : null;

    return {
      time: read(row, ["Time", "Time (s)"]),
      rpm: read(row, ["RPM", "Engine Speed", "Engine Speed (RPM)"]),
      throttle: acceleratorPedal ?? throttlePlate,
      throttlePlate,
      acceleratorPedal,
      boostPsi,
      boostTargetPsi,
      boostErrorPsi,
      wgdc: read(row, ["Wastegate (%)", "WGDC[%]"]),
      railPressure: read(row, ["Rail Pressure (psi)", "HPFP Act.[psig]"]),
      lpfp: read(row, ["LPFP (psi)", "LPFP Act. (Raw)[psig]"]),
      afr: read(row, ["AFR", "AFR Bank 1"]),
      lambda: read(row, ["Lambda", "Lambda Bank 1", "Lambda Actual"]),
      timingCyl1: read(row, ["Cyl1 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 1[°]"]),
      timingCyl2: read(row, ["Cyl2 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 2[°]"]),
      timingCyl3: read(row, ["Cyl3 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 3[°]"]),
      timingCyl4: read(row, ["Cyl4 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 4[°]"]),
      timingCyl5: read(row, ["Cyl5 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 5[°]"]),
      timingCyl6: read(row, ["Cyl6 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 6[°]"]),
      iat: readTemperatureC(row),
      ethanol: read(row, ["Ethanol Content (%)", "Ethanol content (%)", "Ethanol Content[%]"]),
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
