import assert from "node:assert/strict";
import test from "node:test";
import { calibrationWorkshopPath, isSubscriberWorkshopSessionId, subscriberWorkshopSessionPath } from "./subscriberUploadNavigation.ts";

test("Founder upload journey starts sessionless and replaces prior session state", () => {
  const vehicleId = "vehicle/one";
  const cleanEntry = calibrationWorkshopPath(vehicleId);
  assert.equal(cleanEntry, "/dashboard/vehicles/vehicle%2Fone/calibration");
  assert.equal(new URL(cleanEntry, "http://localhost").search, "");

  const firstSession = "A".repeat(32);
  const firstWorkshop = subscriberWorkshopSessionPath(vehicleId, firstSession);
  assert.equal(new URL(firstWorkshop, "http://localhost").searchParams.get("session"), firstSession);

  const replacementSession = "B".repeat(32);
  const replacementWorkshop = subscriberWorkshopSessionPath(vehicleId, replacementSession);
  assert.equal(new URL(replacementWorkshop, "http://localhost").searchParams.get("session"), replacementSession);
  assert.equal(replacementWorkshop.includes(firstSession), false);
});

test("only issued-token-shaped state can enter unavailable-session handling", () => {
  for (const stale of [undefined, "", "undefined", "null", "stale-session", "A".repeat(31), "A".repeat(33)]) assert.equal(isSubscriberWorkshopSessionId(stale), false);
  assert.equal(isSubscriberWorkshopSessionId("Abc_123-".repeat(4)), true);
  assert.throws(() => subscriberWorkshopSessionPath("vehicle", "stale-session"), /valid subscriber/);
});
