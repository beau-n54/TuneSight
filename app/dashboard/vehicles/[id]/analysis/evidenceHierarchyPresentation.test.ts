import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCauseHierarchy,
  dedupeCrossReferencesByEventId,
  groupRepeatedEventObservations,
  observationCountLabel,
  orderRootCauses,
} from "./evidenceHierarchyPresentation.ts";

test("repeated event observations group without losing unique evidence", () => {
  const events = [
    {
      id: "wgdc_saturation_1",
      type: "wgdc_saturation",
      evidence: ["Average WGDC was 98.5%"],
    },
    {
      id: "wgdc_saturation_2",
      type: "wgdc_saturation",
      evidence: ["Average WGDC was 91.3%"],
    },
    {
      id: "boost_undershoot_1",
      type: "boost_undershoot",
      evidence: ["Boost error was 3.2 psi"],
    },
  ];
  const references = events.map((event) => ({
    eventId: event.id,
  }));

  const groups = groupRepeatedEventObservations(events, references);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].eventType, "wgdc_saturation");
  assert.deepEqual(
    groups[0].observations.map(
      ({ event }) => event.evidence?.[0]
    ),
    ["Average WGDC was 98.5%", "Average WGDC was 91.3%"]
  );
});

test("identical event references do not render twice", () => {
  const references = dedupeCrossReferencesByEventId([
    { eventId: "wgdc_saturation_1" },
    { eventId: "wgdc_saturation_1" },
  ]);
  const groups = groupRepeatedEventObservations(
    [{ id: "wgdc_saturation_1", type: "wgdc_saturation" }],
    references
  );

  assert.equal(references.length, 1);
  assert.deepEqual(groups, []);
});

test("distinct causes remain distinct and ordered by runtime rank", () => {
  const causes = [
    { cause: "Secondary", rank: "secondary" as const, confidence: 80 },
    { cause: "Primary", rank: "primary" as const, confidence: 91 },
    { cause: "Tertiary", rank: "tertiary" as const, confidence: 60 },
  ];

  const ordered = orderRootCauses(causes);

  assert.deepEqual(
    ordered.map((cause) => cause.cause),
    ["Primary", "Secondary", "Tertiary"]
  );
  assert.deepEqual(
    ordered.map((cause) => cause.confidence),
    [91, 80, 60]
  );
});

test("stable ordering preserves multiple causes at the same rank", () => {
  const ordered = orderRootCauses([
    { cause: "First", rank: "secondary" },
    { cause: "Second", rank: "secondary" },
  ]);

  assert.deepEqual(
    ordered.map((cause) => cause.cause),
    ["First", "Second"]
  );
});

test("explicit runtime rank defines primary and alternative results", () => {
  const hierarchy = buildCauseHierarchy([
    { cause: "Alternative A", rank: "secondary", confidence: 71 },
    { cause: "Primary", rank: "primary", confidence: 92 },
    { cause: "Alternative B", rank: "tertiary", confidence: 55 },
  ]);

  assert.equal(hierarchy.primary?.cause, "Primary");
  assert.deepEqual(
    hierarchy.alternatives.map((cause) => cause.cause),
    ["Alternative A", "Alternative B"]
  );
  assert.deepEqual(
    hierarchy.alternatives.map((cause) => cause.confidence),
    [71, 55]
  );
});

test("an event label is not promoted when no ranked primary exists", () => {
  const hierarchy = buildCauseHierarchy([
    { cause: "Candidate only", confidence: 80 },
  ]);

  assert.equal(hierarchy.primary, null);
  assert.deepEqual(hierarchy.alternatives, []);
});

test("observation labels do not reinterpret event confidence", () => {
  assert.equal(observationCountLabel(3), "3 distinct observations");
  assert.equal(observationCountLabel(1), "1 distinct observation");
});
