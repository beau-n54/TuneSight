import { NextResponse } from "next/server";
import { translateLogRows } from "@/lib/logging/translator";
import { createClient } from "@/lib/supabase/server";
import { buildAnalysisResult } from "@/lib/analysis/engine";
import type {
  ParsedLog,
  TuneProfile,
  VehicleSetup,
} from "@/lib/analysis/types";

type NumericRow = Record<string, number>;

type ChannelMatch = {
  value: number;
  header: string;
};

const LOG_ALIASES = {
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

  iat: ["IAT (*C)", "IAT (C)", "IAT", "iat", "IAT[F]"],

  afrBank1: [
    "Lambda bank 1 (AFR)",
    "Lambda[AFR]",
    "Lambda Act.[AFR]",
    "AFR",
    "afr",
  ],

  afrBank2: [
    "Lambda bank 2 (AFR)",
    "Lambda[AFR]",
    "Lambda Act.[AFR]",
    "AFR",
    "afr",
  ],

  railPressure: [
    "Rail pressure (PSI)",
    "Rail Pressure (PSI)",
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
    "lpfp",
    "lpfp_psi",
    "fuel_low_pressure",
    "LPFP Act. (Raw)[psig]",
  ],

  wgdc: ["WGDC Bank 1 (%)", "WGDC Bank 1", "wgdc", "WGDC[%]"],

  ethanol: [
    "Ethanol Content (Active) (%)",
    "ethanol_content",
    "(BM3) Flex Ethanol %[%]",
    "(BM3) Flex Ethanol % (Sensor)[%]",
  ],

  throttle: [
    "Throttle Position",
    "throttle",
    "Throttle Angle[%]",
    "Accel. Pedal[%]",
  ],

  timingCorrectionCyl1: [
    "timing_correction_cyl_1",
    "Cyl1 Timing Cor (*)",
    "Timing Cyl. 1",
    "cyl1_timing",
    "(RAM) Ignition Timing Corr. Cyl. 1[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 1[°]",
  ],

  timingCorrectionCyl2: [
    "timing_correction_cyl_2",
    "Cyl2 Timing Cor (*)",
    "Timing Cyl. 2",
    "cyl2_timing",
    "(RAM) Ignition Timing Corr. Cyl. 2[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 2[°]",
  ],

  timingCorrectionCyl3: [
    "timing_correction_cyl_3",
    "Cyl3 Timing Cor (*)",
    "Timing Cyl. 3",
    "cyl3_timing",
    "(RAM) Ignition Timing Corr. Cyl. 3[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 3[°]",
  ],

  timingCorrectionCyl4: [
    "timing_correction_cyl_4",
    "Cyl4 Timing Cor (*)",
    "Cyl 4 Timing Cor (*)",
    "Cyl4 Timing Correction",
    "Cyl 4 Timing Correction",
    "Timing Correction Cyl 4",
    "Timing Cyl 4 Correction",
    "Timing Cyl. 4",
    "cyl4_timing",
    "(RAM) Ignition Timing Corr. Cyl. 4[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 4[°]",
  ],

  timingCorrectionCyl5: [
    "timing_correction_cyl_5",
    "Cyl5 Timing Cor (*)",
    "Timing Cyl. 5",
    "cyl5_timing",
    "(RAM) Ignition Timing Corr. Cyl. 5[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 5[°]",
  ],

  timingCorrectionCyl6: [
    "timing_correction_cyl_6",
    "Cyl6 Timing Cor (*)",
    "Timing Cyl. 6",
    "cyl6_timing",
    "(RAM) Ignition Timing Corr. Cyl. 6[ï¿½]",
    "(RAM) Ignition Timing Corr. Cyl. 6[°]",
  ],
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalizeHeaderName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\uFFFD/g, "")
    .replace(/ï¿½/g, "")
    .replace(/°/g, "")
    .replace(/[^\w]+/g, "")
    .trim();
}

