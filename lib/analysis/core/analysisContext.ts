export type EnginePlatform =
  | "n54"
  | "n55"
  | "s55"
  | "b58"
  | "s58"
  | "unknown";

export type AnalysisContext = {
  platform: EnginePlatform;
  vehicleId?: string | null;
  tuneId?: string | null;
  logId?: string | null;

  fuelType?: string | null;
  ethanolContent?: number | null;

  maxBoost?: number | null;
  maxBoostTarget?: number | null;
  maxWgdc?: number | null;

  minRailPressure?: number | null;
  minLpfpPressure?: number | null;

  maxIat?: number | null;
  maxAfr?: number | null;

  notes?: string[];
};