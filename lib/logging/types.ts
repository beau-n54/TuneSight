export type LoggerPlatform =
  | "mhd"
  | "bm3"
  | "dimsport"
  | "protool"
  | "xhp"
  | "unknown";

export type InternalLogChannel = {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  aliases?: string[];
};

export type TranslatedLogRow = {
  time?: number | null;
  rpm?: number | null;
  throttle?: number | null;
  boostPsi?: number | null;
  boostTargetPsi?: number | null;
  boostErrorPsi?: number | null;
  wgdc?: number | null;
  railPressure?: number | null;
  lpfp?: number | null;
  afr?: number | null;
  lambda?: number | null;
  timingCyl1?: number | null;
  timingCyl2?: number | null;
  timingCyl3?: number | null;
  timingCyl4?: number | null;
  timingCyl5?: number | null;
  timingCyl6?: number | null;
  iat?: number | null;
};

export type TranslatedLog = {
  platform: LoggerPlatform;
  confidence: number;
  rowCount: number;
  rows: TranslatedLogRow[];
  detectedHeaders: string[];
  missingCoreChannels: string[];
};