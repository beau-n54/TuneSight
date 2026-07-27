import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCrossReferenceNotes,
  groupEventsForPresentation,
  selectScopedPrimaryResults,
  STANDARD_INSPECTION_PANEL_GEOMETRY,
  WIDE_INSPECTION_PANEL_GEOMETRY,
} from "./analysisPresentation.ts";

test("standard and wide panels use intentional shared geometry", () => {
  assert.match(STANDARD_INSPECTION_PANEL_GEOMETRY, /h-\[31rem\]/);
  assert.match(WIDE_INSPECTION_PANEL_GEOMETRY, /h-\[34rem\]/);
  assert.match(STANDARD_INSPECTION_PANEL_GEOMETRY, /grid-rows/);
  assert.match(WIDE_INSPECTION_PANEL_GEOMETRY, /grid-rows/);
});

test("repeated event families group without changing event order or count", () => {
  const events = [
    { id: "lean-1", type: "lean_under_load", evidence: ["AFR 13.1"] },
    { id: "wgdc-1", type: "wgdc_saturation", evidence: ["WGDC 98"] },
    { id: "lean-2", type: "lean_under_load", evidence: ["AFR 13.3"] },
    { id: "wgdc-2", type: "wgdc_saturation", evidence: ["WGDC 92"] },
  ];

  const groups = groupEventsForPresentation(events);

  assert.deepEqual(
    groups.map((group) => group.eventType),
    ["lean_under_load", "wgdc_saturation"]
  );
  assert.deepEqual(
    groups[0].events.map((event) => event.id),
    ["lean-1", "lean-2"]
  );
  assert.equal(
    groups.flatMap((group) => group.events).length,
    events.length
  );
  assert.deepEqual(groups[0].events[0].evidence, ["AFR 13.1"]);
});

test("single events retain a single-event group", () => {
  const groups = groupEventsForPresentation([
    { id: "event-1", type: "boost_overshoot" },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].events.length, 1);
});

test("global notes deduplicate exactly and retain provenance", () => {
  const hierarchy = classifyCrossReferenceNotes([
    {
      eventId: "event-1",
      notes: [
        "Tune profile available for V3 reasoning.",
        "Event appears in the midrange load area.",
      ],
    },
    {
      eventId: "event-2",
      notes: [
        "Tune profile available for V3 reasoning.",
        "Event appears near the top end.",
      ],
    },
  ]);

  assert.deepEqual(hierarchy.globalNotes, [
    {
      text: "Tune profile available for V3 reasoning.",
      sourceEventIds: ["event-1", "event-2"],
    },
  ]);
  assert.deepEqual(hierarchy.eventSpecificNotes.get("event-1"), [
    "Event appears in the midrange load area.",
  ]);
});

test("similar but non-identical notes remain separate and ordered", () => {
  const source = [
    {
      eventId: "event-1",
      notes: ["Boost intent: low.", "Boost intent: moderate."],
    },
  ];
  const before = structuredClone(source);
  const hierarchy = classifyCrossReferenceNotes(source);

  assert.deepEqual(
    hierarchy.globalNotes.map((note) => note.text),
    ["Boost intent: low.", "Boost intent: moderate."]
  );
  assert.deepEqual(source, before);
});

test("only explicit primary causes become scoped primary results", () => {
  const results = selectScopedPrimaryResults(
    [
      { id: "boost-1", type: "boost_undershoot" },
      { id: "lean-1", type: "lean_under_load" },
    ],
    [
      {
        eventId: "boost-1",
        rootCauses: [
          { rank: "primary", cause: "Turbo Flow Limit", confidence: 95 },
          { rank: "secondary", cause: "Alternative", confidence: 70 },
        ],
      },
      {
        eventId: "lean-1",
        rootCauses: [],
      },
    ]
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].event.type, "boost_undershoot");
  assert.equal(results[0].rootCause.cause, "Turbo Flow Limit");
});
