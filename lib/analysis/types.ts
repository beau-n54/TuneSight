import type { AnalysisWarning } from "./core/analysisWarning";

export type PullQuality = "strong" | "usable" | "questionable";

export type Severity = "low" | "medium" | "high" | "critical";

export type QuickVerdictStatus = "healthy" | "caution" | "critical";

export type ParsedLog = {
  unavailableChannels?: string[];
  evidenceTelemetry?: Record<string, (number | null)[]>;
  sampleCount: number;
  durationSec: number;
  timestamps: number[];
  rpm: number[];
  channels: Record<string, number[]>;
};

export type PullWindow = {
  id: string;
  startIndex: number;
  endIndex: number;
  rpmStart: number;
  rpmEnd: number;
  durationSec: number;
  avgThrottle: number;
  isValidWot: boolean;
  quality: PullQuality;
  issues: string[];
};

export type LogSummary = {
  avgBoost: number | null;
  maxBoost: number | null;
  avgBoostTarget: number | null;
  maxBoostTarget: number | null;
  maxIat: number | null;
  minAfr: number | null;
  minRailPressure: number | null;
  minLpfp: number | null;
  maxWgdc: number | null;
  ethanolContent: number | null;
  throttleClosureDetected: boolean | null;
  telemetry?: {
  timestamps?: number[];
  rpm?: (number | null)[];
  boost: (number | null)[];
  boostTarget: (number | null)[];
  iat: (number | null)[];
  afr: (number | null)[];
  rail: (number | null)[];
  railPressure?: (number | null)[];
  rail_pressure?: (number | null)[];
  lpfp: (number | null)[];
  wgdc: (number | null)[];
  ethanol: (number | null)[];
  throttle: (number | null)[];
  timing_correction_cyl_1?: (number | null)[];
  timing_correction_cyl_2?: (number | null)[];
  timing_correction_cyl_3?: (number | null)[];
  timing_correction_cyl_4?: (number | null)[];
  timing_correction_cyl_5?: (number | null)[];
  timing_correction_cyl_6?: (number | null)[];
};
  cylTimingCorrections: Record<string, number | null>;
  worstCylinder: string | null;
  diagnosticTimeline: {
  timestamp: number;
  event: string;
  severity: "low" | "medium" | "high" | "critical";
}[];
  max_timing_correction: number | null;
cyl1_max_timing_correction: number | null;
cyl2_max_timing_correction: number | null;
cyl3_max_timing_correction: number | null;
cyl4_max_timing_correction: number | null;
cyl5_max_timing_correction: number | null;
cyl6_max_timing_correction: number | null;
};

export type DetectedEventType =
  | "boost_undershoot"
  | "boost_overshoot"
  | "wgdc_saturation"
  | "timing_correction"
  | "multi_cyl_timing_correction"
  | "rail_pressure_drop"
  | "hpfp_capacity_limit"
  | "lpfp_drop"
  | "lean_under_load"
  | "throttle_closure"
  | "heat_soak"
  | "spool_delay"
  | "top_end_taper"
  | "torque_intervention";

export type DetectedEvent = {
  id: string;
  type: DetectedEventType;
  severity: Severity;
  confidence: number;
  startIndex: number;
  endIndex: number;
  rpmStart: number;
  rpmEnd: number;
  supportingChannels: string[];
  evidence: string[];
  metrics: Record<string, number | string | boolean | null>;
};

export type RoutedEvent = {
  event: DetectedEvent;

  source:
    | "detector"
    | "pipeline"
    | "reasoning"
    | "cross_reference"
    | "analysis_warning";

  category:
    | "boost"
    | "fuel"
    | "ignition"
    | "torque"
    | "thermal"
    | "airflow"
    | "drivability"
    | "system";

  priority: number;

  surfaced: boolean;

  surfacedAs?:
    | "warning"
    | "info"
    | "critical"
    | "hidden";

  reasoning?: string[];

  suggestedActions?: string[];
};

export type RootCauseEvidence = {
  label: string;
  value?: string | number;
  score?: number;
  passed: boolean;

  metric?: string;
  contribution?: number;
  reason?: string;
};

