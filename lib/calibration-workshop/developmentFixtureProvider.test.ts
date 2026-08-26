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
  assert.equal(new Set(workshop.definitions.map((definition) => definition.key)).size, 739);
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

test("Definition instance identities are stable through reconstruction, search and filters", async () => {
  const first = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("identity-vehicle", "identity-user");
  const second = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("identity-vehicle", "identity-user");
  assert.deepEqual(first.definitions.map((item) => item.key), second.definitions.map((item) => item.key));

  const duplicateRevision = first.definitions.filter(
    (item) => item.definitionRevision === "xdf-definition-revision:94e2b9ca069c6bdfd9cc78f2ea7e61b7d4cb9de67b16e2543222c18277eb516d",
  );
  assert.equal(duplicateRevision.length, 2);
  assert.equal(new Set(duplicateRevision.map((item) => item.key)).size, 2);
  assert.deepEqual(duplicateRevision.map((item) => item.occurrence), [0, 1]);

  for (const item of [first.definitions.find((value) => value.outcome === "changed"), first.definitions.find((value) => !value.available)]) {
    assert.ok(item);
    const rebuilt = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("identity-vehicle", "identity-user", item!.key);
    assert.equal(rebuilt.selectedDefinition.summary.key, item!.key);
  }
});

test("development registry remains fail-closed for an inconsistent descriptor universe", () => {
  assert.throws(
    () => constructWorkshopDiscoveryRegistry([]),
    /Every active qualified relationship requires its exact ROM Layout Identity descriptor source/,
  );
});
