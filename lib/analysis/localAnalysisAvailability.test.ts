import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {diagnosticCheckAvailability} from "./diagnosticCheckAvailability.ts";
import {buildQualifiedParsedLog} from "./qualifiedAnalysisInput.ts";
import {translateMhdRows} from "../logging/mhd.ts";
import {ADDITIONAL_TELEMETRY_COLORS, ADDITIONAL_TELEMETRY_DASHES, TELEMETRY_CHANNELS, resolveGraphSeries} from "../../app/dashboard/vehicles/[id]/analysis/telemetryGraphPresentation.ts";

test("channel identity preserves colour through whole-log and interval selections", () => {
  assert.equal(new Set(Object.values(ADDITIONAL_TELEMETRY_COLORS)).size,Object.keys(ADDITIONAL_TELEMETRY_COLORS).length);
  assert.equal(TELEMETRY_CHANNELS.intakeAirTemperature.color,"#facc15");
  assert.equal(TELEMETRY_CHANNELS.highPressureFuel.color,"#34d399");
  assert.equal(TELEMETRY_CHANNELS.airFuelRatio.color,"#fb7185");
  for(const [id,color] of Object.entries(ADDITIONAL_TELEMETRY_COLORS)) {
    const channel={id,color,aliases:[id],label:id,unit:"test",strokeDasharray:ADDITIONAL_TELEMETRY_DASHES[id]};
    for(const values of [[1,2,3],[2,3],[3]]) assert.equal(resolveGraphSeries({[id]:values},[channel])[0].color,color);
  }
  assert(ADDITIONAL_TELEMETRY_DASHES.load_requested);assert(ADDITIONAL_TELEMETRY_DASHES.manifold_gauge_target);
  const renderer=readFileSync("app/dashboard/vehicles/[id]/analysis/EngineeringLineRenderer.tsx","utf8");
  assert.match(renderer,/stroke=\{item.color\}/);assert.match(renderer,/backgroundColor: item.color/);
  assert.match(readFileSync("app/dashboard/vehicles/[id]/analysis/TelemetryGraphV1.tsx","utf8"),/item.color/);
});

test("existing qualified checks expose no-event, missing-input and fuel blockers without adding events", () => {
  const log=buildQualifiedParsedLog(translateMhdRows([0,1,2].map(Time=>({Time,RPM:3000,"IAT (*C)":30,"Boost Mean PSI":10,"Boost target (PSI)":10,"Throttle Position (%)":95,"WGDC Bank 1 (%)":50}))));
  const before=JSON.stringify(log),checks=diagnosticCheckAvailability(log,[],[],false);
  assert.equal(checks.find(c=>c.id==="heat_soak")?.state,"evaluated_no_event");
  assert.equal(checks.find(c=>c.id==="throttle_closure")?.state,"evaluated_no_event");
  assert.match(checks.find(c=>c.id==="rail_pressure_drop")?.reason??"",/rail_pressure/);
  assert(checks.every(c=>c.eventCount===0));assert.equal(JSON.stringify(log),before);
});
