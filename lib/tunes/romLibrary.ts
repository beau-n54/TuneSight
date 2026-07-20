export type RomLibraryEntry = {
  platform: string;
  ecu: string;
  romFamily: string;
  engineFamily: string;

  xdfSuggested: string | null;
  stockBinSuggested: string | null;
  mapSwitchBinSuggested: string | null;

  markers: string[];

  /**
   * Describes the supporting files available for this ROM entry.
   *
   * These fields strengthen ROM identification confidence, but they
   * do not prove that an uploaded binary is byte-for-byte identical
   * to a known reference.
   */
  hasXdf?: boolean;
  hasStockBin?: boolean;
  hasMapSwitchBin?: boolean;
  libraryEvidenceScore?: number;

  /**
   * Exact stock-reference metadata.
   *
   * These values are populated from the binary contents of a known
   * stock-library file and may be used for verified classification.
   */
  stockBinaryHash?: string | null;
  stockBinarySizeBytes?: number | null;

  /**
   * Exact map-switch-reference metadata.
   *
   * These values are populated from the binary contents of a known
   * map-switch-library file and may be used for verified classification.
   */
  mapSwitchBinaryHash?: string | null;
  mapSwitchBinarySizeBytes?: number | null;
};

export const ROM_LIBRARY: RomLibraryEntry[] = [
  {
    platform: "N54",
    ecu: "MSD80",
    romFamily: "I8A0S",
    engineFamily: "N54",
    xdfSuggested: "I8A0S.xdf",
    stockBinSuggested: null,
    mapSwitchBinSuggested: null,
    markers: ["I8A0S", "MSD80", "REGEMSD80"],
    hasXdf: true,
    hasStockBin: false,
    hasMapSwitchBin: false,
    libraryEvidenceScore: 3,
    stockBinaryHash: null,
    stockBinarySizeBytes: null,
    mapSwitchBinaryHash: null,
    mapSwitchBinarySizeBytes: null,
  },
  {
    platform: "N54",
    ecu: "MSD81",
    romFamily: "IJE0S",
    engineFamily: "N54",
    xdfSuggested: "IJE0S.xdf",
    stockBinSuggested: null,
    mapSwitchBinSuggested: null,
    markers: ["IJE0S", "MSD81", "REGEMSD81"],
    hasXdf: true,
    hasStockBin: false,
    hasMapSwitchBin: false,
    libraryEvidenceScore: 3,
    stockBinaryHash: null,
    stockBinarySizeBytes: null,
    mapSwitchBinaryHash: null,
    mapSwitchBinarySizeBytes: null,
  },
  {
    platform: "N54",
    ecu: "MSD81",
    romFamily: "IKM0S",
    engineFamily: "N54",
    xdfSuggested: "IKM0S.xdf",
    stockBinSuggested: null,
    mapSwitchBinSuggested: null,
    markers: ["IKM0S", "MSD81"],
    hasXdf: true,
    hasStockBin: false,
    hasMapSwitchBin: false,
    libraryEvidenceScore: 3,
    stockBinaryHash: null,
    stockBinarySizeBytes: null,
    mapSwitchBinaryHash: null,
    mapSwitchBinarySizeBytes: null,
  },
  {
    platform: "N54",
    ecu: "MSD81",
    romFamily: "INA0S",
    engineFamily: "N54",
    xdfSuggested: "INA0S.xdf",
    stockBinSuggested: null,
    mapSwitchBinSuggested: null,
    markers: ["INA0S", "MSD81"],
    hasXdf: true,
    hasStockBin: false,
    hasMapSwitchBin: false,
    libraryEvidenceScore: 3,
    stockBinaryHash: null,
    stockBinarySizeBytes: null,
    mapSwitchBinaryHash: null,
    mapSwitchBinarySizeBytes: null,
  },
];