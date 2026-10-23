import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import type {ReactNode} from "react";
import type {SourceInspectionCrossReferences} from "./sourceInspectionCrossReferences";
import {sourceEvidenceScoring} from "./sourceEvidenceScoring.ts";
import {sourceInvestigation} from "./sourceInvestigation.ts";
import {sourceInspectionCrossReferences} from "./sourceInspectionCrossReferences.ts";
import {parseSourceMeasurements} from "./analysisCapabilities.ts";
import type {AnalysisSource} from "./analysisSource";

const require = createRequire(import.meta.url);
const ts = require("typescript"), React = require("react"), {renderToStaticMarkup} = require("react-dom/server");
const file = "app/dashboard/vehicles/[id]/analysis/SourceInspectionDetails.tsx";
const compiled = ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const mod = {exports:{}};
const helper = {exports:{}};
new Function("require","module","exports",ts.transpileModule(fs.readFileSync("app/dashboard/vehicles/[id]/analysis/relationshipPresentation.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(require,helper,helper.exports);
const copy = {exports:{}};
new Function("require","module","exports",ts.transpileModule(fs.readFileSync("app/dashboard/vehicles/[id]/analysis/CopyEvidence.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(require,copy,copy.exports);
new Function("require","module","exports",compiled)((id: string) => id === "./relationshipPresentation" ? helper.exports : id === "./CopyEvidence" ? copy.exports : require(id),mod,mod.exports);
const {EvidencePoints,EvidenceDisclosure,SourceInspectionDetails} = mod.exports as {
  EvidencePoints:(props:{points:number})=>ReactNode;
  EvidenceDisclosure:(props:{title:string;children:ReactNode;open?:boolean})=>ReactNode;
  SourceInspectionDetails:(props:{model:SourceInspectionCrossReferences})=>ReactNode;
};
const render = (node:ReactNode):string => renderToStaticMarkup(node);

for(const [value,tone,color,text] of [[12.5,"positive","text-emerald-300","+12.50"],[-4,"deduction","text-amber-300","-4.00"],[0,"zero","text-zinc-400","+0.00"]] as const)test(`${tone} points have distinct non-severity presentation and unchanged numeric text`,()=>{
  const html=render(React.createElement(EvidencePoints,{points:value}));
  assert(html.includes(`data-score-tone="${tone}"`)); assert(html.includes(color)); assert(html.includes(text));
  assert.doesNotMatch(html,/severity|critical|danger|probability/);
});
test("native disclosure exposes collapsed/open states, keyboard focus and decorative stateful chevron",()=>{
  const closed=render(React.createElement(EvidenceDisclosure,{title:"Evidence"},"Details"));
  const opened=render(React.createElement(EvidenceDisclosure,{title:"Evidence",open:true},"Details"));
  assert.match(closed,/<details[^>]*><summary/); assert.doesNotMatch(closed,/<details[^>]* open="/);
  assert.match(opened,/<details open=""/);
  for(const html of [closed,opened]){
    assert.match(html,/focus-visible:outline-sky-300/); assert.match(html,/hover:bg-blue-900/);
    assert.match(html,/group-open\/evidence:rotate-180/); assert.match(html,/open:border-sky-500/);
    assert.match(html,/<svg aria-hidden="true" focusable="false"/);
    assert.match(html,/min-h-11/); assert.match(html,/motion-reduce:transition-none/);
    assert.doesNotMatch(html,/aria-expanded|role="button"|tabindex="-1"/); // native summary owns dynamic accessibility state
  }
});
for(const platform of ["N54","B58","Supra"])test(`${platform}: shared cards retain all score, table and grade content without platform wording`,()=>{
  const source:AnalysisSource={state:"available",digest:"fixture",finding:"fixture",measurements:parseSourceMeasurements("Time,RPM,Boost Mean PSI,Boost target (PSI),Accel. Pedal[%]\n0,2000,5,4,100\n1,3000,7,5,100\n2,4000,3,5,100")};
  const scores=sourceEvidenceScoring(source,sourceInvestigation(source));
  const model=sourceInspectionCrossReferences(scores,{reason:null,identity:{software:"fixture",family:"fixture",bytes:1,container:"bin",digest:"fixture",dataset:"d",definitionSet:"s",artifact:"a"},relationships:[{title:"Exact admitted table",occurrence:0,revision:"exact",key:"exact",channel:"boost",meaning:"Inspection relationship",assertion:"Not diagnostic",grade:"Suggested inspection target — admitted source description",provenance:["Fixture"],limitations:["No causal conclusion"]}],withheld:[],href:null,resolutionPath:"fixture",sourceId:null},["boost","boost_target"]);
  const before=JSON.stringify(model),html=render(React.createElement(SourceInspectionDetails,{model}));
  assert.equal(JSON.stringify(model),before); assert.equal((html.match(/data-inspection-table=/g)||[]).length,1);
  assert.match(html,/1 distinct admitted tables/); assert.match(html,/Exact admitted table/);
  assert.match(html,/Suggested inspection target — admitted source description/);
  assert.match(html,/data-evidence-total="true" class="[^"]*text-cyan-200/);
  assert.match(html,/data-evidence-rank="true" class="[^"]*text-blue-200/);
  for(const s of scores){assert(html.includes(`${Math.round(s.score)} / 95 points (rounded)`)); assert(html.includes(`#${s.rank}`));}
  assert.match(html,/bmw-border/); assert.match(html,/flex-wrap/); assert.match(html,/min-w-0/);
  assert.doesNotMatch(html,/N54|B58|Supra/);
});
