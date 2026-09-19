import assert from "node:assert/strict";
import fs from "node:fs";
import test, { before } from "node:test";
import { resolveSubscriberWorkshopSession, selectSubscriberWorkshopEntry } from "./subscriberWorkshopEntry.ts";
import { loadSubscriberCalibration, type SubscriberCalibrationResult, type SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { decodeSubscriberSession, encodeSubscriberSession } from "./subscriberCalibrationPersistence.ts";
import { resolveVehicleOwnedCalibrationEvidence } from "./vehicleOwnedCalibrationEvidence.ts";

const requestedId = "A".repeat(32), latestId = "B".repeat(32), roleId = "C".repeat(32);
const ownerId = "owner-a", vehicleId = "vehicle-a", now = 1_800_000_000_000;
let ready: SubscriberCalibrationSuccess;
let stored: Uint8Array;

before(async () => {
  const result = await loadSubscriberCalibration({ bytes: new Uint8Array(fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin")), fileName: "subscriber.bin", mimeType: null, observedAt: "2026-09-02T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") throw new Error("Controlled fixture must qualify");
  ready = result;
  stored = encodeSubscriberSession(ownerId, vehicleId, now + 1000, ready);
});

async function enter(requestedSession: string | string[] | undefined, options: {
  bytes?: Uint8Array; readAt?: number; owner?: string; vehicle?: string;
  unavailable?: boolean; latestUnavailable?: boolean; roleUnavailable?: boolean;
  result?: SubscriberCalibrationResult;
} = {}) {
  const calls: string[] = [];
  const owner = options.owner ?? ownerId, vehicle = options.vehicle ?? vehicleId;
  const session = await resolveSubscriberWorkshopSession({ requestedSession, ownerId: owner, vehicleId: vehicle }, {
    readSession: async (id, actualOwner, actualVehicle) => {
      calls.push("explicit");
      assert.equal(id, requestedId);
      assert.deepEqual([actualOwner, actualVehicle], [owner, vehicle]);
      return options.unavailable ? null : options.result ?? decodeSubscriberSession(options.bytes ?? stored, actualOwner, actualVehicle, options.readAt ?? now);
    },
    readLatest: async (actualOwner, actualVehicle) => {
      calls.push("latest");
      assert.deepEqual([actualOwner, actualVehicle], [owner, vehicle]);
      return options.latestUnavailable ? null : { sessionId: latestId, result: ready };
    },
    recoverVehicle: async (actualOwner, actualVehicle) => {
      calls.push("vehicle");
      assert.deepEqual([actualOwner, actualVehicle], [owner, vehicle]);
      return options.roleUnavailable ? null : { sessionId: roleId, result: ready };
    },
  });
  const evidence = resolveVehicleOwnedCalibrationEvidence({ ownerId: owner, vehicleId: vehicle, result: session.result });
  const entry = selectSubscriberWorkshopEntry({ subscriberReady: Boolean(evidence.workshop), explicitSession: session.explicit, requestedPreviewRom: "IJE0S", runtimeEnvironment: "development" });
  return { session, evidence, entry, calls };
}

test("absent token recovers latest scoped session, then explicit vehicle role only when latest is unavailable", async () => {
  const latest = await enter(undefined);
  assert.deepEqual(latest.calls, ["latest"]);
  assert.equal(latest.session.sessionId, latestId);
  assert.equal(latest.entry.mode, "subscriber");
  const role = await enter(undefined, { latestUnavailable: true });
  assert.deepEqual(role.calls, ["latest", "vehicle"]);
  assert.equal(role.session.sessionId, roleId);
  assert.equal(role.entry.mode, "subscriber");
  const preview = await enter(undefined, { latestUnavailable: true, roleUnavailable: true });
  assert.equal(preview.entry.mode, "development_preview");
});

test("valid explicit token opens exactly the requested persisted Reference and Current evidence", async () => {
  const result = await enter(requestedId);
  assert.deepEqual(result.calls, ["explicit"]);
  assert.equal(result.session.sessionId, requestedId);
  assert.equal(result.entry.mode, "subscriber");
  assert.equal(result.evidence.outcome, "comparison_ready");
  assert.equal(result.evidence.currentCalibration?.sourceDigest, ready.material.current.exactBinaryIdentity.digest);
  assert.equal(result.evidence.referenceCalibration?.sourceDigest, ready.material.reference?.exactBinaryIdentity.digest);
});

for (const token of ["", "malformed", " ", "A".repeat(31), `${requestedId}!`, [], [requestedId, latestId], ["", requestedId]]) {
  test(`explicit malformed or ambiguous token ${JSON.stringify(token)} fails closed without reading any session or preview`, async () => {
    const result = await enter(token);
    assert.equal(result.session.explicit, true);
    assert.equal(result.session.result, null);
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.entry, { mode: "session_unavailable" });
  });
}

for (const [label, options] of [
  ["unavailable", { unavailable: true }],
  ["expired at the exact boundary", { readAt: now + 1000 }],
  ["another owner", { owner: "owner-b" }],
  ["another vehicle", { vehicle: "vehicle-b" }],
  ["corrupt persisted data", { bytes: new Uint8Array([1, 2, 3]) }],
] as const) {
  test(`explicit token with ${label} fails closed without latest, vehicle-role or preview substitution`, async () => {
    const result = await enter(requestedId, options);
    assert.equal(result.session.result, null);
    assert.deepEqual(result.calls, ["explicit"]);
    assert.deepEqual(result.entry, { mode: "session_unavailable" });
  });
}

test("explicit stored coverage failure retains its diagnostic without recovery or preview", async () => {
  const failure = { status: "coverage_unavailable", title: "Unavailable", message: "No qualified coverage", identity: null, digest: null, container: null, byteLength: null, coverage: null, timings: {} } as const;
  const result = await enter(requestedId, { bytes: encodeSubscriberSession(ownerId, vehicleId, now + 1000, failure) });
  assert.deepEqual(result.session.result, failure);
  assert.deepEqual(result.calls, ["explicit"]);
  assert.equal(result.entry.mode, "session_unavailable");
});

test("explicit session with ambiguous Current evidence cannot substitute a development preview", async () => {
  const result = await enter(requestedId, { result: { ...ready, material: { ...ready.material, current: { ...ready.material.current, sourceRole: "other_observed" } } } });
  assert.equal(result.evidence.outcome, "ambiguous_role");
  assert.deepEqual(result.calls, ["explicit"]);
  assert.equal(result.entry.mode, "session_unavailable");
});

test("production subscriber Workshop never falls back to a development fixture", () => {
  assert.deepEqual(selectSubscriberWorkshopEntry({ subscriberReady: false, requestedPreviewRom: undefined, runtimeEnvironment: "production" }), { mode: "empty" });
  assert.deepEqual(selectSubscriberWorkshopEntry({ subscriberReady: false, requestedPreviewRom: "IJE0S", runtimeEnvironment: "production" }), { mode: "empty" });
});

test("development preview requires both a non-production runtime and an explicit ROM", () => {
  assert.deepEqual(selectSubscriberWorkshopEntry({ subscriberReady: false, requestedPreviewRom: undefined, runtimeEnvironment: "development" }), { mode: "empty" });
  assert.deepEqual(selectSubscriberWorkshopEntry({ subscriberReady: false, requestedPreviewRom: "IJE0S", runtimeEnvironment: "development" }), { mode: "development_preview", requestedPreviewRom: "IJE0S" });
});

test("a ready subscriber session always takes precedence over preview state", () => {
  assert.deepEqual(selectSubscriberWorkshopEntry({ subscriberReady: true, requestedPreviewRom: "IJE0S", runtimeEnvironment: "development" }), { mode: "subscriber" });
});

test("the subscriber page presents a neutral empty state and retains safe upload failures", () => {
  const page = fs.readFileSync("app/dashboard/vehicles/[id]/calibration/page.tsx", "utf8");
  const upload = fs.readFileSync("app/dashboard/vehicles/[id]/calibration/upload-calibration.tsx", "utf8");
  assert.match(page, /No Current Calibration loaded/);
  assert.match(page, /Open Calibration File to begin/);
  assert.match(page, /entry\.mode === "empty"/);
  assert.match(upload, /setError\(value instanceof Error \? value\.message/);
});
