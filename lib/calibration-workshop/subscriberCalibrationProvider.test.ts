import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCalibrationSlice, buildCalibrationSurfaceMesh, buildCalibrationVisualizationModel } from "./visualizationModel.ts";
import { buildSubscriberWorkshop, loadSubscriberCalibration, SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES } from "./subscriberCalibrationProvider.ts";

const observedAt = "2026-09-02T00:00:00.000Z";
const load = (name: string) => new Uint8Array(fs.readFileSync(`BMW-XDFs-master/N54/${name}`));

test("an uploaded N54 BIN alone establishes exact coverage and a subscriber Current Dataset", async (context) => {
  const bytes = load("IJE0S_MapSwitchBase.bin");
  const result = await loadSubscriberCalibration({ bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") return;
  assert.equal(result.identity, "IJE0S");
  assert.equal(result.coverage.outcome, "EXACT_DEFINITION_COVERAGE");
  assert.equal(result.workshop.source.kind, "subscriber_upload");
  assert.match(result.workshop.source.fixtureIdentity, new RegExp(result.digest));
  assert.equal(result.material.current.exactBinaryIdentity.digest, result.digest);
  assert.notEqual(result.material.reference.exactBinaryIdentity.digest, result.digest);
  assert.equal(result.workshop.states[1]?.label, "Current Calibration");
  assert.equal(result.workshop.capabilities.mutation, false);
  assert.equal(result.workshop.capabilities.suggestedCalibration, false);
  assert.ok(result.workshop.comparison.changed > 0);
  assert.ok(result.workshop.comparison.unchanged > 0);
  assert.doesNotMatch(JSON.stringify(result.workshop), /Development Evidence Preview|development_fixture|MapSwitch Dataset/);

  const oneD = result.workshop.definitions.find((item) => item.available && item.shape === "1D")!;
  const oneDWorkshop = buildSubscriberWorkshop(result, oneD.key);
  assert.equal(oneDWorkshop.selectedDefinition.summary.key, oneD.key);
  assert.ok(buildCalibrationSlice(buildCalibrationVisualizationModel(oneDWorkshop.selectedDefinition), "row", 0).length > 0);

  const twoD = result.workshop.definitions.find((item) => item.available && item.shape === "2D")!;
  const twoDWorkshop = buildSubscriberWorkshop(result, twoD.key);
  const visualization = buildCalibrationVisualizationModel(twoDWorkshop.selectedDefinition);
  assert.equal(visualization.capabilities.threeDimensional, true);
  assert.equal(buildCalibrationSurfaceMesh(visualization).available, true);
  assert.ok(twoDWorkshop.selectedDefinition.cells.length > 0);
  assert.equal(JSON.stringify(result).includes(Buffer.from(bytes.subarray(0, 64)).toString("base64")), false);
  context.diagnostic(`SUBSCRIBER_UPLOAD_TIMINGS ${JSON.stringify(result.timings)}`);
});

test("each governed N54 upload resolves its own ROM without a preview selector", async () => {
  for (const identity of ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const) {
    const result = await loadSubscriberCalibration({ bytes: load(`${identity}_original.bin`), fileName: `${identity}.bin`, mimeType: null, observedAt });
    assert.equal(result.status, "workshop_ready", identity);
    if (result.status === "workshop_ready") {
      assert.equal(result.identity, identity);
      assert.equal(result.material.current.exactBinaryIdentity.digest, result.digest);
      assert.equal(result.workshop.comparison.changed, 0);
    }
  }
});

test("unsupported, conflicting, invalid, and oversized inputs fail closed", async () => {
  const unknown = await loadSubscriberCalibration({ bytes: new TextEncoder().encode("unknown calibration payload"), fileName: "unknown.bin", mimeType: null, observedAt });
  assert.equal(unknown.status, "coverage_unavailable");
  assert.equal(unknown.coverage?.outcome, "INVALID");

  const conflict = await loadSubscriberCalibration({ bytes: new TextEncoder().encode("IJE0S IKM0S"), fileName: "conflict.bin", mimeType: null, observedAt });
  assert.equal(conflict.status, "coverage_unavailable");
  assert.equal(conflict.coverage?.outcome, "CONFLICT");

  const b58 = await loadSubscriberCalibration({ bytes: new TextEncoder().encode("00003076501103"), fileName: "b58.bin", mimeType: null, observedAt });
  assert.equal(b58.status, "coverage_unavailable");
  assert.equal(b58.identity, "00003076501103");
  assert.equal(b58.coverage?.outcome, "ROM_RECOGNIZED_DEFINITIONS_UNAVAILABLE");

  assert.equal((await loadSubscriberCalibration({ bytes: new Uint8Array(), fileName: "empty.bin", mimeType: null, observedAt })).status, "invalid_upload");
  assert.equal((await loadSubscriberCalibration({ bytes: new Uint8Array(SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES + 1), fileName: "large.bin", mimeType: null, observedAt })).status, "invalid_upload");
});
