import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {analysisChannelStatus} from "./analysisChannelStatus.ts";
import {sourceInvestigation} from "./sourceInvestigation.ts";
import {eventOperatingContext} from "./sourceOperatingContext.ts";
import {resolveTrustedServerConfiguration} from "../supabase/trustedServerConfiguration.ts";
import {readOwnedAnalysisSource} from "./analysisSource.ts";

const require=createRequire(import.meta.url);
const React=require("react"),ts=require("typescript"),{renderToStaticMarkup}=require("react-dom/server");
function component(file:string) {
  const mod={exports:{} as Record<string,unknown>};
  new Function("require","module","exports",ts.transpileModule(readFileSync(`app/dashboard/vehicles/[id]/analysis/${file}.tsx`,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(
    (id:string)=>id.includes("analysisChannelStatus")?{analysisChannelStatus}:id.includes("sourceOperatingContext")?{eventOperatingContext}:id.startsWith("./")?{}:id==="next/link"?{default:({prefetch,...props}:{prefetch?:boolean})=>{void prefetch;return React.createElement("a",props);}}:require(id),mod,mod.exports);
  return mod.exports;
}
const {RunOverview}=component("RunFindings"),{default:SourceMeasurements}=component("SourceMeasurements");
const log={id:"log",user_id:"owner",vehicle_id:"vehicle",raw_source_storage_path:"owner/vehicle/log.csv",created_at:"2026-10-20",log_name:"Owned log"};

test("missing trusted configuration fails before download without exposing a credential or changing ownership",async()=>{
  let requests=0;
  const source=await readOwnedAnalysisSource(log,"owner","vehicle","https://project.invalid",async()=>{
    assert.throws(()=>resolveTrustedServerConfiguration({NEXT_PUBLIC_SUPABASE_URL:"https://project.invalid"}),/Trusted Supabase server configuration is unavailable/);
    resolveTrustedServerConfiguration({NEXT_PUBLIC_SUPABASE_URL:"https://project.invalid"});
    requests++;return {data:null,error:null};
  });
  assert.equal(requests,0);assert.equal(source.state,"temporarily_unavailable");assert.equal(source.measurements,null);
  assert.doesNotMatch(JSON.stringify(source),/SUPABASE_SERVICE_ROLE_KEY|secret|eyJ/);
});
for(const state of ["temporarily_unavailable","missing","unresolved"] as const)test(`${state}: one failure and retry, no invented counts or logger-header advice`,()=>{
  const source={state,digest:null,measurements:null,finding:"Original source retrieval failed."};
  const html=renderToStaticMarkup(React.createElement(SourceMeasurements,{vehicleId:"vehicle",logs:[log],selected:log,source,diagnostics:false,priorResultId:"preserved"}))+
    renderToStaticMarkup(React.createElement(RunOverview,{source,investigation:sourceInvestigation(source),logName:"Owned log",vehicleName:"Vehicle",declarations:[]}));
  assert.equal(html.split(source.finding).length-1,1);assert.equal(html.split("Retry source access").length-1,1);
  assert.match(html,/Sample counts, run intervals and channel availability are unknown/);
  assert.match(html,/Open complete owned-log history/);assert.match(html,/preserved/);
  assert.doesNotMatch(html,/0 source samples|0 measured|provide a logger export|Present in source; interpretation unavailable|conclusions are not yet qualified/);
});
test("route gates live measurement surfaces and duplicate status while retaining stored audit",()=>{
  const route=readFileSync("app/dashboard/vehicles/[id]/analysis/page.tsx","utf8");
  assert.match(route,/source\?\.measurements \? <EngineeringWorkspaceShell/);
  assert.match(route,/source\?\.measurements && <p role="status"/);
  assert.match(route,/Advanced profile, diagnostic and scoring audit/);
  assert.match(route,/Source inspection unavailable/);
});