function parseCSV(csvText: string): { headers: string[]; rows: NumericRow[] } {
  const allLines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const lines = allLines.filter((line) => !line.startsWith("#"));

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = parseCSVLine(lines[0]);

  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: NumericRow = {};

    headers.forEach((header, index) => {
      const rawValue = values[index];
      const numericValue = rawValue !== undefined ? parseFloat(rawValue) : NaN;

      if (!Number.isNaN(numericValue)) {
        row[header.trim()] = numericValue;
      }
    });

    return row;
  });

  return { headers, rows };
}

function findColumnMatch(
  row: NumericRow,
  possibleNames: string[]
): ChannelMatch | undefined {
  const normalizedRow: Record<string, ChannelMatch> = {};

  Object.keys(row).forEach((header) => {
    normalizedRow[normalizeHeaderName(header)] = {
      value: row[header],
      header,
    };
  });

  for (const key of possibleNames) {
    if (row[key] !== undefined) {
      return {
        value: row[key],
        header: key,
      };
    }

    const normalizedMatch = normalizedRow[normalizeHeaderName(key)];

    if (normalizedMatch !== undefined) {
      return normalizedMatch;
    }
  }

  return undefined;
}

function findColumnValue(
  row: NumericRow,
  possibleNames: string[]
): number | undefined {
  return findColumnMatch(row, possibleNames)?.value;
}

function fahrenheitToCelsius(value: number): number {
  return (value - 32) * (5 / 9);
}

function normalizeIat(match: ChannelMatch | undefined): number | undefined {
  if (!match) return undefined;

  const normalizedHeader = normalizeHeaderName(match.header);
  const isFahrenheit =
    normalizedHeader.includes("iatf") ||
    match.header.toLowerCase().includes("[f]") ||
    match.header.toLowerCase().includes("(f)");

  return isFahrenheit ? fahrenheitToCelsius(match.value) : match.value;
}

