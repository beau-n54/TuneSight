import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {parseSourceMeasurements} from "./analysisCapabilities.ts";
import {sourceObservationEvents} from "./sourceObservationEvents.ts";
import type {AnalysisSource} from "./analysisSource";

const source = (text: string): AnalysisSource => ({state: "available", digest: "synthetic", finding: "Synthetic source", measurements: parseSourceMeasurements(text)});
const census = JSON.parse(fs.readFileSync(new URL("../../engineering/calibration/bmw-master-99-xdf-census.json", import.meta.url), "utf8")) as {rows: {family: string}[]};
const families = [...new Set(census.rows.map(row => row.family))];
for (const family of families) for (const logger of ["mhd", "bm3"]) test(`${family}/${logger}: source events are independent of a platform diagnosis`, () => {
  const input = source(logger === "mhd"
    ? "Time,RPM,Boost Mean PSI,Boost target (PSI),Rail pressure (PSI),Cyl1 Timing Cor (*),Cyl2 Timing Cor (*)\n0,1000,2,3,2000,0,0\n1,2000,4,3,1800,-1,-3\n2,3000,3,3,1900,0,0"
    : "Time,Engine Speed (RPM),Boost Pressure (psi),Target Boost (psi),Rail Pressure (psi),Cyl1 Timing Cor (*),Cyl2 Timing Cor (*)\n0,1000,2,3,2000,0,0\n1,2000,4,3,1800,-1,-3\n2,3000,3,3,1900,0,0");
  const before = JSON.stringify(input), result = sourceObservationEvents(input);
  assert.equal(input.measurements?.sourceFormat, logger);
  for (const id of ["actual-above-target", "actual-below-target", "rail_pressure", "cylinder-spread"]) assert.equal(result.checks.find(c => c.id === id)?.state, "observed");
  assert.equal(result.checks.find(c => c.id === "lpfp")?.state, "unavailable");
  assert.doesNotMatch(JSON.stringify(result), /N54|B58|"confidence":|knock detected|hardware failure detected/);
  assert.equal(JSON.stringify(input), before);
});
test("source rows, actual acquisition times and gaps bound events without interpolation", () => {
  const input = source("Time,RPM,Boost Mean PSI,Boost target (PSI)\n10,1000,4,3\n10.5,2000,,3\n12,3000,6,3");
  const events = sourceObservationEvents(input).checks[0].events;
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(e => [e.startRow,e.endRow,e.startSeconds,e.endSeconds,e.value]), [[0,0,0,0,1],[2,2,2,2,3]]);
});
test("pressure decline uses adjacent rows, never independent peaks or a fault threshold", () => {
  const result = sourceObservationEvents(source("Time,RPM,Boost Mean PSI,Rail pressure (PSI)\n0,1000,1,2000\n1,1000,1,1800\n2,1000,1,\n3,1000,1,1500"));
  const events = result.checks.find(c => c.id === "rail_pressure")!.events;
  assert.equal(events.length, 1); assert.equal(events[0].value, 200); assert.equal(events[0].startRow, 0);
  assert.match(events[0].withheld, /No applicable limit/);
});
test("pedal is never passed off as commanded throttle", () => {
  const result = sourceObservationEvents(source("Time,RPM,Boost Mean PSI,Accel. Pedal[%],Throttle Position (%)\n0,1000,1,80,20"));
  const event = result.checks.find(c => c.id === "pedal-plate")!.events[0];
  assert.match(event.evidence, /not commanded throttle/);
  assert.match(event.withheld, /does not establish/);
});
for (const count of [4,6,8]) test(`${count} supplied cylinders retain their exact channel layout`, () => {
  const headers = Array.from({length:count},(_,i) => `Cyl${i+1} Timing Cor (*)`);
  const input = source(`Time,RPM,Boost Mean PSI,${headers.join(",")}\n0,1000,1,${headers.map((_,i)=>-i).join(",")}`);
  const result = sourceObservationEvents(input);
  assert.equal(result.cylinders.length, count);
  assert.equal(result.checks.find(c => c.id === "cylinder-spread")!.events[0].value, count-1);
});
test("ambiguous and damaged extra-cylinder headers remain unavailable", () => {
  const input = source("Time,RPM,Boost Mean PSI,Cyl7 Timing Cor (*),Cyl 7 Timing Cor (*),(RAM) Ignition Timing Corr. Cyl. 8[\uFFFD]\n0,1000,1,-2,-4,-5");
  assert.equal(sourceObservationEvents(input).cylinders.length, 0);
});
test("unavailable source cannot expose retained measurements or event evidence", () => {
  const input = source("Time,RPM,Boost Mean PSI,Boost target (PSI)\n0,1000,4,3");
  for (const state of ["missing","unreadable"] as const) {
    const result = sourceObservationEvents({...input, state} as AnalysisSource);
    assert.equal(result.events.length, 0); assert(result.checks.every(c => c.state === "unavailable"));
  }
});
