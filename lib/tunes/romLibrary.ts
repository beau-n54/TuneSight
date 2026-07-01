export type RomLibraryEntry = {
  platform: string;
  ecu: string;
  romFamily: string;
  engineFamily: string;
  xdfSuggested: string | null;
  stockBinSuggested: string | null;
  mapSwitchBinSuggested: string | null;
  markers: string[];
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
  },
];