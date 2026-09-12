import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCalibrationSlice, buildCalibrationSurfaceMesh, buildCalibrationVisualizationModel } from "./visualizationModel.ts";
import { buildSubscriberWorkshop, loadSubscriberCalibration, SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES } from "./subscriberCalibrationProvider.ts";

const observedAt = "2026-09-02T00:00:00.000Z";
const load = (name: string) => new Uint8Array(fs.readFileSync(`BMW-XDFs-master/N54/${name}`));
const loadB58 = (name: string) => new Uint8Array(fs.readFileSync(`BMW-XDFs-master/B58gen1/${name}`));

test("an uploaded N54 BIN alone establishes exact coverage and a subscriber Current Dataset", async (context) => {
  const bytes = load("IJE0S_MapSwitchBase.bin");
  const result = await loadSubscriberCalibration({ bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") return;
  assert.equal(result.identity, "IJE0S");
  if ("mode" in result.workshop || result.material.reference === null || result.material.comparison === null) assert.fail("N54 must retain comparison Workshop material.");
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
  if ("mode" in oneDWorkshop) assert.fail("N54 selection must retain comparison mode.");
  assert.equal(oneDWorkshop.selectedDefinition.summary.key, oneD.key);
  assert.ok(buildCalibrationSlice(buildCalibrationVisualizationModel(oneDWorkshop.selectedDefinition), "row", 0).length > 0);

  const twoD = result.workshop.definitions.find((item) => item.available && item.shape === "2D")!;
  const twoDWorkshop = buildSubscriberWorkshop(result, twoD.key);
  if ("mode" in twoDWorkshop) assert.fail("N54 selection must retain comparison mode.");
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
      if ("mode" in result.workshop) assert.fail("N54 must retain comparison mode.");
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
  assert.equal(b58.coverage?.outcome, "EXACT_DEFINITION_COVERAGE");

  assert.equal((await loadSubscriberCalibration({ bytes: new Uint8Array(), fileName: "empty.bin", mimeType: null, observedAt })).status, "invalid_upload");
  assert.equal((await loadSubscriberCalibration({ bytes: new Uint8Array(SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES + 1), fileName: "large.bin", mimeType: null, observedAt })).status, "invalid_upload");
});

test("only the exactly published B58 Gen1 relationship enters a Current-only Workshop", async () => {
  const fixtures = [
    ["00003076501D02_original.bin", "00003076501D02"],
    ["000030765A3C06_original.bin", "000030765A3C06"],
    ["00003081501102_original.bin", "00003081501102"],
    ["00003081501D04_original.bin", "00003081501D04"],
    ["00007972000705_original.bin", "00007972000705"],
  ] as const;
  const exactBytes = new Uint8Array(7_864_320), exactMarker = Buffer.from("00003076501103", "hex");
  for (const offset of [262469, 6814977, 7863823]) exactBytes.set(exactMarker, offset);
  const accepted = await loadSubscriberCalibration({ bytes: exactBytes, fileName: "subscriber.bin", mimeType: null, observedAt });
  assert.equal(accepted.status, "workshop_ready");
  if (accepted.status === "workshop_ready") {
    assert.equal(accepted.identity, "00003076501103");
    assert.ok("mode" in accepted.workshop);
    if ("mode" in accepted.workshop) {
      assert.equal(accepted.workshop.mode, "current_only");
      assert.equal(accepted.workshop.summary.totalDefinitions, 1175);
      assert.equal(accepted.workshop.summary.currentAvailable, 1174);
      assert.equal(accepted.workshop.summary.unavailable, 1);
      assert.equal(accepted.workshop.source.referenceDatasetId, null);
      assert.equal(accepted.workshop.source.comparisonId, null);
      assert.equal(accepted.workshop.capabilities.mutation, false);
    }
  }

  for (const [fileName, identity] of fixtures) {
    const bytes = loadB58(fileName);
    const result = await loadSubscriberCalibration({ bytes, fileName, mimeType: "application/octet-stream", observedAt });
    assert.equal(result.status, "coverage_unavailable", identity);
    assert.equal(result.identity, identity);
    assert.equal(result.byteLength, bytes.byteLength);
    assert.equal(result.coverage?.outcome, "ROM_RECOGNIZED_DEFINITIONS_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(result), /Development Evidence Preview|development_fixture|MapSwitch Dataset/);
  }
});

test("B58 identity resolution scans the full payload and does not infer identity from an eight-MiB file", async () => {
  const identity = "00007972000705";
  const unidentified = new Uint8Array(8 * 1024 * 1024);
  const unknown = await loadSubscriberCalibration({ bytes: unidentified, fileName: "custom-tune.bin", mimeType: null, observedAt });
  assert.equal(unknown.status, "coverage_unavailable");
  assert.equal(unknown.identity, null);
  assert.equal(unknown.coverage?.outcome, "INVALID");

  const marker = new Uint8Array(Buffer.from(identity, "hex"));
  unidentified.set(marker, unidentified.byteLength - marker.byteLength - 1);
  const recognized = await loadSubscriberCalibration({ bytes: unidentified, fileName: "custom-tune.bin", mimeType: null, observedAt });
  assert.equal(recognized.status, "coverage_unavailable");
  assert.equal(recognized.identity, identity);
  assert.equal(recognized.coverage?.outcome, "ROM_RECOGNIZED_DEFINITIONS_UNAVAILABLE");
});

test("a governed B58 Gen2 primary marker resolves despite a disclosed ancillary identity marker", async () => {
  const bytes = new Uint8Array(8 * 1024 * 1024), primary = Buffer.from("00005D553C8C05", "hex"), ancillary = Buffer.from("00005D553C7805", "hex");
  for (const offset of [524613, 7339265, 8388111]) bytes.set(primary, offset);
  bytes.set(ancillary, 131371);
  const result = await loadSubscriberCalibration({ bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt });
  assert.equal(result.status, "coverage_unavailable");
  assert.equal(result.identity, "00005D553C8C05");
  assert.equal(result.coverage?.outcome, "ROM_RECOGNIZED_DEFINITIONS_UNAVAILABLE");
  assert.ok(result.coverage?.discoveryPackage?.provenance.some((item) => item.includes("repeated-marker profile")));
  assert.doesNotMatch(JSON.stringify(result), /Development Evidence Preview|development_fixture/);
});
