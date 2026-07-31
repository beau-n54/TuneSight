import assert from "node:assert/strict";
import test from "node:test";
import { buildIntelligentWarningsSummary } from "./intelligentWarningsPresentation.ts";

test("no qualified events or warnings produces GOOD", () => {
  assert.equal(
    buildIntelligentWarningsSummary({ events: [], warnings: [] }).state,
    "good"
  );
});

test("medium observations produce CAUTION", () => {
  assert.equal(
    buildIntelligentWarningsSummary({
      events: [{ severity: "medium" }],
      warnings: [],
    }).state,
    "caution"
  );
});

test("one High event produces WARNING", () => {
  assert.equal(
    buildIntelligentWarningsSummary({
      events: [{ severity: "high" }],
    }).state,
    "warning"
  );
});

test("multiple High events remain one WARNING summary", () => {
  const summary = buildIntelligentWarningsSummary({
    events: [
      { severity: "high" },
      { severity: "high" },
      { severity: "critical" },
    ],
  });

  assert.equal(summary.state, "warning");
  assert.equal(summary.title, "Significant Engineering Findings");
});

test("missing optional warning data preserves available event truth", () => {
  assert.equal(
    buildIntelligentWarningsSummary({
      events: [{ severity: "high" }],
      warnings: undefined,
    }).state,
    "warning"
  );
  assert.equal(
    buildIntelligentWarningsSummary({
      events: undefined,
      warnings: [{ severity: "medium" }],
    }).state,
    "caution"
  );
  assert.equal(
    buildIntelligentWarningsSummary({
      events: [{}],
      warnings: undefined,
    }).state,
    "caution"
  );
});

test("unsupported raw data cannot independently generate WARNING", () => {
  const summary = buildIntelligentWarningsSummary({
    events: [{ severity: "unsupported_internal_value" }],
    warnings: [],
  });

  assert.equal(summary.state, "good");
});

test("authoritative warning severity escalates without an event", () => {
  assert.equal(
    buildIntelligentWarningsSummary({
      events: [],
      warnings: [{ severity: "warning" }],
    }).state,
    "warning"
  );
});
