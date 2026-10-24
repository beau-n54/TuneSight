import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {parseSourceMeasurements} from "./analysisCapabilities.ts";
import {analysisEvidenceSections} from "./analysisEvidenceSections.ts";
import type {AnalysisSource} from "./analysisSource.ts";
const require=createRequire(import.meta.url), ts=require("typescript"), React=require("react"), {renderToStaticMarkup}=require("react-dom/server");
function load(file:string) {
  const mod={exports:{} as Record<string,unknown>};
  const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function("require","module","exports",js)(require,mod,mod.exports);return mod.exports;
}
const shell=load(path.resolve("components/EngineeringWorkspaceShell.tsx"));
const cylinders=load(path.resolve("app/dashboard/vehicles/[id]/analysis/CylinderTimingPanel.tsx"));
const ids=["engineering-summary","primary-engineering-results","engineering-telemetry","engineering-evidence","engineering-investigation","calibration-context"];
for(const platform of ["N13","N20","N26","B48","N54","N55","B58 Gen 1","B58 Gen 2","S55","S58","S63","unknown"]){
  test(`${platform}: identical six-section shared presentation with unavailable content`,()=>{
    const html=renderToStaticMarkup(React.createElement(shell.EngineeringWorkspaceShell,{summary:"Summary",primaryResults:"Unavailable",telemetry:"No channels",evidence:"No correlation",investigation:"No observations",calibrationContext:"No exact binding"}));
    assert.deepEqual([...html.matchAll(/<section[^>]* id="([^"]+)"/g)].map(m=>m[1]),ids);
    assert.equal((html.match(/xl:col-span-6/g)||[]).length,0);
    assert.equal((html.match(/xl:col-span-12/g)||[]).length,6);
    assert(!html.includes("<details"));assert(!html.includes("N54"));
  });
}
for(const count of [4,6,8])test(`${count} qualified cylinder-channel fixture: exact count, values and original card styling`,()=>{
  const headers=Array.from({length:count},(_,i)=>`Cyl${i+1} Timing Cor (*)`);
  const csv=`Time,RPM,Boost Mean PSI,${headers.join(",")}\n0,2000,5,${headers.map((_,i)=>-i).join(",")}\n1,3000,7,${headers.map(()=>0).join(",")}`;
  const source:AnalysisSource={state:"available",digest:"isolated-fixture",finding:"Fixture, not subscriber data",measurements:parseSourceMeasurements(csv)};
  const timing=analysisEvidenceSections(source).timing;
  assert.equal(timing.length,count);
  const html=renderToStaticMarkup(React.createElement(cylinders.CylinderTimingPanel,{timing}));
  assert.equal((html.match(/bg-zinc-950\/80 p-4 shadow-lg/g)||[]).length,count);
  assert(html.includes(`Cylinder ${count}`));assert(!html.includes(`Cylinder ${count+1}`));
  assert(html.includes("md:grid-cols-3 xl:grid-cols-6"));assert(html.includes("Missing channels do not establish"));
});
test("no source keeps structural containers and qualified warnings; current ownership and loaders remain",()=>{
  const source=fs.readFileSync("app/dashboard/vehicles/[id]/analysis/page.tsx","utf8");
  assert(!source.includes('source?.measurements ? <EngineeringWorkspaceShell'));
  assert(!source.includes('title="Advanced profile, diagnostic and scoring audit"'));
  for(const token of ["await requireSubscriberPage()","selectAnalysisEvidence(","readAnalysisSource(","recoverAnalysisWorkspace(","readAnalysisCalibration(","readAnalysisTuneEvidence(","<EngineeringSummaryCard","<PrimaryEngineeringResults","<EngineeringCorrelationSurface","<ContextualFindings","<NextChecks","<CylinderTimingPanel","Intelligent Warnings"])assert(source.includes(token),token);
  assert(source.indexOf('<EngineeringWorkspaceShell')<source.indexOf('Tune Profile V1'));
  assert(source.indexOf('Tune Profile V1')<source.indexOf('Tune-Aware Reasoning'));
  assert(source.indexOf('Tune-Aware Reasoning')<source.indexOf('Per-Cylinder Timing Corrections'));
});
