import { getMissingCoreChannels, read, readTemperatureC, readAdditionalCylinderCorrection } from "./helpers.ts";
import type { TranslatedLog, TranslatedLogRow } from "./types.ts";

export const BM3_ALIASES = {
  boostPsi: ["Boost (psi)", "Boost Pressure (psi)", "Boost (Pre-Throttle)[psig]"],
  boostTargetPsi: ["Boost Target (psi)", "Target Boost (psi)", "Boost pressure (Target)[psig]"],
  throttlePlate: ["Throttle Angle[%]", "Throttle Position (%)"],
  acceleratorPedal: ["Accel. Pedal[%]", "Pedal Position (%)"],
  time: ["Time", "Time (s)"],
  rpm: ["RPM", "Engine Speed", "Engine Speed (RPM)"],
  wgdc: ["Wastegate (%)", "WGDC[%]"],
  railPressure: ["Rail Pressure (psi)", "HPFP Act.[psig]"],
  lpfp: ["LPFP (psi)", "LPFP Act. (Raw)[psig]"],
  afr: ["AFR", "AFR Bank 1"],
  lambda: ["Lambda", "Lambda Bank 1", "Lambda Actual"],
  timingCyl1: ["Cyl1 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 1[°]"],
  timingCyl2: ["Cyl2 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 2[°]"],
  timingCyl3: ["Cyl3 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 3[°]"],
  timingCyl4: ["Cyl4 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 4[°]"],
  timingCyl5: ["Cyl5 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 5[°]"],
  timingCyl6: ["Cyl6 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 6[°]"],
  ethanol: ["Ethanol Content (%)", "Ethanol content (%)", "Ethanol Content[%]"],
};

export function translateBm3Rows(rawRows: Record<string, unknown>[]): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});

  const rows: TranslatedLogRow[] = rawRows.map((row) => {
    const boostPsi = read(row, BM3_ALIASES.boostPsi);
    const boostTargetPsi = read(row, BM3_ALIASES.boostTargetPsi);
    const throttlePlate = read(row, BM3_ALIASES.throttlePlate);
    const acceleratorPedal = read(row, BM3_ALIASES.acceleratorPedal);
    const boostErrorPsi =
      boostPsi !== null && boostTargetPsi !== null ? boostTargetPsi - boostPsi : null;

    return {
      time: read(row, BM3_ALIASES.time),
      rpm: read(row, BM3_ALIASES.rpm),
      throttle: acceleratorPedal ?? throttlePlate,
      throttlePlate,
      acceleratorPedal,
      boostPsi,
      boostTargetPsi,
      boostErrorPsi,
      wgdc: read(row, BM3_ALIASES.wgdc),
      railPressure: read(row, BM3_ALIASES.railPressure),
      lpfp: read(row, BM3_ALIASES.lpfp),
      afr: read(row, BM3_ALIASES.afr),
      lambda: read(row, BM3_ALIASES.lambda),
      timingCyl1: read(row, BM3_ALIASES.timingCyl1),
      timingCyl2: read(row, BM3_ALIASES.timingCyl2),
      timingCyl3: read(row, BM3_ALIASES.timingCyl3),
      timingCyl4: read(row, BM3_ALIASES.timingCyl4),
      timingCyl5: read(row, BM3_ALIASES.timingCyl5),
      timingCyl6: read(row, BM3_ALIASES.timingCyl6),
      timingCyl7: readAdditionalCylinderCorrection(row, 7),
      timingCyl8: readAdditionalCylinderCorrection(row, 8),
      iat: readTemperatureC(row),
      ethanol: read(row, BM3_ALIASES.ethanol),
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
