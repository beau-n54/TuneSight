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
  assert.match(page, /resolveSubscriberWorkshopSession\(\{ requestedSession: query\.session, ownerId: user\.id, vehicleId: vehicle\.id \}/);
  assert.match(page, /readSession: readSubscriberWorkshopSession/);
  assert.match(page, /readLatest: readLatestSubscriberWorkshopSession/);
  assert.match(page, /explicitSession: session\.explicit/);
  const failure = page.indexOf('if (entry.mode === "session_unavailable")');
  assert.ok(failure >= 0 && failure < page.indexOf('if (entry.mode === "empty")'));
  assert.match(page.slice(failure, page.indexOf('if (entry.mode === "empty")')), /return <main[\s\S]*Calibration session unavailable/);
  assert.match(page, /activeSubscriberSession/);
  assert.doesNotMatch(page, /redirect\(`\/dashboard\/vehicles/);
});

test("vehicle-owned derived Workshop evidence has a bounded lifetime independent of the shorter source lease", () => {
  const storage = fs.readFileSync(new URL("./subscriberCalibrationStorage.ts", import.meta.url), "utf8");
  assert.match(storage, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(storage, /Losing source bytes disables reconstruction, not VIEW/);
});
