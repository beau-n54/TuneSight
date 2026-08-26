import assert from "node:assert/strict";
import test from "node:test";
import {
  constructWorkshopDiscoveryRegistry,
  developmentCalibrationWorkshopProvider,
} from "./developmentFixtureProvider.ts";

test("real development provider materializes the complete IJE0S Workshop path", async () => {
  const workshop = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop(
    "provider-integration-vehicle",
    "provider-integration-user",
  );

  assert.equal(workshop.source.kind, "development_fixture");
  assert.equal(workshop.source.label, "IJE0S Original → IJE0S MapSwitch");
  assert.match(workshop.source.referenceDatasetId, /^qualified-calibration-dataset:/);
  assert.match(workshop.source.currentDatasetId, /^qualified-calibration-dataset:/);
  assert.match(workshop.source.comparisonId, /^qualified-calibration-comparison:/);
  assert.equal(workshop.definitions.length, 739);
  assert.equal(workshop.comparison.totalDefinitions, 739);
  assert.equal(workshop.states[0]?.sourceRole, "Stock Candidate");
  assert.equal(workshop.states[0]?.availability, "available");
  assert.equal(workshop.states[1]?.sourceRole, "MapSwitch");
  assert.equal(workshop.states[1]?.availability, "available");
  assert.equal(workshop.states[2]?.availability, "unavailable");
  assert.equal(workshop.states[3]?.availability, "unavailable");
  assert.ok(workshop.selectedDefinition.cells.length > 0);
  assert.ok(!JSON.stringify(workshop).includes('"bytes"'));
});

test("development registry remains fail-closed for an inconsistent descriptor universe", () => {
  assert.throws(
    () => constructWorkshopDiscoveryRegistry([]),
    /Every active qualified relationship requires its exact ROM Layout Identity descriptor source/,
  );
});
