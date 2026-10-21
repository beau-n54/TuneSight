import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {parseSourceMeasurements} from "./analysisCapabilities.ts";
import {sourceInvestigation} from "./sourceInvestigation.ts";
import {sourceEvidenceScoring} from "./sourceEvidenceScoring.ts";
import {sourceInspectionCrossReferences} from "./sourceInspectionCrossReferences.ts";
import type {AnalysisSource} from "./analysisSource";
import type {AnalysisCalibrationResolution} from "./analysisCalibrationContext";

const source = (): AnalysisSource => ({state:"available",digest:"fixture",finding:"fixture",measurements:parseSourceMeasurements(
  "Time,RPM,Boost Mean PSI,Boost target (PSI),Accel. Pedal[%],WGDC Bank 1 (%),Rail pressure (PSI),IAT (*C),Cyl1 Timing Cor (*),Cyl2 Timing Cor (*)\n0,2000,5,4,100,50,3000,40,0,0\n1,3000,7,5,100,60,2800,41,-1,-3\n3,4000,3,5,100,70,2900,42,-2,-3")});
const score = (s = source()) => sourceEvidenceScoring(s,sourceInvestigation(s));
const relationship = (channel = "boost", revision = "exact-boost", grade = "Suggested inspection target — qualified system membership") => ({title:"Admitted title",occurrence:0,revision,key:revision,channel,meaning:"Qualified control system",assertion:"Inspection only",grade,provenance:["admitted fixture"],limitations:["Not a causal conclusion"]});
const calibration = (): AnalysisCalibrationResolution => ({reason:null,identity:{software:"exact",family:"fixture",bytes:10,container:"BIN",digest:"source",dataset:"dataset",definitionSet:"set",artifact:"artifact"},relationships:[relationship(),relationship("boost_target"),relationship("timing_correction_cyl_1","timing")],withheld:[],href:null,resolutionPath:"fresh admission",sourceId:null});
const model = (s = source(), c = calibration()) => sourceInspectionCrossReferences(score(s),c,s.measurements!.channels.map(c=>c.key));

