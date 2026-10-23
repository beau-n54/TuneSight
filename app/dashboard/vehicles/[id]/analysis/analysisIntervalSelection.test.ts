import test from "node:test";
import assert from "node:assert/strict";
import {parseAnalysisInterval,intervalMarkers} from "./analysisIntervalSelection.ts";
import {sliceTelemetryToPull} from "./telemetryWorkspacePresentation.ts";
test("interval links are exact bounded source rows, including one-sample intervals",()=>{
  assert.deepEqual(parseAnalysisInterval("#analysis-interval-1-3",4),{id:"interval:1:3",startIndex:1,endIndex:3});
  assert(parseAnalysisInterval("#analysis-interval-0-0",1));
  for(const hash of ["#analysis-interval--1-3","#analysis-interval-3-1","#analysis-interval-0-4","#analysis-interval-0-9999999999999999999","#other"])assert.equal(parseAnalysisInterval(hash,4),null);
});
test("linked slices preserve original time origin and gaps, clipping markers without mutating evidence",()=>{
  const interval={id:"selected",startIndex:1,endIndex:2},input={timestamps:[20,20.2,22.1,25],rpm:[1000,null,2000,3000]};
  const slice=sliceTelemetryToPull(input,interval) as Record<string,unknown>;assert.deepEqual(slice.timestamps,[20.2,22.1]);assert.equal(slice.sourceTimeOrigin,20);assert.deepEqual(slice.rpm,[null,2000]);
  const event={id:"original",startIndex:0,endIndex:3};assert.deepEqual(intervalMarkers([event],interval),[{id:"original",startIndex:1,endIndex:2}]);assert.equal(event.startIndex,0);assert.equal(input.rpm.length,4);
});
