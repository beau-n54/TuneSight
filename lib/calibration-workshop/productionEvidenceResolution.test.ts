import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import nextConfig from "../../next.config.ts";
import { clearDevelopmentFixtureCacheForTests, developmentCalibrationWorkshopProvider } from "./developmentFixtureProvider.ts";

const required = ["I8A0S", "IJE0S", "IKM0S", "INA0S"].flatMap((identity) => [`${identity}.xdf`, `${identity}_original.bin`, `${identity}_MapSwitchBase.bin`]);

test("production calibration routes explicitly trace every controlled runtime Evidence resource", () => {
  const includes = nextConfig.outputFileTracingIncludes;
  assert.deepEqual(includes?.["/dashboard/vehicles/*/calibration"], ["./BMW-XDFs-master/N54/**/*.xdf", "./BMW-XDFs-master/N54/**/*.bin"]);
  assert.deepEqual(includes?.["/api/calibration-workshop/upload"], includes?.["/dashboard/vehicles/*/calibration"]);
  const root = path.resolve(process.cwd(), "BMW-XDFs-master", "N54");
  for (const file of required) { const stat = fs.statSync(path.join(root, file)); assert.ok(stat.isFile() && stat.size > 0, `${file} must be a non-empty repository-controlled runtime resource`); }
  const page = fs.readFileSync(path.resolve("app/dashboard/vehicles/[id]/calibration/page.tsx"), "utf8"), upload = fs.readFileSync(path.resolve("app/api/calibration-workshop/upload/route.ts"), "utf8");
  assert.match(page, /export const maxDuration = 60/); assert.match(upload, /export const maxDuration = 60/);
});

test("production-style cold provider path reaches a governed Workshop View Model within the declared execution budget", { timeout: 60_000 }, async () => {
  clearDevelopmentFixtureCacheForTests();
  const started = performance.now();
  const workshop = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("production-route-vehicle", "production-route-user", null, "IJE0S");
  const elapsedMs = performance.now() - started;
  assert.equal(workshop.source.label, "IJE0S Original → IJE0S MapSwitch");
  assert.equal(workshop.comparison.totalDefinitions, 739);
  assert.ok(workshop.definitions.length === 739 && workshop.selectedDefinition !== null);
  assert.ok(elapsedMs < 8_000, `cold provider repeated full-binary work or exceeded the production CPU budget: ${Math.round(elapsedMs)} ms`);
});
