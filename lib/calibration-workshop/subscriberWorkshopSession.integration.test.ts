import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("production sessions use private object storage rather than invocation-local filesystem", () => {
  const storage = fs.readFileSync(new URL("./subscriberCalibrationStorage.ts", import.meta.url), "utf8");
  const server = fs.readFileSync(new URL("./subscriberWorkshopSession.server.ts", import.meta.url), "utf8");
  assert.match(storage, /subscriber-calibration-private/);
  assert.match(storage, /\.storage\.from\(BUCKET\)\.upload/);
  assert.match(storage, /\.storage\.from\(BUCKET\)[\s\S]*download/);
  assert.doesNotMatch(storage, /node:fs|\.next\/cache|process\.cwd/);
  assert.match(server, /createDurableSubscriberWorkshopSession/);
});