export type RootCause = {
  rank: "primary" | "secondary" | "tertiary";
  cause: string;
  confidence: number;
  evidence: RootCauseEvidence[];

  candidateCauses?: import("./rootCauseEngine").CandidateCause[];
  confidenceBreakdown?: import("./rootCauseEngine").ConfidenceFactor[];
  reasoningNarrative?: string;

  relatedTables?: string[];

  rejectedCauses: {
    cause: string;
    confidence: number;
  }[];

  suggestedDirection: string;
};

export type VehicleSetup = {
  vehicleId: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engineCode?: string | null;
  fuelType?: string | null;
  fuelBlend?: string | null;
  turboSetup?: string | null;
  fuelingSetup?: string | null;
  hpfpSetup?: string | null;
  lpfpSetup?: string | null;
  portInjection?: boolean | null;
  injectorSizeCc?: number | null;
  intercooler?: string | null;
  mapSensorBar?: number | null;
  transmissionTune?: string | null;
  horsepowerGoal?: number | null;
  useCase?: "street" | "drag" | "roll_racing" | "circuit" | "mixed" | null;
};

export type TuneProfile = {
  tuneId: string;
  tuneName?: string | null;
  fileName?: string | null;
  detectedPlatform?: "mhd" | "bm3" | "custom" | "unknown";
  detectedStrategy?: string | null;
  detectedRom?: string | null;
  parsingStatus: "raw" | "profiled" | "partially_mapped" | "mapped";
  confidence: number;
  boostIntent?: "low" | "moderate" | "aggressive" | null;
  ignitionIntent?: "conservative" | "moderate" | "aggressive" | null;
  fuelingIntent?:
    | "pump"
    | "ethanol_blend"
    | "full_ethanol"
    | "race"
    | "unknown"
    | null;
  categories: string[];
  notes: string[];
};

export type LikelyCause = {
  label: string;
  score: number;
  reason: string;
};

export type CrossReference = {
  eventId: string;
  primaryTuneAreas: string[];
  secondaryTuneAreas: string[];
  protectionAreas: string[];
  hardwareFactors: string[];
  likelyCauses: LikelyCause[];
  rootCauses?: unknown[];
};

export type WarningCard = {
  id: string;
  title: string;
  severity: Severity;
  summary: string;
  rpmRange: [number, number];
  confidence: number;
  likelyCauses: LikelyCause[];
  rootCauses?: unknown[];
  linkedSystems: string[];
  supportingEvidence: string[];
};

export type SuggestedFix = {
  id: string;
  eventId?: string;
  title: string;
  recommendation: string;
  rationale: string;
  relatedTables: string[];
  affectedSystems: string[];
  risk: "low" | "medium" | "high";
};

export type QuickVerdict = {
  status: QuickVerdictStatus;
  summary: string;
  confidence: number;
  pullQuality: PullQuality;
};

export type AnalysisResult = {
  inputQualification?: { contract: "qualified-source-v1"; platform: "n54" | "unknown"; missingChannels: readonly string[] };
  quickVerdict: QuickVerdict;
  warnings: WarningCard[];
  pipelineWarnings: AnalysisWarning[];
  suggestedFixes: SuggestedFix[];
  crossReferences: CrossReference[];
  xdfCrossReferences?: {
  tableId: string;
  tableName: string;
  category: string;
  reason: string;
  confidence: number;
}[];
  summary: LogSummary;
  fuelValidation: {
  status: "pass" | "warning" | "fail" | "unavailable";
  detectedFuel: "pump" | "ethanol_blend" | "full_ethanol" | "unavailable";
  message: string;
};
fuelPressureThresholds: {
  minRailPressure: number;
  minLpfpPressure: number;
  railWarningLabel: string;
  lpfpWarningLabel: string;
} | null;
  events: DetectedEvent[];
routedEvents: RoutedEvent[];
pullWindows: PullWindow[];

telemetry?: unknown;
worstCylinder?: unknown;
diagnosticTimeline?: unknown[];
};
