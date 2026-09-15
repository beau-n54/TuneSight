import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { selectSubscriberWorkshopEntry } from "./subscriberWorkshopEntry.ts";

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
