export const n54Thresholds = {
  boost: {
    maxSafePsi: 30,
    warningPsi: 27,
    overboostErrorPsi: 3,
    underboostErrorPsi: -3,
    highWgdcPercent: 85,
  },

  fuel: {
    minRailPressurePsi: 1500,
    warningRailPressurePsi: 1800,

    minLpfpPsi: 50,
    warningLpfpPsi: 60,

    ethanolBlendMinRailPressurePsi: 1650,
    pumpFuelMinLpfpPsi: 45,
  },

  ethanol: {
    pumpFuelMaxPercent: 15,
    e30MinPercent: 25,
    e30MaxPercent: 40,
    e50MinPercent: 43,
    e50MaxPercent: 58,
    e85MinPercent: 70,
  },

  ignition: {
    mildCorrectionDeg: -2.5,
    moderateCorrectionDeg: -4,
    severeCorrectionDeg: -6,
    maxSafeCylindersCorrecting: 2,
  },

  iat: {
    warningCelsius: 45,
    highCelsius: 55,
    criticalCelsius: 65,
  },

  afr: {
    leanWarning: 12.5,
    leanCritical: 13.0,
    richWarning: 10.5,
  },
} as const;

export type N54Thresholds = typeof n54Thresholds;