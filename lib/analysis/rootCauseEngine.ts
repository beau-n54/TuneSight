export type RootCauseRank = "primary" | "secondary" | "tertiary";

export type RootCauseEvidence = {
  label: string;
  passed: boolean;
  value?: string | number;

  metric?: string;
  contribution?: number;
  reason?: string;
};

export type ConfidenceFactor = {
  factor: string;
  contribution: number;
};

export type RejectedCause = {
  cause: string;
  reason: string;
  confidence?: number;
};

export type RootCauseResult = {
  eventType: string;
  rank: RootCauseRank;
  cause: string;
  confidence: number;
  candidateCauses?: CandidateCause[];
  confidenceBreakdown?: ConfidenceFactor[];
  evidence: RootCauseEvidence[];
  rejectedCauses: RejectedCause[];
  reasoningNarrative?: string;
  suggestedDirection: string;
  relatedTables?: string[];
};

type RootCauseInput = {
  eventType?: string;
  title?: string;
  rpm?: number;
  boostError?: number;
  wgdc?: number;
  maxWgdc?: number;
  avgWgdc?: number;
  throttle?: number;
  iat?: number;
  railPressure?: number;
  lpfp?: number;
};

export type CandidateCause = {
  cause: string;
  score: number;
  evidence?: CandidateEvidence[];
  scoreGapToWinner?: number;
};

export type CandidateEvidence = {
  factor: string;
  contribution: number;
};

function clampContribution(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;

  const clamped = Math.max(0, Math.min(max, value));

  return Number(clamped.toFixed(2));
}

function calculateRailPressureContribution(actual: number, target: number): number {
  if (!actual || !target || target <= 0) return 0;

  const deficit = Math.max(0, target - actual);
  const percentDeficit = (deficit / target) * 100;

  return clampContribution(percentDeficit * 0.8, 35);
}

function calculateBoostErrorContribution(actualBoost: number, targetBoost?: number): number {
  if (!Number.isFinite(actualBoost)) return 0;

  const error = Number.isFinite(targetBoost)
    ? Math.abs((targetBoost as number) - actualBoost)
    : Math.abs(actualBoost);

  return clampContribution(error * 1.5, 30);
}

function calculateWgdcContribution(wgdc: number): number {
  if (!wgdc || wgdc < 70) return 0;

  return clampContribution((wgdc - 70) * 0.6, 25);
}

function calculateThrottleContribution(throttle: number): number {
  if (!throttle) return 0;

  const closure = Math.max(0, 100 - throttle);

  return clampContribution(closure * 0.4, 25);
}

function calculateIatContribution(iat: number): number {
  if (!iat || iat < 45) return 0;

  return clampContribution((iat - 45) * 0.6, 20);
}

function calculateFuelStabilityContribution(variance: number): number {
  if (!variance) return 0;

  return clampContribution(variance * 2, 20);
}