test("transparent deterministic additive scores, ordering and gap to leader",()=>{
  const input=source(), before=JSON.stringify(input), scores=score(input);
  assert.deepEqual(scores,score(input)); assert.equal(JSON.stringify(input),before);
  for(const [i,s] of scores.entries()){
    assert.equal(s.rank,i+1); assert(s.score>=0&&s.score<=95);
    assert.equal(s.score,Math.round(Math.max(0,Math.min(95,s.factors.reduce((a,f)=>a+f.points,0)))*100)/100);
    assert(s.factors.every(f=>f.label&&f.explanation));
    if(i) assert(scores[i-1].score>=s.score);
  }
  assert(scores.find(s=>s.kind==="actual-above-target")!.factors.some(f=>f.label==="Opposing boost direction"&&f.points<0));
});
test("missing context reduces points without pretending stable observations",()=>{
  const input=source(), normal=score(input).find(s=>s.kind==="actual-above-target")!;
  input.measurements!.channels=input.measurements!.channels.filter(c=>c.key!=="rpm"&&c.key!=="accelerator_pedal");
  const missing=score(input).find(s=>s.kind===normal.kind)!;
  assert.equal(normal.score-missing.score,10);
  assert.equal(missing.factors.find(f=>f.label==="Missing operating context")!.points,-10);
});
test("missing source produces no scores; missing time earns no duration points",()=>{
  assert.deepEqual(sourceEvidenceScoring(null,sourceInvestigation(null)),[]);
  const input=source(); input.measurements!.timestamps=null;
  assert(score(input).every(s=>s.factors.find(f=>f.label==="Observed duration")!.points===0));
});
test("admitted relationships only; partial missing bindings preserve other families",()=>{
  const result=model(); assert.equal(result.mapCount,2);
  assert(result.families.find(f=>f.kind==="rail_pressure")!.unavailable);
  assert(result.families.find(f=>f.kind==="iat")!.unavailable);
  assert.equal(result.families.find(f=>f.kind==="actual-above-target")!.unavailable,null);
  const c=calibration(); c.relationships=[{...relationship("unrecognised"),title:"Boost Target RPM IAT Rail Pressure"}];
  assert.equal(model(source(),c).mapCount,0);
});
test("one table for repeated intervals, both boost directions and duplicate occurrences",()=>{
  const c=calibration(); c.relationships.push({...relationship(),key:"second-occurrence",occurrence:1});
  const result=model(source(),c); assert.equal(result.mapCount,2);
  assert.equal(result.tables.filter(t=>t.revision==="exact-boost").length,1);
  assert.equal(result.tables.find(t=>t.revision==="exact-boost")!.families.length,2);
});
test("lower source-described grades are retained verbatim and give no scoring bonus",()=>{
  const c=calibration(), grade="Suggested inspection target — admitted source description, not independently validated semantics";
  c.relationships=[relationship("boost","supplied",grade)];
  const result=model(source(),c); assert.equal(result.tables[0].families[0].relationships[0].grade,grade);
  assert.deepEqual(result.families.map(f=>f.score),score().map(f=>f.score));
});
test("missing identity fails closed even with stray relationship inventory",()=>{
  const c=calibration(); c.identity=null; const result=model(source(),c);
  assert.equal(result.mapCount,0); assert(result.families.length); assert(result.families.every(f=>f.unavailable));
});
test("admitted telemetry-only tables do not invent an event binding or score",()=>{
  const input=source(); input.measurements!.channels=input.measurements!.channels.filter(c=>c.key!=="boost_target");
  const c=calibration(); c.relationships=[relationship("boost","description-only","source-described inspection")];
  const result=model(input,c); assert.equal(result.mapCount,1);
  assert.equal(result.tables[0].families.length,0);
  assert(result.families.every(f=>f.unavailable));
});
test("boost control context uses observed WGDC and its admitted relationship, never table titles",()=>{
  const input=source(); assert(input.measurements!.channels.some(c=>c.key==="wgdc"));
  const c=calibration(); c.relationships=[relationship("wgdc","wastegate")];
  const result=model(input,c);
  assert(result.families.find(f=>f.kind==="actual-above-target")!.relationships.length);
  assert(result.families.find(f=>f.kind==="rail_pressure")!.unavailable);
  input.measurements!.channels=input.measurements!.channels.filter(c=>c.key!=="wgdc");
  assert.equal(model(input,c).mapCount,0);
});
test("large source score projection remains bounded and does not build interval-by-table panels",()=>{
  const input=source(), count=20000, m=input.measurements!;
  m.sampleCount=count; m.timestamps=Array.from({length:count},(_,i)=>i/10);
  for(const c of m.channels) c.values=Array.from({length:count},(_,i)=>c.values[i%3]);
  const start=performance.now(), result=model(input);
  assert(performance.now()-start<5000,"20,000 rows must not cause quadratic scoring work");
  assert(result.families.length<=7); assert.equal(result.mapCount,2);
  assert(result.families.reduce((a,f)=>a+f.events.length,0)>10000);
});
const census=JSON.parse(fs.readFileSync(new URL("../../engineering/calibration/bmw-master-99-xdf-census.json",import.meta.url),"utf8")) as {rows:{family:string}[]};
for(const family of [...new Set(census.rows.map(r=>r.family)),"N20 binary-only","future platform"])test(`${family}: neutral scoring survives absent XDF without platform rule leakage`,()=>{
  const c=calibration(); c.identity=null; c.relationships=[];
  const result=model(source(),c); assert(result.families.length); assert.equal(result.mapCount,0);
  assert.doesNotMatch(JSON.stringify(result),/N54|knock detected|failure probability/);
  assert(result.families.every(f=>f.score>=0&&f.factors.length===8));
});
