import fs from "node:fs";
import path from "node:path";
import { clearDevelopmentFixtureCacheForTests, developmentCalibrationWorkshopProvider } from "../lib/calibration-workshop/developmentFixtureProvider.ts";

const routes = [
  ".next/server/app/dashboard/vehicles/[id]/calibration/page.js.nft.json",
  ".next/server/app/api/calibration-workshop/upload/route.js.nft.json",
] as const;
const required = ["I8A0S", "IJE0S", "IKM0S", "INA0S"].flatMap((identity) => [`${identity}.xdf`, `${identity}_original.bin`, `${identity}_MapSwitchBase.bin`]);

for (const traceName of routes) {
  const tracePath = path.resolve(traceName);
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8")) as { files?: string[] };
  const traced = new Map((trace.files ?? []).map((relative) => [path.basename(relative), path.resolve(path.dirname(tracePath), relative)]));
  for (const name of required) {
    const resolved = traced.get(name);
    if (!resolved || !fs.statSync(resolved).isFile()) throw new Error(`${traceName} does not resolve controlled runtime Evidence ${name}.`);
  }
}

clearDevelopmentFixtureCacheForTests();
const started = performance.now();
const workshop = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("production-probe-vehicle", "production-probe-user", null, "IJE0S");
const elapsedMs = Math.round(performance.now() - started);
if (workshop.comparison.totalDefinitions !== 739 || workshop.definitions.length !== 739 || !workshop.selectedDefinition) throw new Error("Built production provider did not reach the governed Workshop View Model.");
if (elapsedMs >= 8_000) throw new Error(`Built production provider exceeded the production CPU budget: ${elapsedMs} ms.`);
console.log(JSON.stringify({ status: "production_runtime_verified", routes: routes.length, controlledResourcesPerRoute: required.length, definitions: workshop.definitions.length, elapsedMs }));
