import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCylinderIntelligencePresentation,
  humanizeCylinderChannel,
} from "./cylinderIntelligencePresentation.ts";

const authoritativeRootCause = {
  rank: "primary" as const,
  cause: "Insufficient Ignition Margin",
  confidence: 91,
  rejectedCauses: [
    {
      cause: "Single Cylinder Hardware Fault",
      reason: "Multiple cylinders contain aligned correction evidence.",
      confidence: 18,
    },
  ],
  suggestedDirection: "Inspect ignition timing and load demand.",
};

test("multi-cylinder event preserves its authoritative root cause and evidence", () => {
  const presentations = buildCylinderIntelligencePresentation(
    [
      {
        id: "timing-1",
        type: "multi_cyl_timing_correction",
        severity: "high",
        confidence: 0.84,
        rpmStart: 3200,
        rpmEnd: 4100,
        supportingChannels: [
          "timing_correction_cyl_1",
          "timing_correction_cyl_2",
          "timing_correction_cyl_3",
        ],
        metrics: {
          timing_correction_cyl_1: -6,
          timing_correction_cyl_2: -5.5,
          timing_correction_cyl_3: -5,
        },
      },
    ],
    [{ eventId: "timing-1", rootCauses: [authoritativeRootCause] }]
  );

  assert.equal(presentations.length, 1);
  assert.equal(presentations[0].state, "explained");
  assert.equal(
    presentations[0].primaryCause,
    "Insufficient Ignition Margin"
  );
  assert.equal(presentations[0].causeConfidence, 91);
  assert.deepEqual(
    presentations[0].affectedCylinders.map(({ label, value }) => ({
      label,
      value,
    })),
    [
      { label: "Cylinder 1", value: -6 },
      { label: "Cylinder 2", value: -5.5 },
      { label: "Cylinder 3", value: -5 },
    ]
  );
  assert.deepEqual(presentations[0].rpmRange, [3200, 4100]);
  assert.equal(presentations[0].rejectedAlternatives.length, 1);
});

test("single-cylinder event uses the same authoritative presentation contract", () => {
  const [presentation] = buildCylinderIntelligencePresentation(
    [
      {
        id: "single-1",
        type: "timing_correction",
        supportingChannels: ["timing_correction_cyl_4"],
        metrics: { timing_correction_cyl_4: -4.25 },
      },
    ],
    [{ eventId: "single-1", rootCauses: [authoritativeRootCause] }]
  );

  assert.equal(presentation.primaryCause, "Insufficient Ignition Margin");
  assert.deepEqual(presentation.affectedCylinders, [
    {
      channel: "timing_correction_cyl_4",
      label: "Cylinder 4",
      value: -4.25,
    },
  ]);
});

test("timing event without Explanation remains an explicit event-only state", () => {
  const [presentation] = buildCylinderIntelligencePresentation(
    [
      {
        id: "timing-unresolved",
        type: "multi_cyl_timing_correction",
        supportingChannels: ["timing_correction_cyl_1"],
      },
    ],
    []
  );

  assert.equal(presentation.state, "event_only");
  assert.equal(presentation.primaryCause, null);
  assert.equal(presentation.causeConfidence, null);
  assert.equal(presentation.inspectionDirection, null);
});

test("all supported cylinder channel identifiers are humanized", () => {
  for (let cylinder = 1; cylinder <= 12; cylinder += 1) {
    assert.equal(
      humanizeCylinderChannel(`timing_correction_cyl_${cylinder}`),
      `Cylinder ${cylinder}`
    );
  }
});

test("adapted display values contain no raw timing channel identifiers", () => {
  const [presentation] = buildCylinderIntelligencePresentation(
    [
      {
        id: "timing-1",
        type: "timing_correction",
        supportingChannels: ["timing_correction_cyl_1"],
        metrics: { timing_correction_cyl_1: -6 },
        evidence: [
          "timing_correction_cyl_1 showed timing correction of -6.0°",
        ],
      },
    ],
    []
  );

  const visibleValues = [
    presentation.title,
    presentation.primaryCause,
    ...presentation.affectedCylinders.map((cylinder) => cylinder.label),
    ...presentation.sourceEvidence,
  ]
    .filter(Boolean)
    .join(" ");

  assert.doesNotMatch(visibleValues, /timing_correction_cyl_/);
});

test("duplicate records for the same timing event create one warning", () => {
  const event = {
    id: "timing-1",
    type: "timing_correction",
    supportingChannels: ["timing_correction_cyl_1"],
  };

  const presentations = buildCylinderIntelligencePresentation(
    [event, structuredClone(event)],
    [{ eventId: "timing-1", rootCauses: [authoritativeRootCause] }]
  );

  assert.equal(presentations.length, 1);
});

test("persisted JSON event and Explanation retain the same result after refresh", () => {
  const events = JSON.parse(
    JSON.stringify([
      {
        id: "timing-1",
        type: "multi_cyl_timing_correction",
        supportingChannels: ["timing_correction_cyl_2"],
        metrics: { timing_correction_cyl_2: -5.5 },
      },
    ])
  );
  const crossReferences = JSON.parse(
    JSON.stringify([
      { eventId: "timing-1", rootCauses: [authoritativeRootCause] },
    ])
  );

  const [presentation] = buildCylinderIntelligencePresentation(
    events,
    crossReferences
  );

  assert.equal(presentation.primaryCause, "Insufficient Ignition Margin");
  assert.equal(presentation.affectedCylinders[0].label, "Cylinder 2");
});

test("historical summary-only data cannot create a cylinder warning", () => {
  assert.deepEqual(buildCylinderIntelligencePresentation([], []), []);
});

test("unsupported or malformed channel identifiers do not leak into display evidence", () => {
  const [presentation] = buildCylinderIntelligencePresentation(
    [
      {
        id: "timing-1",
        type: "timing_correction",
        supportingChannels: [
          "timing_correction_cyl_unknown",
          "ignition_internal_key",
        ],
        metrics: { timing_correction_cyl_unknown: -5 },
      },
    ],
    []
  );

  assert.equal(humanizeCylinderChannel("timing_correction_cyl_unknown"), null);
  assert.deepEqual(presentation.affectedCylinders, []);
});

test("presentation is platform-neutral and does not consume platform identity", () => {
  for (const platform of ["N54", "B58", "Supra"]) {
    const [presentation] = buildCylinderIntelligencePresentation(
      [
        {
          id: `${platform}-timing`,
          type: "timing_correction",
          supportingChannels: ["timing_correction_cyl_1"],
          metrics: { timing_correction_cyl_1: -3 },
        },
      ],
      [
        {
          eventId: `${platform}-timing`,
          rootCauses: [authoritativeRootCause],
        },
      ]
    );

    assert.equal(presentation.primaryCause, "Insufficient Ignition Margin");
    assert.equal(presentation.affectedCylinders[0].label, "Cylinder 1");
  }
});
