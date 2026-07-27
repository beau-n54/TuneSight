import assert from "node:assert/strict";
import test from "node:test";
import {
  correlateEngineeringObservations,
  type ConservativeCorrelationInput,
} from "./conservativeCorrelation.ts";

const wgdcInput: ConservativeCorrelationInput = {
  analysisId: "analysis-christos",
  pullWindows: [
    { id: "pull-1", startIndex: 0, endIndex: 100 },
    { id: "pull-2", startIndex: 101, endIndex: 200 },
    { id: "pull-3", startIndex: 201, endIndex: 300 },
  ],
  events: [0, 1, 2].map((index) => ({
    id: `wgdc_saturation_${index}`,
    type: "wgdc_saturation",
    startIndex: index * 101,
    endIndex: index * 101 + 100,
    confidence: 0.8,
    supportingChannels: ["wgdc", "boost", "boost_target"],
    evidence: [`WGDC evidence ${index}`],
  })),
};

test("repeated WGDC events form one non-causal repeated pattern", () => {
  const result = correlateEngineeringObservations(wgdcInput);
  const group = result.groups.find(
    (candidate) => candidate.relationshipType === "repeated_pattern"
  );

  assert.equal(group?.label, "WGDC Control Saturation Pattern");
  assert.deepEqual(group?.relatedEventIds, [
    "wgdc_saturation_0",
    "wgdc_saturation_1",
    "wgdc_saturation_2",
  ]);
  assert.deepEqual(group?.relatedPullIds, ["pull-1", "pull-2", "pull-3"]);
  assert.equal(group?.strength, "strong");
  assert.match(group?.unresolvedLimitations[0] ?? "", /does not establish/);
  assert.equal(
    result.groups.some((candidate) =>
      /turbo|leak|mechanical|calibration error/i.test(candidate.label)
    ),
    false
  );
});

test("same authoritative primary cause records a relationship, not a diagnosis", () => {
  const result = correlateEngineeringObservations({
    events: [
      { id: "event-a", type: "boost_undershoot" },
      { id: "event-b", type: "top_end_taper" },
    ],
    crossReferences: [
      {
        eventId: "event-a",
        rootCauses: [
          { rank: "primary", cause: "Turbo Flow Limit", confidence: 92 },
        ],
      },
      {
        eventId: "event-b",
        rootCauses: [
          { rank: "primary", cause: "Turbo Flow Limit", confidence: 83 },
        ],
      },
    ],
  });
  const group = result.groups.find(
    (candidate) =>
      candidate.relationshipType === "shared_cause_relationship"
  );

  assert.equal(group?.sharedFamily, "Turbo Flow Limit");
  assert.equal(group?.strength, "moderate");
  assert.match(group?.unresolvedLimitations[0] ?? "", /not a global diagnosis/);
});

test("same-log membership does not correlate unrelated observations", () => {
  const result = correlateEngineeringObservations({
    events: [
      {
        id: "heat",
        type: "heat_soak",
        startIndex: 0,
        endIndex: 20,
        supportingChannels: ["iat"],
      },
      {
        id: "fuel",
        type: "lpfp_drop",
        startIndex: 50,
        endIndex: 80,
        supportingChannels: ["lpfp"],
      },
    ],
  });

  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.uncorrelatedEventIds, ["heat", "fuel"]);
});

test("explicit rejected cause remains a contradictory relationship", () => {
  const result = correlateEngineeringObservations({
    events: [
      { id: "a", type: "boost_undershoot" },
      { id: "b", type: "top_end_taper" },
      { id: "c", type: "throttle_closure" },
    ],
    crossReferences: [
      {
        eventId: "a",
        rootCauses: [{ rank: "primary", cause: "Cause A" }],
      },
      {
        eventId: "b",
        rootCauses: [{ rank: "primary", cause: "Cause A" }],
      },
      {
        eventId: "c",
        rootCauses: [
          {
            rank: "primary",
            cause: "Cause C",
            rejectedCauses: [{ cause: "Cause A", reason: "Conflict" }],
          },
        ],
      },
    ],
  });
  const group = result.groups.find(
    (candidate) =>
      candidate.relationshipType === "contradictory_relationship"
  );

  assert.equal(group?.strength, "contradictory");
  assert.deepEqual(group?.contradictingEvidence, [
    "c explicitly rejects Cause A.",
  ]);
});

test("shared source channels are dependent rather than independent evidence", () => {
  const result = correlateEngineeringObservations({
    events: [
      {
        id: "undershoot",
        type: "boost_undershoot",
        startIndex: 0,
        endIndex: 100,
        supportingChannels: ["boost", "wgdc"],
        evidence: ["Boost below target"],
      },
      {
        id: "wgdc",
        type: "wgdc_saturation",
        startIndex: 0,
        endIndex: 100,
        supportingChannels: ["wgdc", "boost_target"],
        evidence: ["WGDC elevated"],
      },
    ],
  });
  const group = result.groups.find(
    (candidate) => candidate.relationshipType === "dependent_evidence"
  );

  assert.deepEqual(group?.sharedChannels, ["wgdc"]);
  assert.equal(group?.dependencyClassification, "shared_signal_dependency");
  assert.equal(group?.strength, "limited");
});

test("correlation does not mutate evidence, confidence, rank or boundaries", () => {
  const input = structuredClone(wgdcInput);
  const before = structuredClone(input);

  correlateEngineeringObservations(input);

  assert.deepEqual(input, before);
});

test("the same rules consume representative cross-platform contracts", () => {
  for (const analysisId of ["n54", "b58-gen1", "b58tu-supra"]) {
    const result = correlateEngineeringObservations({
      ...wgdcInput,
      analysisId,
    });

    assert.equal(result.groups[0]?.relationshipType, "repeated_pattern");
    assert.equal(result.groups[0]?.appliedRuleIds[0], "COR-V1-REPEATED-EVENT-TYPE");
  }
});
