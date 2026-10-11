import assert from "node:assert/strict";
import test from "node:test";
import { translateMhdRows } from "../logging/mhd.ts";
import { translateBm3Rows } from "../logging/bm3.ts";
import { buildQualifiedParsedLog, qualifiedAnalysisPlatform } from "./qualifiedAnalysisInput.ts";
import { qualifyEvidenceSource } from "./evidenceSourceQualification.ts";
import { validateFuelAgainstTune } from "./fuelValidation.ts";
import { segmentPulls } from "../logs/segmentPulls.ts";

// Synthetic rows use the explicit MHD header format already represented by the
// lawful N54 compatibility fixture. No physical vehicle acceptance is claimed.
const rows = () => [0,0.1,0.2].map((time,index) => ({ Time: time, RPM: 3000+index*100, "Boost Mean PSI": 15, "Boost target (PSI)": 17, "Accel Ped. Pos. (%)": 100, "Throttle Position (%)": 95, "WGDC Bank 1 (%)": 60, "IAT (*C)": 40 }));
const context = { sourceLogId: "synthetic-log", sourceAvailability: "available" as const };
test("N54 source time, boost and pedal/plate are distinct aligned observations", () => {
  const translated = translateMhdRows(rows()), parsed = buildQualifiedParsedLog(translated);
  assert.deepEqual(parsed.timestamps,[0,0.1,0.2]);
  assert.deepEqual(parsed.channels.throttle,[95,95,95]);
  assert.deepEqual(parsed.channels.accelerator_pedal,[100,100,100]);
  assert.equal(qualifiedAnalysisPlatform({ vehicleId: "n54", engineCode: "N54" }),"n54");
});
test("B58 Gen1, Supra/B58TUE and unknown vehicle contexts never inherit N54 applicability", () => {
  for (const engineCode of ["B58", "B58 Gen1", "B58TUE", "B58 Gen2", "Supra", "", "N54 expected"])
    assert.equal(qualifiedAnalysisPlatform({ vehicleId: "synthetic", engineCode }),"unknown");
  assert.equal(qualifiedAnalysisPlatform(null),"unknown");
});
test("throttle plate cannot stand in for an unobserved accelerator pedal", () => {
  const plateOnly = [0, 1, 2].map((Time, index) => ({ Time, RPM: 3000 + index * 1000, "Throttle Position (%)": 95 }));
  for (const translate of [translateMhdRows, translateBm3Rows]) {
    const parsed = buildQualifiedParsedLog(translate(plateOnly));
    assert.deepEqual(parsed.channels.throttle, [95, 95, 95]);
    assert.deepEqual(parsed.channels.accelerator_pedal, []);
    assert.deepEqual(parsed.evidenceTelemetry?.accelerator_pedal, [null, null, null]);
    assert.deepEqual(segmentPulls(parsed), []);
  }
});
test("fuel classification requires measured ethanol and qualified platform; zero is measured pump content", () => {
  assert.equal(validateFuelAgainstTune({ platform: "n54", ethanolContent: null }).status, "unavailable");
  assert.equal(validateFuelAgainstTune({ platform: "b58", ethanolContent: 0 }).status, "unavailable");
  assert.equal(validateFuelAgainstTune({ platform: "n54", ethanolContent: 0, fuelingIntent: "pump" }).status, "pass");
  assert.equal(validateFuelAgainstTune({ platform: "n54", ethanolContent: 101 }).status, "unavailable");
});
test("Fahrenheit conversion and Celsius agree; conflicting or unitless temperatures are unavailable", () => {
  const c = translateMhdRows([{ "IAT (*C)":40 }]).rows[0].iat;
  assert.equal(translateMhdRows([{ "IAT[F]":104 }]).rows[0].iat,c);
  assert.equal(translateMhdRows([{ "IAT[F]":104, "IAT (*C)":40 }]).rows[0].iat,null);
  assert.equal(translateMhdRows([{ IAT:40 }]).rows[0].iat,null);
});
test("load request and absolute pressure cannot become relative boost or its target", () => {
  const row = translateMhdRows([{ "Load req.":180, "Boost (psia)":30, "Boost":15, "Boost Target":17 }]).rows[0];
  assert.equal(row.boostTargetPsi,null); assert.equal(row.boostPsi,null);
  assert.equal(translateBm3Rows([{ "Boost Pressure":30, "Target Boost":17 }]).rows[0].boostPsi,null);
});
test("ignition advance is not timing correction, and duplicate qualified aliases are ambiguous", () => {
  assert.equal(translateMhdRows([{ "Ignition Timing Cyl 1":-5 }]).rows[0].timingCyl1,null);
  assert.equal(translateMhdRows([{ "Cyl1 Timing Cor (*)":-5 }]).rows[0].timingCyl1,-5);
  assert.equal(translateMhdRows([{ "Boost Mean PSI":10,"Boost (PSI)":20 }]).rows[0].boostPsi,null);
});
test("missing/nonmonotonic time blocks Analysis instead of fabricating a timebase", () => {
  const noTime = rows().map(({Time, ...row}) => { void Time; return row; });
  assert.equal(qualifyEvidenceSource(noTime,context).kind,"invalid_or_incomplete_source");
  assert.throws(() => buildQualifiedParsedLog(translateMhdRows(noTime)));
  const regressed=rows();regressed[1].Time=0;assert.throws(() => buildQualifiedParsedLog(translateMhdRows(regressed)));
});
test("partial observations retain null gaps and measured zero; optional channels are not zero filled", () => {
  const translated=translateMhdRows(rows());translated.rows[0].lpfp=0;translated.rows[1].lpfp=null;translated.rows[2].lpfp=50;
  const parsed=buildQualifiedParsedLog(translated);
  assert.deepEqual(parsed.evidenceTelemetry?.lpfp,[0,null,50]);assert.deepEqual(parsed.channels.lpfp,[]);
  assert.deepEqual(parsed.channels.rail_pressure,[]);assert.ok(parsed.unavailableChannels?.includes("rail_pressure"));
});
