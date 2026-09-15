import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("production sessions use private object storage rather than invocation-local filesystem", () => {
  const storage = fs.readFileSync(new URL("./subscriberCalibrationStorage.ts", import.meta.url), "utf8");
  const server = fs.readFileSync(new URL("./subscriberWorkshopSession.server.ts", import.meta.url), "utf8");
  assert.match(storage, /subscriber-calibration-private/);
  assert.match(storage, /storage\.upload/);
  assert.match(storage, /\.storage\.from\(BUCKET\)[\s\S]*download/);
  assert.match(storage, /activeSubscriberSessionObjectPath/);
  assert.match(storage, /readLatestDurableSubscriberWorkshopSession/);
  assert.match(storage, /application\/octet-stream/);
  assert.match(storage, /previousId[\s\S]*storage\.remove/);
  assert.doesNotMatch(storage, /node:fs|\.next\/cache|process\.cwd/);
  assert.match(server, /createDurableSubscriberWorkshopSession/);
  assert.match(server, /readLatestDurableSubscriberWorkshopSession/);
});

test("Workshop reopens the latest owner-and-vehicle-scoped durable session without falling back from an explicit token", () => {
  const page = fs.readFileSync(new URL("../../app/dashboard/vehicles/[id]/calibration/page.tsx", import.meta.url), "utf8");
  assert.match(page, /subscriberSession \? null : await readLatestSubscriberWorkshopSession\(user\.id, vehicle\.id\)/);
  assert.match(page, /subscriberSession \? await readSubscriberWorkshopSession/);
  assert.match(page, /activeSubscriberSession/);
  assert.doesNotMatch(page, /subscriberSession[^\n]*\?[^\n]*readSubscriberWorkshopSession[^\n]*:[^\n]*readLatestSubscriberWorkshopSession/);
});
