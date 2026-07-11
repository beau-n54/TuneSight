export type TunePlatform =
  | "MSD80"
  | "MSD81"
  | "MEVD17"
  | "MG1"
  | "MG1CS201"
  | "S58"
  | "UNKNOWN";

export type BinaryConfidence =
  | "low"
  | "medium"
  | "high";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "valid"
  | "invalid"
  | "matched"
  | "not_matched"
  | "not_available";

export interface ParsedTuneFile {
  detectedPlatform: TunePlatform;
  detectedRom: string | null;
  binarySignature: string | null;
  confidence: BinaryConfidence;

  fileSize: number;

  referenceTuneId?: string | null;
  isStockReference?: boolean;
  comparisonReady?: boolean;

  printableStrings: string[];

  parserNotes: string[];

  metadata: {
    softwareVersion?: string;
    calibrationId?: string;
    vin?: string;
    romId?: string;

    checksumFamily?: string;
    checksumVerificationStatus?: VerificationStatus;

    calibrationVerificationStatus?: VerificationStatus;

    exactBinaryMatchStatus?: VerificationStatus;
    binaryHash?: string;

    suspectedMapRegions?: {
      type: string;
      startOffset: number;
      endOffset: number;
    }[];

    entropyAnalysis?: {
      averageEntropy: number;
      lowestEntropyOffset: number | null;
      highestEntropyOffset: number | null;
      notes: string[];
    };

    binaryComparison?: {
      changedRegions: {
        startOffset: number;
        endOffset: number;
        changedBytes: number;
      }[];

      totalChangedBytes: number;

      comparisonNotes: string[];
    };
  };
}