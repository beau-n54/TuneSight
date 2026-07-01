import { n54Thresholds } from "../config/thresholds";
import type { AnalysisContext } from "./core/analysisContext";

export type FuelValidationResult = {
  status: "pass" | "warning" | "fail";
  detectedFuel: "pump" | "ethanol_blend" | "full_ethanol";
  message: string;
};

export function validateFuelAgainstTune(
  context: AnalysisContext & {
    fuelingIntent?: string | null;
  }
)
: FuelValidationResult {
  const ethanolContent = Number(
  context.ethanolContent ?? 0
);

const fuelingIntent = context.fuelingIntent;

let detectedFuel: FuelValidationResult["detectedFuel"] = "pump";

if (
  ethanolContent >= n54Thresholds.ethanol.e85MinPercent
) {
  detectedFuel = "full_ethanol";
} else if (
  ethanolContent >= n54Thresholds.ethanol.pumpFuelMaxPercent
) {
  detectedFuel = "ethanol_blend";
}

  if (!fuelingIntent) {
    return {
      status: "warning",
      detectedFuel,
      message: "No fueling intent found in tune profile.",
    };
  }

  if (fuelingIntent === detectedFuel) {
    return {
      status: "pass",
      detectedFuel,
      message: "Fuel type matches tune intent.",
    };
  }

  if (
    fuelingIntent === "pump" &&
    detectedFuel !== "pump"
  ) {
    return {
      status: "fail",
      detectedFuel,
      message:
        "Tune appears pump-based but ethanol content indicates ethanol blend/use.",
    };
  }

  return {
    status: "warning",
    detectedFuel,
    message:
      "Fuel behavior partially differs from tune profile.",
  };
}

export type FuelPressureThresholds = {
  minRailPressure: number;
  minLpfpPressure: number;
  railWarningLabel: string;
  lpfpWarningLabel: string;
};

export function getFuelPressureThresholds(
  detectedFuel: FuelValidationResult["detectedFuel"]
): FuelPressureThresholds {
  if (detectedFuel === "full_ethanol") {
    return {
      minRailPressure:
        n54Thresholds.fuel.warningRailPressurePsi,
      minLpfpPressure:
        n54Thresholds.fuel.warningLpfpPsi,
      railWarningLabel:
        "Ethanol rail pressure demand check",
      lpfpWarningLabel:
        "Ethanol LPFP supply demand check",
    };
  }

  if (detectedFuel === "ethanol_blend") {
    return {
      minRailPressure: n54Thresholds.fuel.ethanolBlendMinRailPressurePsi,
      minLpfpPressure:
        n54Thresholds.fuel.minLpfpPsi,
      railWarningLabel:
        "Ethanol blend rail pressure check",
      lpfpWarningLabel:
        "Ethanol blend LPFP supply check",
    };
  }

  return {
    minRailPressure:
      n54Thresholds.fuel.minRailPressurePsi,
    minLpfpPressure: n54Thresholds.fuel.pumpFuelMinLpfpPsi,
    railWarningLabel:
      "Pump fuel rail pressure check",
    lpfpWarningLabel:
      "Pump fuel LPFP supply check",
  };
}