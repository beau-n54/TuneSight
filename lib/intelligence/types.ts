export type IntelligenceConfidence = {
  score: number;
  reasons: string[];
};

export type TuneSightLoggerIntelligence = {
  platform: string;
  confidence: number;
  rowCount: number;
  missingCoreChannels: string[];
};

export type TuneSightCalibrationIntelligence = {
  platform: string;
  engine: string;
  ecuFamily: string;
  romFamily: string;
  romFingerprint: string;
  suggestedXdf: string;
  xdfConfidence: number;
  tableCount: number;
  modifiedTableCount: number;
  capabilities: string[];
  knownStrategies: string[];
};

export type TuneSightIntelligence = {
  logger: TuneSightLoggerIntelligence;
  calibration: TuneSightCalibrationIntelligence;
  confidence: IntelligenceConfidence;
};

export type CalibrationIntelligence = TuneSightCalibrationIntelligence & {
  loggerPlatform: string;
  loggerConfidence: number;
  confidence: IntelligenceConfidence;
};