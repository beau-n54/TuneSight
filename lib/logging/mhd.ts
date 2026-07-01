import { getMissingCoreChannels, read } from "./helpers";
import type { TranslatedLog, TranslatedLogRow } from "./types";

const MHD_ALIASES = {
  time: ["Time", "time", "TIME", "Time (s)", "Timestamp", "timestamp"],

  rpm: [
    "RPM",
    "RPM (RPM)",
    "Engine speed (rpm)",
    "Engine Speed",
    "rpm",
    "Engine speed[1/min]",
  ],

  boost: [
    "Boost Mean PSI",
    "Boost PSI",
    "Boost (PSI)",
    "Boost",
    "boost",
    "Boost (Pre-Throttle)[psig]",
    "(RAM) Boost (Pre-Throttle)[psig]",
    "(RAM) Boost (MAP)[psig]",
  ],

  boostTarget: [
    "Boost target (PSI)",
    "Boost Target",
    "Boost Target PSI",
    "Boost Setpoint (PSI)",
    "Load req.",
    "Load req",
    "Requested Load",
    "Load requested",
    "boost_target",
    "Boost pressure (Target)[psig]",
    "(RAM) Boost Pressure (Target)[psig]",
    "(RAM) Boost Pressure (Manifold Target)[psig]",
  ],

  iat: [
    "IAT (*C)",
    "IAT (C)",
    "IAT",
    "iat",
    "IAT[F]",
    "Intake Air Temp",
    "Intake Air Temperature",
  ],

  afr: [
    "Lambda bank 1 (AFR)",
    "Lambda bank 2 (AFR)",
    "Lambda[AFR]",
    "Lambda Act.[AFR]",
    "AFR",
    "afr",
    "Bank 1 AFR",
  ],

  lambda: ["Lambda", "Lambda Bank 1", "Lambda Bank 2"],

  railPressure: [
    "Rail pressure (PSI)",
    "Rail Pressure (PSI)",
    "Rail Pressure",
    "HPFP",
    "Fuel Rail Pressure",
    "rail_pressure",
    "railPressure",
    "rail_pressure_psi",
    "fuel_rail_pressure",
    "fuelRailPressure",
    "HPFP Act.[psig]",
  ],

  lpfp: [
    "Fuel low pressure sensor (PSI)",
    "Fuel Low Pressure Sensor (PSI)",
    "Low pressure fuel pump (PSI)",
    "LPFP (PSI)",
    "LPFP",
    "Low Pressure Fuel Pump",
    "lpfp",
    "lpfp_psi",
    "fuel_low_pressure",
    "LPFP Act. (Raw)[psig]",
  ],

  wgdc: [
    "WGDC Bank 1 (%)",
    "WGDC Bank 1",
    "WGDC",
    "Wastegate Duty Cycle",
    "wgdc",
    "WGDC[%]",
  ],

  throttle: [
    "Throttle Position",
    "Throttle",
    "throttle",
    "Throttle Angle[%]",
    "Accel. Pedal[%]",
  ],

  timingCyl1: [
    "timing_correction_cyl_1",
    "Cyl1 Timing Cor (*)",
    "Timing Cyl. 1",
    "Timing Cyl 1",
    "Ignition Timing Cyl 1",
    "cyl1_timing",
    "(RAM) Ignition Timing Corr. Cyl. 1[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 1[°]",
  ],

  timingCyl2: [
    "timing_correction_cyl_2",
    "Cyl2 Timing Cor (*)",
    "Timing Cyl. 2",
    "Timing Cyl 2",
    "Ignition Timing Cyl 2",
    "cyl2_timing",
    "(RAM) Ignition Timing Corr. Cyl. 2[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 2[°]",
  ],

  timingCyl3: [
    "timing_correction_cyl_3",
    "Cyl3 Timing Cor (*)",
    "Timing Cyl. 3",
    "Timing Cyl 3",
    "Ignition Timing Cyl 3",
    "cyl3_timing",
    "(RAM) Ignition Timing Corr. Cyl. 3[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 3[°]",
  ],

  timingCyl4: [
    "timing_correction_cyl_4",
    "Cyl4 Timing Cor (*)",
    "Cyl 4 Timing Cor (*)",
    "Cyl4 Timing Correction",
    "Cyl 4 Timing Correction",
    "Timing Correction Cyl 4",
    "Timing Cyl 4 Correction",
    "Timing Cyl. 4",
    "Timing Cyl 4",
    "Ignition Timing Cyl 4",
    "cyl4_timing",
    "(RAM) Ignition Timing Corr. Cyl. 4[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 4[°]",
  ],

  timingCyl5: [
    "timing_correction_cyl_5",
    "Cyl5 Timing Cor (*)",
    "Timing Cyl. 5",
    "Timing Cyl 5",
    "Ignition Timing Cyl 5",
    "cyl5_timing",
    "(RAM) Ignition Timing Corr. Cyl. 5[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 5[°]",
  ],

  timingCyl6: [
    "timing_correction_cyl_6",
    "Cyl6 Timing Cor (*)",
    "Timing Cyl. 6",
    "Timing Cyl 6",
    "Ignition Timing Cyl 6",
    "cyl6_timing",
    "(RAM) Ignition Timing Corr. Cyl. 6[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 6[°]",
  ],
};

export function translateMhdRows(
  rawRows: Record<string, unknown>[],
): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});

  const rows: TranslatedLogRow[] = rawRows.map((row) => {
    const boostPsi = read(row, MHD_ALIASES.boost);
    const boostTargetPsi = read(row, MHD_ALIASES.boostTarget);
    const boostErrorPsi =
      boostPsi !== null && boostTargetPsi !== null
        ? boostTargetPsi - boostPsi
        : null;

    return {
      time: read(row, MHD_ALIASES.time),
      rpm: read(row, MHD_ALIASES.rpm),
      throttle: read(row, MHD_ALIASES.throttle),
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
      iat: read(row, MHD_ALIASES.iat),
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