function normalizeBoostTarget(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  let fixedBoostTarget = Number(value);

  while (fixedBoostTarget > 40) {
    fixedBoostTarget = fixedBoostTarget / 10;
  }

  return Number(fixedBoostTarget.toFixed(1));
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maximum(values: number[]): number | null {
  if (!values.length) return null;
  return Math.max(...values);
}

function minimum(values: number[]): number | null {
  if (!values.length) return null;
  return Math.min(...values);
}

function buildParsedLog(rows: NumericRow[]): {
  parsedLog: ParsedLog;
  extracted: {
    boostValues: number[];
    boostTargetValues: number[];
    iatValues: number[];
    afrValues: number[];
    railPressureValues: number[];
    lpfpValues: number[];
    wgdcValues: number[];
    ethanolValues: number[];
    throttleValues: number[];
    cyl1Vals: number[];
    cyl2Vals: number[];
    cyl3Vals: number[];
    cyl4Vals: number[];
    cyl5Vals: number[];
    cyl6Vals: number[];
  };
} {
  const boostValues: number[] = [];
  const boostTargetValues: number[] = [];
  const iatValues: number[] = [];
  const afrValues: number[] = [];
  const railPressureValues: number[] = [];
  const lpfpValues: number[] = [];
  const wgdcValues: number[] = [];
  const ethanolValues: number[] = [];
  const throttleValues: number[] = [];

  const cyl1Vals: number[] = [];
  const cyl2Vals: number[] = [];
  const cyl3Vals: number[] = [];
  const cyl4Vals: number[] = [];
  const cyl5Vals: number[] = [];
  const cyl6Vals: number[] = [];

  const parsedLog: ParsedLog = {
    sampleCount: rows.length,
    durationSec: 0,
    timestamps: [],
    rpm: [],
    channels: {
      boost: [],
      boost_target: [],
      iat: [],
      afr: [],
      rail_pressure: [],
      lpfp: [],
      wgdc: [],
      ethanol: [],
      throttle: [],
      rpm: [],
      timing_correction_cyl_1: [],
      timing_correction_cyl_2: [],
      timing_correction_cyl_3: [],
      timing_correction_cyl_4: [],
      timing_correction_cyl_5: [],
      timing_correction_cyl_6: [],
    },
  };

  rows.forEach((row, index) => {
    const time = findColumnValue(row, LOG_ALIASES.time) ?? index;
    const rpm = findColumnValue(row, LOG_ALIASES.rpm);
    const boost = findColumnValue(row, LOG_ALIASES.boost);
    const boostTarget = normalizeBoostTarget(
      findColumnValue(row, LOG_ALIASES.boostTarget)
    );
    const iat = normalizeIat(findColumnMatch(row, LOG_ALIASES.iat));
    const afr1 = findColumnValue(row, LOG_ALIASES.afrBank1);
    const afr2 = findColumnValue(row, LOG_ALIASES.afrBank2);
    const rail = findColumnValue(row, LOG_ALIASES.railPressure);
    const lpfp = findColumnValue(row, LOG_ALIASES.lpfp);
    const wgdc = findColumnValue(row, LOG_ALIASES.wgdc);
    const ethanol = findColumnValue(row, LOG_ALIASES.ethanol);
    const throttle = findColumnValue(row, LOG_ALIASES.throttle);

    const c1 = findColumnValue(row, LOG_ALIASES.timingCorrectionCyl1);
    const c2 = findColumnValue(row, LOG_ALIASES.timingCorrectionCyl2);
    const c3 = findColumnValue(row, LOG_ALIASES.timingCorrectionCyl3);
    const c4 = findColumnValue(row, LOG_ALIASES.timingCorrectionCyl4);
    const c5 = findColumnValue(row, LOG_ALIASES.timingCorrectionCyl5);
    const c6 = findColumnValue(row, LOG_ALIASES.timingCorrectionCyl6);

    parsedLog.timestamps.push(time);
    parsedLog.rpm.push(rpm ?? 0);
    parsedLog.channels.rpm.push(rpm ?? 0);

    if (boost !== undefined) {
      boostValues.push(boost);
      parsedLog.channels.boost.push(boost);
    } else {
      parsedLog.channels.boost.push(0);
    }

    if (boostTarget !== undefined) {
      boostTargetValues.push(boostTarget);
      parsedLog.channels.boost_target.push(boostTarget);
    } else {
      parsedLog.channels.boost_target.push(0);
    }

    if (iat !== undefined) {
      iatValues.push(iat);
      parsedLog.channels.iat.push(iat);
    } else {
      parsedLog.channels.iat.push(0);
    }

    const afr = afr1 ?? afr2;
    if (afr1 !== undefined) afrValues.push(afr1);
    if (afr2 !== undefined) afrValues.push(afr2);
    parsedLog.channels.afr.push(afr ?? 0);

    if (rail !== undefined) {
      railPressureValues.push(rail);
      parsedLog.channels.rail_pressure.push(rail);
    } else {
      parsedLog.channels.rail_pressure.push(0);
    }

    if (lpfp !== undefined) {
      lpfpValues.push(lpfp);
      parsedLog.channels.lpfp.push(lpfp);
    } else {
      parsedLog.channels.lpfp.push(0);
    }

    if (wgdc !== undefined) {
      wgdcValues.push(wgdc);
      parsedLog.channels.wgdc.push(wgdc);
    } else {
      parsedLog.channels.wgdc.push(0);
    }

    if (ethanol !== undefined) {
      ethanolValues.push(ethanol);
      parsedLog.channels.ethanol.push(ethanol);
    } else {
      parsedLog.channels.ethanol.push(0);
    }

    if (throttle !== undefined) {
      throttleValues.push(throttle);
      parsedLog.channels.throttle.push(throttle);
    } else {
      parsedLog.channels.throttle.push(0);
    }

    if (c1 != null) cyl1Vals.push(c1);
    if (c2 != null) cyl2Vals.push(c2);
    if (c3 != null) cyl3Vals.push(c3);
    if (c4 != null) cyl4Vals.push(c4);
    if (c5 != null) cyl5Vals.push(c5);
    if (c6 != null) cyl6Vals.push(c6);

    parsedLog.channels.timing_correction_cyl_1.push(c1 ?? 0);
    parsedLog.channels.timing_correction_cyl_2.push(c2 ?? 0);
    parsedLog.channels.timing_correction_cyl_3.push(c3 ?? 0);
    parsedLog.channels.timing_correction_cyl_4.push(c4 ?? 0);
    parsedLog.channels.timing_correction_cyl_5.push(c5 ?? 0);
    parsedLog.channels.timing_correction_cyl_6.push(c6 ?? 0);
  });

  if (parsedLog.timestamps.length > 1) {
    parsedLog.durationSec =
      parsedLog.timestamps[parsedLog.timestamps.length - 1] -
      parsedLog.timestamps[0];
  }

  return {
    parsedLog,
    extracted: {
      boostValues,
      boostTargetValues,
      iatValues,
      afrValues,
      railPressureValues,
      lpfpValues,
      wgdcValues,
      ethanolValues,
      throttleValues,
      cyl1Vals,
      cyl2Vals,
      cyl3Vals,
      cyl4Vals,
      cyl5Vals,
      cyl6Vals,
    },
  };
}

function buildParsedLogFromTranslatedLog(translatedLog: ReturnType<typeof translateLogRows>): {
  parsedLog: ParsedLog;
  extracted: ReturnType<typeof buildParsedLog>["extracted"];
} {
  const rows = translatedLog.rows;

  const boostValues: number[] = [];
  const boostTargetValues: number[] = [];
  const iatValues: number[] = [];
  const afrValues: number[] = [];
  const railPressureValues: number[] = [];
  const lpfpValues: number[] = [];
  const wgdcValues: number[] = [];
  const ethanolValues: number[] = [];
  const throttleValues: number[] = [];

  const cyl1Vals: number[] = [];
  const cyl2Vals: number[] = [];
  const cyl3Vals: number[] = [];
  const cyl4Vals: number[] = [];
  const cyl5Vals: number[] = [];
  const cyl6Vals: number[] = [];

  const parsedLog: ParsedLog = {
    sampleCount: rows.length,
    durationSec: 0,
    timestamps: [],
    rpm: [],
    channels: {
      boost: [],
      boost_target: [],
      iat: [],
      afr: [],
      rail_pressure: [],
      lpfp: [],
      wgdc: [],
      ethanol: [],
      throttle: [],
      rpm: [],
      timing_correction_cyl_1: [],
      timing_correction_cyl_2: [],
      timing_correction_cyl_3: [],
      timing_correction_cyl_4: [],
      timing_correction_cyl_5: [],
      timing_correction_cyl_6: [],
    },
  };

  rows.forEach((row, index) => {
    const time = row.time ?? index;
    const rpm = row.rpm ?? 0;
    const boost = row.boostPsi ?? null;
    const boostTarget = normalizeBoostTarget(row.boostTargetPsi ?? undefined);
    const iat = row.iat ?? null;
    const afr = row.afr ?? null;
    const rail = row.railPressure ?? null;
    const lpfp = row.lpfp ?? null;
    const wgdc = row.wgdc ?? null;
    const throttle = row.throttle ?? null;

    const c1 = row.timingCyl1 ?? null;
    const c2 = row.timingCyl2 ?? null;
    const c3 = row.timingCyl3 ?? null;
    const c4 = row.timingCyl4 ?? null;
    const c5 = row.timingCyl5 ?? null;
    const c6 = row.timingCyl6 ?? null;

    parsedLog.timestamps.push(time);
    parsedLog.rpm.push(rpm);
    parsedLog.channels.rpm.push(rpm);

    if (boost !== null) {
      boostValues.push(boost);
      parsedLog.channels.boost.push(boost);
    } else {
      parsedLog.channels.boost.push(0);
    }

    if (boostTarget !== undefined) {
      boostTargetValues.push(boostTarget);
      parsedLog.channels.boost_target.push(boostTarget);
    } else {
      parsedLog.channels.boost_target.push(0);
    }

    if (iat !== null) {
      iatValues.push(iat);
      parsedLog.channels.iat.push(iat);
    } else {
      parsedLog.channels.iat.push(0);
    }

    if (afr !== null) {
      afrValues.push(afr);
      parsedLog.channels.afr.push(afr);
    } else {
      parsedLog.channels.afr.push(0);
    }

    if (rail !== null) {
      railPressureValues.push(rail);
      parsedLog.channels.rail_pressure.push(rail);
    } else {
      parsedLog.channels.rail_pressure.push(0);
    }

    if (lpfp !== null) {
      lpfpValues.push(lpfp);
      parsedLog.channels.lpfp.push(lpfp);
    } else {
      parsedLog.channels.lpfp.push(0);
    }

    if (wgdc !== null) {
      wgdcValues.push(wgdc);
      parsedLog.channels.wgdc.push(wgdc);
    } else {
      parsedLog.channels.wgdc.push(0);
    }

    parsedLog.channels.ethanol.push(0);

    if (throttle !== null) {
      throttleValues.push(throttle);
      parsedLog.channels.throttle.push(throttle);
    } else {
      parsedLog.channels.throttle.push(0);
    }

    if (c1 !== null) cyl1Vals.push(c1);
    if (c2 !== null) cyl2Vals.push(c2);
    if (c3 !== null) cyl3Vals.push(c3);
    if (c4 !== null) cyl4Vals.push(c4);
    if (c5 !== null) cyl5Vals.push(c5);
    if (c6 !== null) cyl6Vals.push(c6);

    parsedLog.channels.timing_correction_cyl_1.push(c1 ?? 0);
    parsedLog.channels.timing_correction_cyl_2.push(c2 ?? 0);
    parsedLog.channels.timing_correction_cyl_3.push(c3 ?? 0);
    parsedLog.channels.timing_correction_cyl_4.push(c4 ?? 0);
    parsedLog.channels.timing_correction_cyl_5.push(c5 ?? 0);
    parsedLog.channels.timing_correction_cyl_6.push(c6 ?? 0);
  });

  if (parsedLog.timestamps.length > 1) {
    parsedLog.durationSec =
      parsedLog.timestamps[parsedLog.timestamps.length - 1] -
      parsedLog.timestamps[0];
  }

  return {
    parsedLog,
    extracted: {
      boostValues,
      boostTargetValues,
      iatValues,
      afrValues,
      railPressureValues,
      lpfpValues,
      wgdcValues,
      ethanolValues,
      throttleValues,
      cyl1Vals,
      cyl2Vals,
      cyl3Vals,
      cyl4Vals,
      cyl5Vals,
      cyl6Vals,
    },
  };
}

function mapVehicleSetup(vehicleRow: Record<string, any> | null): VehicleSetup | null {
  if (!vehicleRow) return null;

  return {
    vehicleId: vehicleRow.id,

    make: vehicleRow.make ?? null,
    model: vehicleRow.model ?? null,
    year: vehicleRow.year ?? null,
    engineCode: vehicleRow.engine_code ?? null,

    fuelType: vehicleRow.fuel_type ?? null,

    turboSetup: vehicleRow.turbo_setup ?? vehicleRow.turbos ?? null,

    fuelingSetup: vehicleRow.fueling_setup ?? vehicleRow.fuel_system ?? null,

    intercooler: vehicleRow.intercooler ?? null,
    mapSensorBar: vehicleRow.map_sensor ?? null,
    transmissionTune: vehicleRow.transmission ?? null,
    horsepowerGoal: vehicleRow.horsepower_goal ?? null,
    portInjection: vehicleRow.port_injection ?? null,

    fuelBlend: null,
    hpfpSetup: null,
    lpfpSetup: null,
    injectorSizeCc: null,
    useCase: null,
  };
}

function mapTuneProfile(tuneProfileRow: Record<string, any> | null): TuneProfile | null {
  if (!tuneProfileRow) return null;

  return {
    tuneId: tuneProfileRow.tune_id,
    tuneName: tuneProfileRow.tune_name ?? null,
    fileName: tuneProfileRow.file_name ?? null,
    detectedPlatform: tuneProfileRow.detected_platform ?? "unknown",
    detectedStrategy: tuneProfileRow.detected_strategy ?? null,
    detectedRom: tuneProfileRow.detected_rom ?? null,
    parsingStatus: tuneProfileRow.parsing_status ?? "raw",
    confidence:
      typeof tuneProfileRow.confidence === "number" ? tuneProfileRow.confidence : 0,
    boostIntent: tuneProfileRow.boost_intent ?? null,
    ignitionIntent: tuneProfileRow.ignition_intent ?? null,
    fuelingIntent: tuneProfileRow.fueling_intent ?? null,
    categories: Array.isArray(tuneProfileRow.categories)
      ? tuneProfileRow.categories
      : [],
    notes: Array.isArray(tuneProfileRow.notes) ? tuneProfileRow.notes : [],
  };
}

function buildSummaryPayload(args: {
  headers: string[];
  rows: NumericRow[];
  extracted: ReturnType<typeof buildParsedLog>["extracted"];
  analysis: ReturnType<typeof buildAnalysisResult>;
}) {
  const {
    headers,
    rows,
    extracted: {
      boostValues,
      boostTargetValues,
      iatValues,
      afrValues,
      railPressureValues,
      lpfpValues,
      wgdcValues,
      ethanolValues,
      throttleValues,
      cyl1Vals,
      cyl2Vals,
      cyl3Vals,
      cyl4Vals,
      cyl5Vals,
      cyl6Vals,
    },
    analysis,
  } = args;

  const maxThrottle = maximum(throttleValues);
  const throttleClosureDetected =
    maxThrottle !== null ? maxThrottle < 95 : null;

  return {
    avg_boost: average(boostValues),
    max_boost: maximum(boostValues),

    avg_boost_target: average(boostTargetValues),
    max_boost_target: maximum(boostTargetValues),

    avg_timing: null,
    max_iat: maximum(iatValues),
    min_afr: minimum(afrValues),

    max_timing_correction: minimum([
      ...cyl1Vals,
      ...cyl2Vals,
      ...cyl3Vals,
      ...cyl4Vals,
      ...cyl5Vals,
      ...cyl6Vals,
    ]),

    cyl1_max_timing_correction: minimum(cyl1Vals),
    cyl2_max_timing_correction: minimum(cyl2Vals),
    cyl3_max_timing_correction: minimum(cyl3Vals),
    cyl4_max_timing_correction: minimum(cyl4Vals),
    cyl5_max_timing_correction: minimum(cyl5Vals),
    cyl6_max_timing_correction: minimum(cyl6Vals),

    min_rail_pressure: minimum(railPressureValues),
    min_lpfp: minimum(lpfpValues),
    max_wgdc: maximum(wgdcValues),
    ethanol_content: average(ethanolValues),

    max_throttle_closure: maxThrottle,
    throttle_closure_detected: throttleClosureDetected,

    summary: {
      rows_parsed: rows.length,
      headers_detected: headers,
      boost_samples: boostValues.length,
      boost_target_samples: boostTargetValues.length,
      iat_samples: iatValues.length,
      afr_samples: afrValues.length,
      rail_pressure_samples: railPressureValues.length,
      lpfp_samples: lpfpValues.length,
      wgdc_samples: wgdcValues.length,
      ethanol_samples: ethanolValues.length,
      throttle_samples: throttleValues.length,
      cyl1_samples: cyl1Vals.length,
      cyl2_samples: cyl2Vals.length,
      cyl3_samples: cyl3Vals.length,
      cyl4_samples: cyl4Vals.length,
      cyl5_samples: cyl5Vals.length,
      cyl6_samples: cyl6Vals.length,

      engine_v2: {
        quickVerdict: analysis.quickVerdict,
        pullWindows: analysis.pullWindows,
        events: analysis.events,
        warnings: analysis.warnings,
        suggestedFixes: analysis.suggestedFixes,
        crossReferences: analysis.crossReferences,

        telemetry: analysis.telemetry,
        worstCylinder: analysis.worstCylinder,
        diagnosticTimeline: analysis.diagnosticTimeline,
      },
    },
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const vehicleId = formData.get("vehicleId") as string;
  const file = formData.get("logFile") as File | null;
  const logName = (formData.get("log_name") as string) || "";

  if (!vehicleId) {
    return NextResponse.redirect(new URL("/garage", request.url), {
      status: 303,
    });
  }

  if (!file || file.size === 0) {
    return NextResponse.redirect(
      new URL(`/dashboard/vehicles/${vehicleId}/logs`, request.url),
      { status: 303 }
    );
  }

  const initialLogName = logName || file.name || "Unnamed Log";

  const { data: insertedLog, error: insertError } = await supabase
    .from("logs")
    .insert({
      vehicle_id: vehicleId,
      user_id: user.id,
      log_name: initialLogName,
      file_name: null,
      file_url: null,
    })
    .select()
    .single();

  if (insertError || !insertedLog) {
    console.error(
      "Initial log insert error:",
      insertError?.message || "No log inserted"
    );

    return NextResponse.redirect(
      new URL(`/dashboard/vehicles/${vehicleId}/logs`, request.url),
      { status: 303 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const uploadBlob = new Blob([arrayBuffer], {
      type: file.type || "text/csv",
    });

    const uploadedFileText = new TextDecoder().decode(arrayBuffer);

    const fileExt = file.name.split(".").pop() || "csv";
    const filePath = `${user.id}/${vehicleId}/${insertedLog.id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("logs")
      .upload(filePath, uploadBlob, {
        upsert: false,
      });

    if (uploadError) {
      console.error("Log upload error:", uploadError.message);

      return NextResponse.redirect(
        new URL(`/dashboard/vehicles/${vehicleId}/logs`, request.url),
        { status: 303 }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("logs")
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError.message);
    }

    const { error: updateError } = await supabase
      .from("logs")
      .update({
        file_name: file.name,
        file_url: signedUrlData?.signedUrl || null,
      })
      .eq("id", insertedLog.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Log row update error:", updateError.message);
    }

    const { headers, rows } = parseCSV(uploadedFileText);
    const translatedLog = translateLogRows(rows);

    const { parsedLog, extracted } =
      buildParsedLogFromTranslatedLog(translatedLog);

    const { data: vehicleRow } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .maybeSingle();

    const vehicle = mapVehicleSetup(vehicleRow as Record<string, any> | null);

    const { data: latestTune } = await supabase
      .from("tunes")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestTuneProfileRow } = latestTune
      ? await supabase
          .from("tune_profiles")
          .select("*")
          .eq("tune_id", latestTune.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const tuneProfile = mapTuneProfile(
      latestTuneProfileRow as Record<string, any> | null
    );

    const effectiveTuneProfile =
      tuneProfile &&
      Number(
        (extracted as any).ethanolContent ??
          (extracted as any).ethanol_content ??
          0
      ) >= 50 &&
      (
        (tuneProfile as any).fuelingIntent === "pump" ||
        (tuneProfile as any).fueling_intent === "pump"
      )
        ? {
            ...tuneProfile,
            fuelingIntent: "full_ethanol",
            fueling_intent: "full_ethanol",
          }
        : tuneProfile;

    const analysis = buildAnalysisResult({
      parsedLog,
      vehicle,
      tuneProfile: effectiveTuneProfile as any,
    });

    await supabase.from("log_summaries").delete().eq("log_id", insertedLog.id);

    const summaryPayload = buildSummaryPayload({
      headers,
      rows,
      extracted,
      analysis,
    });

    const { error: summaryError } = await supabase.from("log_summaries").insert({
      log_id: insertedLog.id,
      vehicle_id: vehicleId,
      user_id: user.id,
      ...summaryPayload,
    });

    if (summaryError) {
      console.error("Summary insert error:", summaryError.message);
    }
  } catch (error) {
    console.error("Log processing error:", error);
  }

  return NextResponse.redirect(
    new URL(`/dashboard/vehicles/${vehicleId}/logs`, request.url),
    { status: 303 }
  );
}
