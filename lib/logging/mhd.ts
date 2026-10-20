import { getMissingCoreChannels, read, readTemperatureC } from "./helpers.ts";
import type { TranslatedLog, TranslatedLogRow } from "./types.ts";

const MHD_ALIASES = {
  time: ["Time", "time", "TIME", "Time (s)"],

  rpm: [
    "RPM",
    "RPM (RPM)",
    "RPM (rpm)",
    "Engine speed (rpm)",
    "Engine Speed",
    "rpm",
    "Engine speed[1/min]",
  ],

  boost: ["Boost Mean PSI", "Boost PSI", "Boost (PSI)", "Boost (Pre-Throttle)[psig]", "(RAM) Boost (Pre-Throttle)[psig]", "(RAM) Boost (MAP)[psig]"],

  boostTarget: ["Boost target (PSI)", "Boost Target PSI", "Boost Setpoint (PSI)", "Boost pressure (Target)[psig]", "(RAM) Boost Pressure (Target)[psig]", "(RAM) Boost Pressure (Manifold Target)[psig]"],

  afr: [
    "Lambda bank 1 (AFR)",
    "Lambda 1 (AFR)",
    "Lambda[AFR]",
    "Lambda Act.[AFR]",
    "AFR",
    "afr",
    "Bank 1 AFR",
  ],

  lambda: ["Lambda", "Lambda Bank 1"],

  railPressure: ["Rail pressure (PSI)", "Rail Pressure (PSI)", "Rail pressure mean 1 (PSI)", "rail_pressure_psi", "HPFP Act.[psig]"],

  lpfp: ["Fuel low pressure sensor (PSI)", "Fuel Low Pressure Sensor (PSI)", "Low pressure fuel pump (PSI)", "LPFP (PSI)", "lpfp_psi", "LPFP Act. (Raw)[psig]"],

  wgdc: ["WGDC Bank 1 (%)", "WGDC 1 (%)", "WGDC[%]"],

  throttle: ["Throttle Position (%)", "Throttle Angle[%]"],

  acceleratorPedal: ["Accel. Pedal[%]", "Accel Ped. Pos. (%)"],

  timingCyl1: ["Cyl1 Timing Cor (*)", "Cyl 1 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 1[°]"],

  timingCyl2: ["Cyl2 Timing Cor (*)", "Cyl 2 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 2[°]"],

  timingCyl3: ["Cyl3 Timing Cor (*)", "Cyl 3 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 3[°]"],

  timingCyl4: ["Cyl4 Timing Cor (*)", "Cyl 4 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 4[°]"],

  timingCyl5: ["Cyl5 Timing Cor (*)", "Cyl 5 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 5[°]"],

  timingCyl6: ["Cyl6 Timing Cor (*)", "Cyl 6 Timing Cor (*)", "(RAM) Ignition Timing Corr. Cyl. 6[°]"],
};

export function translateMhdRows(
  rawRows: Record<string, unknown>[],
): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});

  const rows: TranslatedLogRow[] = rawRows.map((row) => {
    const acceleratorPedal = read(row, MHD_ALIASES.acceleratorPedal);
    const throttlePlate = read(row, MHD_ALIASES.throttle);
    const boostPsi = read(row, MHD_ALIASES.boost);
    const boostTargetPsi = read(row, MHD_ALIASES.boostTarget);
    const boostErrorPsi =
      boostPsi !== null && boostTargetPsi !== null
        ? boostTargetPsi - boostPsi
        : null;

    return {
      time: read(row, MHD_ALIASES.time),
      rpm: read(row, MHD_ALIASES.rpm),
      throttle: acceleratorPedal ?? throttlePlate,
      throttlePlate,
      acceleratorPedal,
      boostPsi,
      boostTargetPsi,
      boostErrorPsi,
      wgdc: read(row, MHD_ALIASES.wgdc),
      railPressure: read(row, MHD_ALIASES.railPressure),
      lpfp: read(row, MHD_ALIASES.lpfp),
      afr: read(row, MHD_ALIASES.afr),
      lambda: read(row, MHD_ALIASES.lambda),
      timingCyl1: read(row, MHD_ALIASES.timingCyl1),
      timingCyl2: read(row, MHD_ALIASES.timingCyl2),
      timingCyl3: read(row, MHD_ALIASES.timingCyl3),
      timingCyl4: read(row, MHD_ALIASES.timingCyl4),
      timingCyl5: read(row, MHD_ALIASES.timingCyl5),
      timingCyl6: read(row, MHD_ALIASES.timingCyl6),
      iat: readTemperatureC(row),
      ethanol: read(row, ["Ethanol Content (%)", "Ethanol content (%)", "Ethanol Content (Active) (%)", "Ethanol Content[%]"]),
    };
  });

  return {
    platform: "mhd",
    confidence: 0.9,
    rowCount: rawRows.length,
    rows,
    detectedHeaders: headers,
    missingCoreChannels: getMissingCoreChannels(rows),
  };
}
