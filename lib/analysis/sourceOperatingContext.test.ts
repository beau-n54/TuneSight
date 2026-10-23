import test from "node:test";
import assert from "node:assert/strict";
import {parseSourceMeasurements} from "./analysisCapabilities.ts";
import {sourceInvestigation} from "./sourceInvestigation.ts";
import {eventOperatingContext} from "./sourceOperatingContext.ts";
import {analysisChannelStatus} from "./analysisChannelStatus.ts";
import type {AnalysisSource} from "./analysisSource";

const source=(rows:string,extra=""):AnalysisSource=>({state:"available",digest:"synthetic-not-subscriber",finding:"Synthetic fixture",measurements:parseSourceMeasurements(`Time,RPM,Boost Mean PSI,Accel. Pedal[%],Gear (-),Cyl1 Timing Cor (*),Cyl2 Timing Cor (*)${extra}\n${rows}`)});
test("one irregularly sampled parent run retains third/fourth segments and the sampled transition boundary",()=>{
  const input=source("10,2000,2,100,3,0,0\n10.2,3000,3,100,3,-2,-2\n12.3,2500,4,100,4,-2,-2\n14,4000,4,100,4,0,0");
  const before=JSON.stringify(input),result=sourceInvestigation(input),run=result.operatingContext.runs[0];
  assert.equal(result.operatingContext.runs.length,1);assert.equal(run.acceleration,true);
  assert.deepEqual(run.segments.map(s=>[s.gear,s.startRow,s.endRow]),[[3,0,1],[4,2,3]]);
  assert.deepEqual(run.transitions.map(t=>[t.from,t.to,t.startRow,t.endRow]),[[3,4,1,2]]);
  const timing=result.observations.checks.find(c=>c.id==="timing-correction")!;
  assert.equal(timing.events.length,1);assert.equal(timing.events[0].value,2);
  assert.equal(result.observations.checks.find(c=>c.id==="cylinder-spread")!.events.length,0);
  assert.equal(timing.events[0].simultaneousCylinders,2);
  assert(timing.events[0].timing!.every(t=>t.minimum===-2&&t.maximum===-2&&t.recovered&&t.onsetKnown));
  assert.match(eventOperatingContext(timing.events[0],result.operatingContext).state,/gear transition/);
  assert.equal(JSON.stringify(input),before);
});
test("gaps and invalid gears never infer a shift from RPM; short intervals are not acceleration",()=>{
  const result=sourceInvestigation(source("0,2000,1,100,3,0,0\n1,1994,1,100,,0,0\n2,2500,1,100,4,0,0\n3,,1,100,0,0,0\n4,3000,1,100,4.5,0,0"));
  assert.equal(result.operatingContext.transitions.length,0);
  assert.deepEqual(result.operatingContext.runs[0].segments.map(s=>s.gear),[3,null,4]);
  assert.equal(result.operatingContext.runs[1].acceleration,false);
  assert.equal(result.operatingContext.runs[1].segments[0].gear,null);
});
test("released pedal, isolated correction recovery and recurrence stay separate from acceleration",()=>{
  const result=sourceInvestigation(source("0,1000,1,0,3,0,0\n0.3,1200,1,0,3,-1,0\n1.4,1500,1,0,3,0,0\n2,2000,1,100,3,-2,-3\n4.5,3000,1,100,3,0,0"));
  const events=result.observations.checks.find(c=>c.id==="timing-correction")!.events;
  assert.equal(events.length,2);assert.equal(events[0].simultaneousCylinders,1);assert.equal(events[1].simultaneousCylinders,2);
  assert.match(eventOperatingContext(events[0],result.operatingContext).state,/zero pedal/);
  assert.equal(eventOperatingContext(events[1],result.operatingContext).accelerationOnly,true);
  assert(events.every(e=>e.timing!.every(t=>t.recovered)));
  assert.equal(new Set(result.candidates.map(c=>c.event.id)).size,result.observations.events.length);
});
test("source columns distinguish unverified labels, invalid samples, absent and qualified observations",()=>{
  const input=source("0,1000,1,0,3,0,0,90,broken,12",",Throttle Position (*),Load act. (%),Throttle Position (°)");
  const status=analysisChannelStatus(input,{identity:null,reason:"synthetic",relationships:[],withheld:[],href:null,resolutionPath:null,sourceId:null});
  const state=(h:string)=>status.columns.find(c=>c.header===h)?.state;
  assert.equal(state("Throttle Position (*)"),"present_but_mapping_or_units_unverified");
  assert.equal(state("Load act. (%)"),"present_but_samples_invalid_or_unusable");
  assert.equal(state("Throttle Position (°)"),"available_for_analysis");
  assert.equal(state("Time"),"available_for_analysis");
  assert(!input.measurements!.channels.some(c=>c.key==="throttle"));
  const noUnknown=source("0,1000,1,0,3,0,0");
  assert.equal(analysisChannelStatus(noUnknown,{identity:null,reason:"synthetic",relationships:[],withheld:[],href:null,resolutionPath:null,sourceId:null}).channels.find(c=>c.key==="iat")?.raw,"absent");
});
test("explicit manifold gauge channels never replace generic boost, angle never replaces percentage",()=>{
  const input=source("0,1000,1,100,3,0,0,8,10,5,90,4",",(RAM) Boost (MAP)[psig],(RAM) Boost Pressure (Manifold Target)[psig],Boost (mani) (PSI),Throttle Position (°),Ignition Timing Cyl. 1 (°)");
  const get=(key:string)=>input.measurements!.channels.find(c=>c.key===key);
  assert.deepEqual(get("boost")?.values,[1]);assert.deepEqual(get("manifold_gauge_pressure")?.values,[8]);
  assert.deepEqual(get("ignition_timing_cyl_1")?.values,[4]);assert.deepEqual(get("timing_correction_cyl_1")?.values,[0]);
  assert(!get("throttle"));assert(!get("boost_target"));
  const event=sourceInvestigation(input).observations.events.find(e=>e.kind==="manifold-below-target");assert.equal(event?.value,2);
});
test("empty or historical source without optional channels remains usable without invented segments",()=>{
  assert.equal(sourceInvestigation(null).operatingContext.runs.length,0);
  const input=source("0,1000,1,100,,0,0");delete input.measurements!.headerEvidence;
  assert.match(sourceInvestigation(input).operatingContext.gearState,/Gear segmentation unavailable/);
});
test("known signed correction survives another cylinder gap without claiming that cylinder recovered",()=>{
  const input=source("0,1000,1,0,3,0,0\n1,1500,1,0,3,-2,\n2,1800,1,0,3,,\n3,2000,1,0,3,-1,0");
  const events=sourceInvestigation(input).observations.checks.find(c=>c.id==="timing-correction")!.events;
  assert.equal(events.length,2);assert.equal(events[0].value,2);
  assert.equal(events[0].timing![0].recovered,false);assert.equal(events[1].timing![0].onsetKnown,false);
});
