import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { filterWorkshopDefinitions, type WorkshopDefinitionSummary } from "./viewModel.ts";
import { bindDefinitionKnowledge } from "./definitionKnowledgeBinding.ts";

const source = fs.readFileSync("app/dashboard/vehicles/[id]/calibration/workshop-client.tsx", "utf8");
const bindingSource = fs.readFileSync("lib/calibration-workshop/definitionKnowledgeBinding.ts", "utf8");

test("Workshop-owned terminology uses Tables while authoritative Map titles remain untouched",()=>{assert.match(source,/All Tables/);assert.match(source,/Changed Tables/);assert.match(source,/Search Tables/);assert.match(source,/Table Information/);assert.match(source,/Related Table/);assert.doesNotMatch(source,/>All Maps</);const identity={key:"instance",occurrence:0,definitionIdentity:"definition",definitionRevision:"revision",title:"Timing Spool (Map 3)",description:null,shape:"2D" as const,units:"deg",outcome:"unchanged" as const,changedCellCount:0,available:true};const definition:WorkshopDefinitionSummary={...identity,semantic:bindDefinitionKnowledge(identity,[])};assert.equal(filterWorkshopDefinitions([definition],"Map 3","all")[0]?.title,"Timing Spool (Map 3)")});
test("beginner and engineering detail layers consume governed semantic fields",()=>{for(const token of ["Understand","Engineering Detail","What this Table does","Why it matters","How to read it","When it is used","Telemetry to inspect","Important consideration"])assert.match(source,new RegExp(token));assert.match(source,/semantic\.controls\.map/);assert.match(source,/semantic\.provenance\.map/)});
test("unavailable Tables retain explicit absence without generated education",()=>{assert.match(source,/semantic\.unavailableReason/);assert.match(bindingSource,/Engineering interpretation not yet available/);assert.doesNotMatch(source+bindingSource,/safe range|ideal value|recommended value/i)});