function clampConfidence(value: number): number {
  if (value < 0) return 0;
  if (value > 95) return 95;
  return Math.round(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildNarrative(
  cause: string,
  evidence: RootCauseEvidence[],
  rejectedCauses?: RejectedCause[]
): string {
  const supportingEvidence = evidence
    .filter((item) => item.passed && item.reason)
    .map((item) => item.reason as string);

  const rejected = (rejectedCauses ?? [])
    .filter((item) => item.cause && item.reason)
    .slice(0, 2);

  let narrative = `${cause} was selected because `;

  if (supportingEvidence.length > 0) {
    narrative += supportingEvidence.join(", ") + ".";
  } else {
    narrative +=
      "the available evidence supports this diagnosis.";
  }

  if (rejected.length > 0) {
    narrative += ` Alternative causes were considered but rejected. `;

    narrative += rejected
      .map(
        (item) =>
          `${item.cause} was rejected because ${item.reason.toLowerCase()}`
      )
      .join(". ");

    narrative += ".";
  }

  return narrative;
}

function rankCandidateCauses(
  candidates: CandidateCause[]
): CandidateCause[] {
  const ranked = [...candidates]
    .map((candidate) => ({
      ...candidate,
      score: clampConfidence(candidate.score),
    }))
    .sort((a, b) => b.score - a.score);

  const winnerScore = ranked[0]?.score ?? 0;

  return ranked.map((candidate) => ({
    ...candidate,
    scoreGapToWinner: Number((winnerScore - candidate.score).toFixed(2)),
  }));
}

function scoreCandidateFromEvidence(
  baseScore: number,
  evidence: CandidateEvidence[]
): number {
  const evidenceScore = evidence.reduce(
    (total, item) => total + item.contribution,
    0
  );

  return clampConfidence(baseScore + evidenceScore);
}

export function getRootCauseResults(event: RootCauseInput): RootCauseResult[] {
  const eventKey = `${event.eventType ?? ""} ${event.title ?? ""}`.toLowerCase();

  if (
  eventKey.includes("boost_undershoot") ||
  eventKey.includes("boost undershoot") ||
  eventKey.includes("underboost")
) {
  return getBoostUndershootRootCause(event);
}

if (
  eventKey.includes("top_end_taper") ||
  eventKey.includes("top end taper") ||
  eventKey.includes("boost_taper") ||
  eventKey.includes("boost taper") ||
  eventKey.includes("taper")
) {
  return getTopEndTaperRootCause(event);
}

  if (
    eventKey.includes("multi_cyl_timing_correction") ||
    eventKey.includes("timing correction") ||
    eventKey.includes("ignition")
  ) {
    return getTimingCorrectionRootCause(event);
  }

  if (
    eventKey.includes("overboost") ||
    eventKey.includes("boost_overshoot")
  ) {
    return getOverboostRootCause(event);
  }

  if (
    eventKey.includes("hpfp_capacity_limit") ||
    eventKey.includes("rail_pressure_drop") ||
    eventKey.includes("rail pressure") ||
    eventKey.includes("hpfp")
  ) {
    return getHpfpRootCause(event);
  }

  if (
    eventKey.includes("lpfp_drop") ||
    eventKey.includes("low pressure") ||
    eventKey.includes("lpfp")
  ) {
    return getLpfpRootCause(event);
  }

  if (
    eventKey.includes("throttle_closure") ||
    eventKey.includes("throttle closure") ||
    eventKey.includes("torque intervention") ||
    eventKey.includes("load intervention")
  ) {
    return getThrottleClosureRootCause(event);
  }

  return [];
}
function getBoostUndershootRootCause(
  event: RootCauseInput
): RootCauseResult[] {
  const effectiveWgdc =
    isNumber(event.wgdc) ? event.wgdc :
    isNumber(event.maxWgdc) ? event.maxWgdc :
    isNumber(event.avgWgdc) ? event.avgWgdc :
    undefined;

  const boostDeficit = isNumber(event.boostError)
    ? Math.abs(event.boostError)
    : 0;

  const wgdcHigh = isNumber(effectiveWgdc) && effectiveWgdc >= 90;
  const wgdcStrong = isNumber(effectiveWgdc) && effectiveWgdc >= 80;
  const throttleOpen = !isNumber(event.throttle) || event.throttle >= 80;
  const fuelStable =
    (!isNumber(event.railPressure) || event.railPressure >= 1800) &&
    (!isNumber(event.lpfp) || event.lpfp >= 50);
  const iatNormal = !isNumber(event.iat) || event.iat < 60;
  const boostErrorHigh = boostDeficit >= 3;

  const wgdcContribution = wgdcHigh ? 20 : wgdcStrong ? 12 : 0;
  const boostContribution = boostErrorHigh
    ? calculateBoostErrorContribution(boostDeficit, 0)
    : 0;
  const throttleContribution = throttleOpen ? 5 : 0;
  const fuelContribution = fuelStable ? 6 : 0;
  const iatContribution = iatNormal ? 3 : 0;

  const confidence = clampConfidence(
    45 +
      wgdcContribution +
      boostContribution +
      throttleContribution +
      fuelContribution +
      iatContribution
  );

  const confidenceBreakdown: ConfidenceFactor[] = [
    {
      factor: "Boost Below Target",
      contribution: boostContribution,
    },
    {
      factor: "WGDC High",
      contribution: wgdcContribution,
    },
    {
      factor: "Throttle Open",
      contribution: throttleContribution,
    },
    {
      factor: "Fuel System Stable",
      contribution: fuelContribution,
    },
    {
      factor: "IAT Normal",
      contribution: iatContribution,
    },
  ];

  const rejectedCauses: RejectedCause[] = [
    {
      cause: "Throttle Intervention",
      reason: "Throttle remained open, so torque closure is unlikely to explain the boost deficit.",
      confidence: 90,
    },
    {
      cause: "Fuel Pressure Limitation",
      reason: "Rail pressure and LPFP do not appear to be the primary cause of the boost deficit.",
      confidence: 82,
    },
    {
      cause: "Thermal Compensation",
      reason: "IAT does not appear high enough to explain the undershoot.",
      confidence: 78,
    },
  ];

  return [
    {
      eventType: "boost_undershoot",
      rank: "primary",
      cause: "Turbo Flow Limit",
      confidence,
      candidateCauses: rankCandidateCauses([
        {
          cause: "Turbo Flow Limit",
          score: scoreCandidateFromEvidence(35, [
            { factor: "Boost Below Target", contribution: boostContribution },
            { factor: "WGDC High", contribution: wgdcContribution },
            { factor: "Throttle Open", contribution: throttleContribution },
            { factor: "Fuel System Stable", contribution: fuelContribution },
            { factor: "IAT Normal", contribution: iatContribution },
          ]),
          evidence: [
            { factor: "Boost Below Target", contribution: boostContribution },
            { factor: "WGDC High", contribution: wgdcContribution },
            { factor: "Throttle Open", contribution: throttleContribution },
            { factor: "Fuel System Stable", contribution: fuelContribution },
            { factor: "IAT Normal", contribution: iatContribution },
          ],
        },
        {
          cause: "Boost Leak / Charge System Leak",
          score: scoreCandidateFromEvidence(30, [
            { factor: "Boost Below Target", contribution: boostContribution },
            { factor: "WGDC High", contribution: wgdcHigh ? 16 : 8 },
            { factor: "Throttle Open", contribution: throttleContribution },
          ]),
          evidence: [
            { factor: "Boost Below Target", contribution: boostContribution },
            { factor: "WGDC High", contribution: wgdcHigh ? 16 : 8 },
            { factor: "Throttle Open", contribution: throttleContribution },
          ],
        },
        {
          cause: "Wastegate Duty Cycle Base Table Under-Commanded",
          score: scoreCandidateFromEvidence(22, [
            { factor: "WGDC High", contribution: wgdcContribution },
            { factor: "Boost Below Target", contribution: boostErrorHigh ? 8 : 0 },
          ]),
          evidence: [
            { factor: "WGDC High", contribution: wgdcContribution },
            { factor: "Boost Below Target", contribution: boostErrorHigh ? 8 : 0 },
          ],
        },
        {
          cause: "Boost Target / Load Strategy Mismatch",
          score: scoreCandidateFromEvidence(24, [
            { factor: "Boost target may be unrealistic for the current setup", contribution: boostErrorHigh ? 12 : 0 },
          ]),
          evidence: [
            { factor: "Boost target may be unrealistic for the current setup", contribution: boostErrorHigh ? 12 : 0 },
          ],
        },
        {
          cause: "Throttle Intervention",
          score: scoreCandidateFromEvidence(5, [
            { factor: "Throttle Position", contribution: throttleOpen ? 4 : 18 },
          ]),
          evidence: [
            { factor: "Throttle Position", contribution: throttleOpen ? 4 : 18 },
          ],
        },
      ]),
      confidenceBreakdown,
      evidence: [
        {
          label: "Actual boost remained below requested target",
          passed: boostErrorHigh,
          value: event.boostError,
          metric: "Boost Error",
          contribution: boostContribution,
          reason: "actual boost stayed below the requested target",
        },
        {
          label: "WGDC was high while boost was below target",
          passed: wgdcStrong,
          value: effectiveWgdc,
          metric: "WGDC",
          contribution: wgdcContribution,
          reason: "the DME was already demanding more turbo output",
        },
        {
          label: "Throttle remained open during the event",
          passed: throttleOpen,
          value: event.throttle,
          metric: "Throttle",
          contribution: throttleContribution,
          reason: "throttle closure is unlikely to be the main driver",
        },
        {
          label: "Fuel pressure does not appear to be the primary driver",
          passed: fuelStable,
          metric: "Fuel System",
          contribution: fuelContribution,
          reason: "fuel pressure appears stable during the boost deficit",
        },
      ],
      rejectedCauses,
      reasoningNarrative: buildNarrative(
        "Turbo Flow Limit",
        [
          {
            label: "Boost remained below target",
            passed: boostErrorHigh,
            reason: "actual boost stayed below the requested target",
          },
          {
            label: "WGDC was elevated",
            passed: wgdcStrong,
            reason: "WGDC was elevated while boost remained low",
          },
          {
            label: "Throttle remained open",
            passed: throttleOpen,
            reason: "throttle remained open during the event",
          },
        ],
        rejectedCauses
      ),
      relatedTables: [
        "Wastegate Duty Cycle Base",
        "Boost Target Main",
        "Load Target",
        "Boost Ceiling / Limit",
      ],
      suggestedDirection:
        "Pressure test the charge system, inspect wastegate control, review WGDC base, and compare boost target against turbo flow capacity.",
    },
  ];
}
function getTopEndTaperRootCause(event: RootCauseInput): RootCauseResult[] {
  const effectiveWgdc =
  isNumber(event.wgdc) ? event.wgdc :
  isNumber(event.maxWgdc) ? event.maxWgdc :
  isNumber(event.avgWgdc) ? event.avgWgdc :
  undefined;

 
const wgdcHigh = isNumber(effectiveWgdc) && effectiveWgdc >= 90;

const wgdcStrongSupport =
  isNumber(effectiveWgdc) && effectiveWgdc >= 80;

const wgdcWeakSupport =
  isNumber(effectiveWgdc) &&
  effectiveWgdc >= 60 &&
  effectiveWgdc < 80;

const wgdcLowContradiction =
  isNumber(effectiveWgdc) &&
  effectiveWgdc < 60;

  const normalizedBoostError =
  isNumber(event.boostError)
    ? Math.abs(event.boostError)
    : 0;

  const boostErrorHigh = normalizedBoostError >= 2;
  const throttleOpen = !isNumber(event.throttle) || event.throttle >= 80;
  const iatNormal = !isNumber(event.iat) || event.iat < 60;
 
  const wgdcContribution = wgdcStrongSupport
  ? 20
  : wgdcWeakSupport
    ? 5
    : 0;

const boostContribution = boostErrorHigh
  ? calculateBoostErrorContribution(normalizedBoostError, 0)
  : 0;

const throttleContribution = throttleOpen
  ? 5
  : 0;

const iatContribution = iatNormal
  ? 3
  : 0;

  const confidence = clampConfidence(
  (wgdcHigh ? 55 : 25) +
    wgdcContribution +
    boostContribution +
    throttleContribution +
    iatContribution
);

  const confidenceBreakdown: ConfidenceFactor[] = [
  {
    factor: "WGDC Saturation",
    contribution: wgdcContribution,
  },
  {
    
    factor: "Boost Error High",
    contribution: boostContribution,
  },
  {
   factor: "Throttle Open",
   contribution: throttleContribution,
  },
  {
    factor: "IAT Normal",
    contribution: iatContribution,
  },
];

const wgdcContradiction =
  wgdcLowContradiction ? -15 : 0;
const turboFlowEvidence: RootCauseEvidence[] = [
  {
    label: "WGDC is high, suggesting the DME is already demanding more turbo output",
    passed: wgdcHigh,
    value: event.wgdc,
    metric: "WGDC",
    contribution: wgdcContribution,
    reason: "Turbo operating near control limit",
  },
  {
    label: "WGDC remains low despite boost deficit",
    passed: wgdcContradiction < 0,
    value: event.wgdc,
    metric: "WGDC",
    contribution: wgdcContradiction,
    reason: "Low WGDC contradicts turbo flow limitation",
  },
  {
    label: "Boost error increases under load or RPM",
    passed: boostErrorHigh,
    value: event.boostError,
    metric: "Boost Error",
    contribution: boostContribution,
    reason: "Boost target not achieved",
  },
  {
    label: "Throttle remains open, reducing likelihood of throttle intervention",
    passed: throttleOpen,
    value: event.throttle,
    metric: "Throttle",
    contribution: throttleContribution,
    reason: "No torque intervention detected",
  },
  {
    label: "IAT remains within normal operating range",
    passed: iatNormal,
    value: event.iat,
    metric: "IAT",
    contribution: iatContribution,
    reason: "Thermal compensation unlikely",
  },
];

const turboFlowRejected: RejectedCause[] = [
  {
    cause: "Throttle Intervention",
    reason: "Throttle angle does not show a major closure event.",
    confidence: 91,
  },
  {
    cause: "Thermal Compensation",
    reason: "IAT does not appear high enough to explain the boost taper.",
    confidence: 87,
  },
];

  return [
    {
      eventType: "top_end_taper",
      rank: "primary",
      cause: "Turbo Flow Limit",
      confidence,
      candidateCauses: rankCandidateCauses([
  {
    cause: "Turbo Flow Limit",
    score: scoreCandidateFromEvidence(wgdcHigh ? 40 : 12, [
      {
        factor: "WGDC Saturation",
        contribution: wgdcContribution,
      },
      {
        factor: "Low WGDC Contradiction",
        contribution: wgdcContradiction,
      },
      {
        factor: "Boost Error High",
        contribution: boostContribution,
      },
      {
        factor: "Throttle Open",
        contribution: throttleContribution,
      },
      {
        factor: "IAT Normal",
        contribution: iatContribution,
      },
    ]),
    evidence: [
      {
        factor: "WGDC Saturation",
        contribution: wgdcContribution,
      },
      {
        factor: "Boost Error High",
        contribution: boostContribution,
      },
      {
        factor: "Throttle Open",
        contribution: throttleContribution,
      },
      {
        factor: "IAT Normal",
        contribution: iatContribution,
      },
    ],
  },
  {
    cause: "Throttle Intervention",
    score: scoreCandidateFromEvidence(5, [
      {
        factor: "Throttle Position",
        contribution: throttleOpen ? 4 : 18,
      },
    ]),
    evidence: [
      {
        factor: "Throttle Position",
        contribution: throttleOpen ? 9 : 18,
      },
    ],
  },
  {
    cause: "Thermal Compensation",
    score: scoreCandidateFromEvidence(5, [
      {
        factor: "IAT",
        contribution: iatNormal ? 4 : 18,
      },
    ]),
    evidence: [
      {
        factor: "IAT",
        contribution: iatNormal ? 9 : 18,
      },
    ],
  },
  {
    cause: "Wastegate Duty Cycle Base Table Under-Commanded",
    score: wgdcHigh ? 62 : 48,
    evidence: [
      {
        factor: "WGDC demand elevated near affected RPM range",
        contribution: wgdcContribution,
      },
    ],
  },
  {
      cause: "Boost Target / Load Strategy Mismatch",
      score: 42,
      evidence: [
        {
          factor: "Boost taper may be related to target/load strategy",
          contribution: 42,
        },
      ],
    },
  ]),
      confidenceBreakdown,
      evidence: turboFlowEvidence,
      rejectedCauses: turboFlowRejected,
      reasoningNarrative: buildNarrative(
  "Turbo Flow Limit",
  [
    {
      label: "Boost error increased under load",
      passed: boostErrorHigh,
      reason: "boost error increased under load",
    },
    {
      label: "Throttle remained open",
      passed: throttleOpen,
      reason: "throttle remained open",
    },
    {
      label: "IAT remained normal",
      passed: iatNormal,
      reason: "intake temperatures remained within normal range",
    },
  ],
  [
   {
      cause: "Throttle Intervention",
      reason: "Throttle angle does not show a major closure event.",
    },
    {
      cause: "Thermal Compensation",
      reason: "IAT does not appear high enough to explain the boost taper.",
    },
  ]
),
      suggestedDirection:
        "Review turbo flow capacity, boost target, WGDC base, and load limits before increasing requested boost.",
    },
    {
      eventType: "top_end_taper",
      rank: "secondary",
      cause: "Wastegate Duty Cycle Base Table Under-Commanded",
      confidence: wgdcHigh ? 62 : 48,
      evidence: [
        {
          label: "WGDC demand is elevated near the affected RPM range",
          passed: wgdcHigh,
          value: event.wgdc,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Compare WGDC base against boost target in the affected RPM and load area.",
    },
    {
      eventType: "top_end_taper",
      rank: "tertiary",
      cause: "Boost Target / Load Strategy Mismatch",
      confidence: 42,
      evidence: [
        {
          label: "Boost taper may be related to target/load strategy rather than hardware limit",
          passed: true,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Cross-check boost target, load target, torque limits, and boost ceiling tables.",
    },
  ];
}

function getTimingCorrectionRootCause(event: RootCauseInput): RootCauseResult[] {
  const iatHigh = isNumber(event.iat) && event.iat >= 55;
  const railStable = !isNumber(event.railPressure) || event.railPressure >= 180;
  const lpfpStable = !isNumber(event.lpfp) || event.lpfp >= 55;
  const boostErrorLow = !isNumber(event.boostError) || Math.abs(event.boostError) < 2.5;

  const confidence = clampConfidence(
    60 +
      (iatHigh ? 8 : 0) +
      (railStable ? 6 : 0) +
      (lpfpStable ? 6 : 0) +
      (boostErrorLow ? 5 : 0)
  );

  const confidenceBreakdown: ConfidenceFactor[] = [
  {
    factor: "High IAT",
    contribution: iatHigh ? 8 : 0,
  },
  {
    factor: "Rail Pressure Stable",
    contribution: railStable ? 6 : 0,
  },
  {
    factor: "LPFP Stable",
    contribution: lpfpStable ? 6 : 0,
  },
  {
    factor: "Boost Error Low",
    contribution: boostErrorLow ? 5 : 0,
  },
];

const timingEvidence: RootCauseEvidence[] = [
  {
    label: "Timing correction event detected across multiple cylinders",
    passed: true,
    metric: "Timing Corrections",
    contribution: 12,
    reason: "timing corrections were detected across multiple cylinders",
  },
  {
    label: "Fuel pressure does not strongly explain the correction",
    passed: railStable && lpfpStable,
    metric: "Fuel System",
    contribution: 6,
    reason: "fuel pressure remained stable during the correction event",
    value:
      isNumber(event.railPressure) || isNumber(event.lpfp)
        ? `rail ${event.railPressure ?? "n/a"} / lpfp ${event.lpfp ?? "n/a"}`
        : undefined,
  },
  {
    label: "Boost error is not the primary driver",
    passed: boostErrorLow,
    value: event.boostError,
    metric: "Boost Error",
    contribution: 5,
    reason: "boost control remained stable during the correction event",
  },
  {
    label: "IAT may be contributing to reduced ignition tolerance",
    passed: iatHigh,
    value: event.iat,
    metric: "IAT",
    contribution: 8,
    reason: "high intake temperature may be reducing ignition margin",
  },
];

const timingRejected: RejectedCause[] = [
  {
    cause: "Fuel Pressure Failure",
    reason: "Rail pressure and LPFP do not clearly indicate a fuel supply collapse.",
    confidence: 86,
  },
  {
    cause: "Boost Control Error",
    reason: "Boost error is not large enough to explain the timing correction alone.",
    confidence: 81,
  },
];

  return [
    {
      eventType: "multi_cyl_timing_correction",
      rank: "primary",
      cause: "Insufficient Ignition Margin",
      confidence,
      candidateCauses: rankCandidateCauses([
    {
  cause: "Insufficient Ignition Margin",
  score: scoreCandidateFromEvidence(
    45,
    [
      {
        factor: "High IAT",
        contribution: iatHigh ? 8 : 0,
      },
      {
        factor: "Rail Pressure Stable",
        contribution: railStable ? 6 : 0,
      },
      {
        factor: "LPFP Stable",
        contribution: lpfpStable ? 6 : 0,
      },
      {
        factor: "Boost Error Low",
        contribution: boostErrorLow ? 5 : 0,
      },
    ]
  ),
  evidence: [
    {
      factor: "High IAT",
      contribution: iatHigh ? 8 : 0,
    },
    {
      factor: "Rail Pressure Stable",
      contribution: railStable ? 6 : 0,
    },
    {
      factor: "LPFP Stable",
      contribution: lpfpStable ? 6 : 0,
    },
    {
      factor: "Boost Error Low",
      contribution: boostErrorLow ? 5 : 0,
    },
  ],
},
    {
      cause: "Fuel Pressure Failure",
      score: railStable && lpfpStable ? 12 : 34,
    },
    {
      cause: "Boost Control Error",
      score: boostErrorLow ? 10 : 28,
    },
  ]),
      confidenceBreakdown,
      evidence: timingEvidence,
       
      rejectedCauses: timingRejected,
       reasoningNarrative: buildNarrative(
         "Insufficient Ignition Margin",
          timingEvidence,
          timingRejected
        ), 
      suggestedDirection:
        "Review ignition timing main, IAT timing compensation, knock control sensitivity, and load/boost level in the affected RPM range.",
    },
    {
      eventType: "multi_cyl_timing_correction",
      rank: "secondary",
      cause: "IAT Timing Compensation or Heat Sensitivity",
      confidence: iatHigh ? 72 : 45,
      evidence: [
        {
          label: "IAT is high enough to reduce knock margin",
          passed: iatHigh,
          value: event.iat,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Check IAT compensation tables and compare correction severity against charge-air temperature.",
    },
    {
      eventType: "multi_cyl_timing_correction",
      rank: "tertiary",
      cause: "Load / Boost Demand Too Aggressive For Conditions",
      confidence: 50,
      evidence: [
        {
          label: "Timing correction may be caused by load demand exceeding available knock margin",
          passed: true,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Cross-check load target, boost target, ignition timing, and fuel quality assumptions together.",
    },
  ];
}

function getHpfpRootCause(event: RootCauseInput): RootCauseResult[] {
  const railLow = isNumber(event.railPressure) && event.railPressure < 180;
  const lpfpStable = !isNumber(event.lpfp) || event.lpfp >= 55;
  const boostDemandHigh = isNumber(event.boostError) ? Math.abs(event.boostError) >= 1.5 : true;
  const iatNotPrimary = !isNumber(event.iat) || event.iat < 65;
  const railContribution = railLow
  ? calculateRailPressureContribution(event.railPressure ?? 0, 200)
  : 0;

const boostContribution = boostDemandHigh
  ? calculateBoostErrorContribution(
      event.boostError ?? 0,
      0
    )
  : 0;

  const confidence = clampConfidence(
  58 +
  railContribution +
  (lpfpStable ? 8 : 0) +
  boostContribution +
  (iatNotPrimary ? 4 : 0)
);

  const confidenceBreakdown: ConfidenceFactor[] = [
  {
    factor: "Rail Pressure Low",
   contribution: railContribution,
  },
  {
    factor: "LPFP Stable",
    contribution: lpfpStable ? 8 : 0,
  },
  {
    factor: "Boost Demand High",
    contribution: boostContribution,
  },
  {
    factor: "IAT Not Primary Cause",
    contribution: iatNotPrimary ? 4 : 0,
  },
];

const hpfpEvidence: RootCauseEvidence[] = [
  {
    label: "Rail pressure is below expected support level",
    passed: railLow,
    value: event.railPressure,
    metric: "Rail Pressure",
    contribution: 18,
    reason: "rail pressure dropped below the expected support level",
  },
  {
    label: "LPFP does not appear to be the first failure point",
    passed: lpfpStable,
    value: event.lpfp,
    metric: "LPFP",
    contribution: 8,
    reason: "low-pressure fuel supply remained stable",
  },
  {
    label: "Load or boost demand is high enough to increase fuel volume requirements",
    passed: boostDemandHigh,
    value: event.boostError,
    metric: "Boost Demand",
    contribution: 5,
    reason: "fuel demand increased with airflow demand",
  },
];

const hpfpRejected: RejectedCause[] = [
  {
    cause: "LPFP Capacity Limit",
    reason: "Low-side pressure does not clearly indicate the LPFP is the primary limiter.",
    confidence: 89,
  },
  {
    cause: "Thermal Compensation",
    reason: "IAT does not strongly explain the rail pressure drop.",
    confidence: 84,
  },
];

  return [
    {
      eventType: "hpfp_capacity_limit",
      rank: "primary",
      cause: "High Fuel Demand Exceeding HPFP / DI Capacity",
      confidence,
      candidateCauses: rankCandidateCauses([
  {
    cause: "High Fuel Demand Exceeding HPFP / DI Capacity",
    score: scoreCandidateFromEvidence(
      45,
      [
        {
          factor: "Rail Pressure Low",
          contribution: railLow ? 18 : 0,
        },
        {
          factor: "LPFP Stable",
          contribution: lpfpStable ? 8 : 0,
        },
        {
          factor: "Boost Demand High",
          contribution: boostDemandHigh ? 5 : 0,
        },
        {
          factor: "IAT Not Primary",
          contribution: iatNotPrimary ? 4 : 0,
        },
      ]
    ),
    evidence: [
      {
        factor: "Rail Pressure Low",
        contribution: railLow ? 18 : 0,
      },
      {
        factor: "LPFP Stable",
        contribution: lpfpStable ? 8 : 0,
      },
      {
        factor: "Boost Demand High",
        contribution: boostDemandHigh ? 5 : 0,
      },
      {
        factor: "IAT Not Primary",
        contribution: iatNotPrimary ? 4 : 0,
      },
    ],
  },
    {
      cause: "LPFP Capacity Limit",
      score: lpfpStable ? 12 : 34,
    },
    {
      cause: "Thermal Compensation",
      score: iatNotPrimary ? 8 : 22,
    },
  ]),
      confidenceBreakdown,
      evidence: hpfpEvidence,
       
      rejectedCauses: hpfpRejected,
      reasoningNarrative: buildNarrative(
        "High Fuel Demand Exceeding HPFP / DI Capacity",
        hpfpEvidence,
        hpfpRejected
      ),
     suggestedDirection:
      "Review fuel pressure target, HPFP control, fuel scalar, lambda target, and PI contribution before increasing load or boost.",
    },
    {
      eventType: "hpfp_capacity_limit",
      rank: "secondary",
      cause: "Fuel Pressure Target / Control Mismatch",
      confidence: railLow ? 66 : 48,
      evidence: [
        {
          label: "Rail pressure behaviour should be compared against commanded target",
          passed: true,
          value: event.railPressure,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Cross-check rail target, HPFP control, and affected RPM/load cells.",
    },
    {
      eventType: "hpfp_capacity_limit",
      rank: "tertiary",
      cause: "Ethanol / Lambda Demand Increasing Fuel Volume",
      confidence: 52,
      evidence: [
        {
          label: "High ethanol or rich lambda targets can increase pump demand",
          passed: true,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Review ethanol content assumptions, fuel scalar, lambda target, and PI split strategy together.",
    },
  ];
}

function getLpfpRootCause(event: RootCauseInput): RootCauseResult[] {
  const lpfpLow = isNumber(event.lpfp) && event.lpfp < 55;
  const railAffected = isNumber(event.railPressure) && event.railPressure < 180;
  const boostDemandPresent = isNumber(event.boostError) ? Math.abs(event.boostError) >= 1.5 : true;

  const confidence = clampConfidence(
    60 +
      (lpfpLow ? 18 : 0) +
      (railAffected ? 6 : 0) +
      (boostDemandPresent ? 4 : 0)
  );

  const confidenceBreakdown: ConfidenceFactor[] = [
  {
    factor: "LPFP Pressure Low",
    contribution: lpfpLow ? 18 : 0,
  },
  {
    factor: "Rail Pressure Affected",
    contribution: railAffected ? 6 : 0,
  },
  {
    factor: "Boost Demand Present",
    contribution: boostDemandPresent ? 4 : 0,
  },
];

const lpfpEvidence: RootCauseEvidence[] = [
  {
    label: "LPFP pressure is below expected support level",
    passed: lpfpLow,
    value: event.lpfp,
    metric: "LPFP",
    contribution: 18,
    reason: "low-pressure fuel supply dropped below the expected support level",
  },
  {
    label: "Rail pressure is beginning to show impact",
    passed: railAffected,
    value: event.railPressure,
    metric: "Rail Pressure",
    contribution: 6,
    reason: "rail pressure is being affected by low-side supply weakness",
  },
  {
    label: "Boost demand is present",
    passed: boostDemandPresent,
    value: event.boostError,
    metric: "Boost Demand",
    contribution: 4,
    reason: "fuel demand increased under load",
  },
];

const lpfpRejected: RejectedCause[] = [
  {
    cause: "Ignition Timing Issue",
    reason: "Fuel supply evidence is stronger than ignition-only explanation.",
    confidence: 88,
  },
  {
    cause: "Throttle Intervention",
    reason: "Fuel pressure drop is not explained by throttle closure alone.",
    confidence: 82,
  },
];

  return [
    {
      eventType: "lpfp_drop",
      rank: "primary",
      cause: "Low-Pressure Fuel Supply Weakness",
      confidence,
      candidateCauses: rankCandidateCauses([
    {
  cause: "Low-Pressure Fuel Supply Weakness",
  score: scoreCandidateFromEvidence(
    45,
    [
      {
        factor: "LPFP Pressure Low",
        contribution: lpfpLow ? 18 : 0,
      },
      {
        factor: "Rail Pressure Affected",
        contribution: railAffected ? 6 : 0,
      },
      {
        factor: "Boost Demand Present",
        contribution: boostDemandPresent ? 4 : 0,
      },
    ]
  ),
  evidence: [
    {
      factor: "LPFP Pressure Low",
      contribution: lpfpLow ? 18 : 0,
    },
    {
      factor: "Rail Pressure Affected",
      contribution: railAffected ? 6 : 0,
    },
    {
      factor: "Boost Demand Present",
      contribution: boostDemandPresent ? 4 : 0,
    },
  ],
},
    {
      cause: "Ignition Timing Issue",
      score: lpfpLow ? 10 : 24,
    },
    {
      cause: "Throttle Intervention",
      score: boostDemandPresent ? 12 : 22,
    },
  ]),
      confidenceBreakdown,
      evidence: lpfpEvidence,
        
      rejectedCauses: lpfpRejected,
      reasoningNarrative: buildNarrative(
        "Low-Pressure Fuel Supply Weakness",
        lpfpEvidence,
        lpfpRejected
      ), 
      suggestedDirection:
        "Review low pressure fuel pump control, EKP strategy, PI demand, ethanol content, and fuel delivery hardware before raising boost/load.",
    },
    {
      eventType: "lpfp_drop",
      rank: "secondary",
      cause: "Port Injection / Ethanol Demand Overloading Low Side",
      confidence: lpfpLow ? 64 : 45,
      evidence: [
        {
          label: "High ethanol and PI can pull heavily from the low-pressure side",
          passed: true,
          value: event.lpfp,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Check PI onset, PI split, ethanol content, and low-side pressure response in the affected RPM range.",
    },
    {
      eventType: "lpfp_drop",
      rank: "tertiary",
      cause: "Fuel Pump Control Strategy Needs Review",
      confidence: 48,
      evidence: [
        {
          label: "Low-side pressure behaviour may be control strategy related",
          passed: true,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Review LPFP control tables and pressure targets before assuming hardware failure.",
    },
  ];
}

function getThrottleClosureRootCause(event: RootCauseInput): RootCauseResult[] {
  const throttleClosed = isNumber(event.throttle) && event.throttle < 80;
  const boostErrorHigh = isNumber(event.boostError) && Math.abs(event.boostError) >= 2;
  const wgdcNotMaxed = !isNumber(event.wgdc) || event.wgdc < 90;
  const fuelStable =
    (!isNumber(event.railPressure) || event.railPressure >= 180) &&
    (!isNumber(event.lpfp) || event.lpfp >= 55);

    const throttleContribution = throttleClosed
  ? calculateThrottleContribution(event.throttle ?? 100)
  : 0;

const boostContribution = boostErrorHigh
  ? calculateBoostErrorContribution(event.boostError ?? 0, 0)
  : 0;

  const confidence = clampConfidence(
    58 +
       throttleContribution +
       boostContribution +
      (wgdcNotMaxed ? 5 : 0) +
      (fuelStable ? 4 : 0)
  );

  const confidenceBreakdown: ConfidenceFactor[] = [
  {
    factor: "Throttle Closure",
    contribution: throttleContribution,
  },
  {
    factor: "Boost Error High",
    contribution: boostContribution,
  },
  {
    factor: "WGDC Not Maxed",
    contribution: wgdcNotMaxed ? 5 : 0,
  },
  {
    factor: "Fuel System Stable",
    contribution: fuelStable ? 4 : 0,
  },
];

const throttleEvidence: RootCauseEvidence[] = [
  {
    label: "Throttle angle indicates closure or intervention",
    passed: throttleClosed,
    value: event.throttle,
    metric: "Throttle",
    contribution: throttleContribution,
    reason: "throttle closure is the strongest evidence of torque intervention",
  },
  {
    label: "Boost/load error suggests request and delivered torque may be mismatched",
    passed: boostErrorHigh,
    value: event.boostError,
    metric: "Boost Error",
    contribution: boostContribution,
    reason: "requested and delivered load are diverging",
  },
  {
    label: "WGDC is not the strongest evidence for a turbo flow limit",
    passed: wgdcNotMaxed,
    value: event.wgdc,
    metric: "WGDC",
    contribution: 5,
    reason: "turbo system is not operating at maximum control effort",
  },
  {
    label: "Fuel pressure does not strongly explain the event",
    passed: fuelStable,
    metric: "Fuel System",
    contribution: 4,
    reason: "fuel pressure remains stable during throttle closure event",
  },
];

const throttleRejected: RejectedCause[] = [
  {
    cause: "Turbo Flow Limit",
    reason: "Throttle closure points to intervention rather than turbo capacity as the primary cause.",
    confidence: 88,
  },
  {
    cause: "Fuel Pressure Failure",
    reason: "Rail and low-side pressure do not clearly show a fuel supply collapse.",
    confidence: 84,
  },
];

  return [
    {
      eventType: "throttle_closure",
      rank: "primary",
      cause: "Torque / Load Intervention",
      confidence,
      candidateCauses: rankCandidateCauses([
    {
  cause: "Torque / Load Intervention",
  score: scoreCandidateFromEvidence(
    45,
    [
      {
        factor: "Throttle Closure",
        contribution: throttleClosed ? 18 : 0,
      },
      {
        factor: "Boost Error High",
        contribution: boostErrorHigh ? 6 : 0,
      },
      {
        factor: "WGDC Not Maxed",
        contribution: wgdcNotMaxed ? 5 : 0,
      },
      {
        factor: "Fuel System Stable",
        contribution: fuelStable ? 4 : 0,
      },
    ]
  ),
  evidence: [
    {
      factor: "Throttle Closure",
      contribution: throttleClosed ? 18 : 0,
    },
    {
      factor: "Boost Error High",
      contribution: boostErrorHigh ? 6 : 0,
    },
    {
      factor: "WGDC Not Maxed",
      contribution: wgdcNotMaxed ? 5 : 0,
    },
    {
      factor: "Fuel System Stable",
      contribution: fuelStable ? 4 : 0,
    },
  ],
},
    {
      cause: "Turbo Flow Limit",
      score: wgdcNotMaxed ? 12 : 32,
    },
    {
      cause: "Fuel Pressure Failure",
      score: fuelStable ? 10 : 30,
    },
  ]),
      confidenceBreakdown,
      evidence: throttleEvidence,
      
      rejectedCauses: throttleRejected,
      reasoningNarrative: buildNarrative(
        "Torque / Load Intervention",
        throttleEvidence,
        throttleRejected
      ), 
      suggestedDirection:
        "Review torque limiters, load target, requested torque, throttle intervention logic, and boost/load request alignment.",
    },
    {
      eventType: "throttle_closure",
      rank: "secondary",
      cause: "Boost / Load Request Mismatch",
      confidence: boostErrorHigh ? 65 : 46,
      evidence: [
        {
          label: "Boost error may indicate load request and boost control are not aligned",
          passed: boostErrorHigh,
          value: event.boostError,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Compare boost target, load target, torque request, and throttle position across the closure window.",
    },
    {
      eventType: "throttle_closure",
      rank: "tertiary",
      cause: "Protection Strategy Intervention",
      confidence: 44,
      evidence: [
        {
          label: "Throttle closure may be a protective response to torque/load safety logic",
          passed: true,
        },
      ],
      rejectedCauses: [],
      suggestedDirection:
        "Review load protection, torque monitoring, and boost ceiling tables before changing throttle-related tables directly.",
    },
  ];
}

function getOverboostRootCause(event: RootCauseInput): RootCauseResult[] {
  const boostErrorHigh = isNumber(event.boostError)
  ? Math.abs(event.boostError) >= 0.3
  : true;

  const wgdcNotHigh = !isNumber(event.wgdc) || event.wgdc < 85;
  const throttleClosed = isNumber(event.throttle) && event.throttle < 85;

  const fuelStable =
    (!isNumber(event.railPressure) || event.railPressure >= 180) &&
    (!isNumber(event.lpfp) || event.lpfp >= 55);

  const boostContribution = boostErrorHigh
  ? 8
  : 0;

  const throttleContribution = throttleClosed
    ? calculateThrottleContribution(event.throttle ?? 100)
    : 0;

  const confidence = clampConfidence(
    56 +
    boostContribution +
    (wgdcNotHigh ? 8 : 0) +
    throttleContribution +
    (fuelStable ? 4 : 0)
  );

  const confidenceBreakdown: ConfidenceFactor[] = [
    {
      factor: "Boost Above Target",
      contribution: boostContribution,
    },
    {
      factor: "WGDC Not Maxed",
      contribution: wgdcNotHigh ? 8 : 0,
    },
    {
      factor: "Throttle Closure Present",
      contribution: throttleContribution,
    },
    {
      factor: "Fuel System Stable",
      contribution: fuelStable ? 4 : 0,
    },
  ];

  const overboostEvidence: RootCauseEvidence[] = [
    {
      label: "Boost pressure exceeded requested target",
      passed: boostErrorHigh,
      value: event.boostError,
      metric: "Boost Error",
      contribution: boostContribution,
      reason: "Actual boost exceeded the target/requested boost level",
    },
    {
      label: "WGDC was not fully saturated during the event",
      passed: wgdcNotHigh,
      value: event.wgdc,
      metric: "WGDC",
      contribution: wgdcNotHigh ? 8 : 0,
      reason: "Wastegate duty was not maxed, making turbo flow limit less likely",
    },
    {
      label: "Throttle closure may indicate torque intervention",
      passed: throttleClosed,
      value: event.throttle,
      metric: "Throttle",
      contribution: throttleContribution,
      reason: "Throttle closure can occur when the DME intervenes to control excess boost or torque",
    },
    {
      label: "Fuel pressure does not appear to be the primary driver",
      passed: fuelStable,
      value: `rail ${event.railPressure ?? "n/a"} / lpfp ${event.lpfp ?? "n/a"}`,
      metric: "Fuel System",
      contribution: fuelStable ? 4 : 0,
      reason: "Fuel pressure remained stable enough that the event is more likely boost-control related",
    },
  ];

  const overboostRejected: RejectedCause[] = [
    {
      cause: "Turbo Flow Limit",
      reason: "The issue is excess boost rather than failing to achieve boost target.",
      confidence: 86,
    },
    {
      cause: "HPFP Capacity Limit",
      reason: "Rail pressure does not clearly indicate HPFP collapse as the primary fault.",
      confidence: 82,
    },
    {
      cause: "LPFP Capacity Limit",
      reason: "Low-pressure fuel supply does not clearly explain an overboost condition.",
      confidence: 80,
    },
  ];

  return [
    {
      eventType: "overboost",
      rank: "primary",
      cause: "Boost Control Overshoot",
      confidence,
      candidateCauses: rankCandidateCauses([
        {
          cause: "Boost Control Overshoot",
          score: scoreCandidateFromEvidence(56, confidenceBreakdown),
          evidence: confidenceBreakdown,
        },
        {
          cause: "Throttle Intervention",
          score: scoreCandidateFromEvidence(5, [
            {
              factor: "Throttle Closure",
              contribution: throttleContribution,
            },
          ]),
          evidence: [
            {
              factor: "Throttle Closure",
              contribution: throttleContribution,
            },
          ],
        },
        {
          cause: "Turbo Flow Limit",
          score: scoreCandidateFromEvidence(5, [
            {
              factor: "WGDC Saturation",
              contribution: wgdcNotHigh ? 0 : 15,
            },
          ]),
          evidence: [
            {
              factor: "WGDC Saturation",
              contribution: wgdcNotHigh ? 0 : 15,
            },
          ],
        },
      ]),
      confidenceBreakdown,
      evidence: overboostEvidence,
      rejectedCauses: overboostRejected,
      reasoningNarrative:
        "Boost Control Overshoot was selected because actual boost exceeded the requested target. TuneSight also checked whether the event looked like turbo flow limitation, throttle intervention, or fuel pressure collapse before selecting overboost control as the primary explanation.",
      suggestedDirection:
        "Review boost control behaviour, wastegate duty, boost target, load request, and throttle closure around the overboost window before increasing boost or torque tables.",
    },
  ];
}

