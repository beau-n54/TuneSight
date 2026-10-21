import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import type {ReactNode} from "react";
import type {AnalysisCalibrationResolution} from "./analysisCalibrationContext";
import {analysisEvidenceSections} from "./analysisEvidenceSections.ts";
import {parseSourceMeasurements} from "./analysisCapabilities.ts";
import type {AnalysisSource} from "./analysisSource";

const require = createRequire(import.meta.url);
const ts = require("typescript"), React = require("react"), {renderToStaticMarkup} = require("react-dom/server");
const cache = new Map<string, {exports: unknown}>();
function load(file: string): unknown {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file)!.exports;
  const mod = {exports: {} as unknown}; cache.set(file, mod);
  const js = ts.transpileModule(fs.readFileSync(file,"utf8"), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function("require","module","exports",js)((id: string) => {
    if (id === "next/link") return function TestLink(props: object) {return React.createElement("a", props);};
    const base = id.startsWith("@/") ? path.resolve(id.slice(2)) : id.startsWith(".") ? path.resolve(path.dirname(file),id) : null;
    if (base) return load([base,base+".ts",base+".tsx"].find(f => fs.existsSync(f))!);
    return require(id);
  },mod,mod.exports);
  return mod.exports;
}
const components = load("app/dashboard/vehicles/[id]/analysis/EvidenceSections.tsx") as Record<string,(props: object)=>ReactNode>;
const render = (name: string, props: object): string => renderToStaticMarkup(React.createElement(components[name],props));
// Strip closed native disclosures, including nested disclosures, to inspect default content.
function defaultView(html: string) {
  let depth = 0, result = "", last = 0;
  for (const match of html.matchAll(/<details\b[^>]*>|<\/details>/g)) {
    if (!depth) result += html.slice(last,match.index);
    depth += match[0].startsWith("</") ? -1 : 1;
    last = match.index! + match[0].length;
  }
  return result + html.slice(last);
}
const source: AnalysisSource = {state:"available",digest:"fixture-source",finding:"Owned fixture",measurements:parseSourceMeasurements("Time,RPM,Boost Mean PSI,Boost target (PSI),WGDC 1 (%)\n0,2000,5,4,50\n1,3000,7,5,60")};
const relationship = {title:"Same exact table",occurrence:0,revision:"revision-private",key:"key-private",channel:"boost",meaning:"The observed channel and this exact Definition share the qualified Boost & Air Control system context. This does not establish direct control or causation.",assertion:"assertion:private",grade:"Suggested inspection target — qualified system membership",provenance:["provenance-private"],limitations:["limit-private"]};
const resolution: AnalysisCalibrationResolution = {identity:{software:"software",family:"family",bytes:1,container:"bin",digest:"digest-private",dataset:"dataset-private",definitionSet:"set-private",artifact:"artifact-private"},relationships:[relationship,{...relationship,channel:"boost_target"},{...relationship,occurrence:1,key:"key-other",grade:"Exact Definition telemetry relationship"}],reason:null,withheld:["Unbound reason retained"],href:null,resolutionPath:"fresh admission",sourceId:"owned-record"};

test("warning cards deduplicate exact strings across categories without merging distinct reasons", () => {
  const facts = {...analysisEvidenceSections(source),missing:["Throttle unavailable","Throttle unavailable"],units:["Throttle unavailable","Throttle unit unqualified"],blockers:["Throttle unavailable","Distinct source reason"]};
  const before = JSON.stringify(facts), html = render("SourceWarningSections",{facts,diagnostics:false});
  assert.equal((html.match(/Throttle unavailable/g) ?? []).length,1);
  assert(html.includes("Throttle unit unqualified")); assert(html.includes("Distinct source reason"));
  assert.match(html,/source extrema, not validated operating limits/);
  assert.equal(JSON.stringify(facts),before);
});

test("primary inventory has one exact occurrence, retaining every channel, original grade and technical item", () => {
  const before = JSON.stringify(resolution), html = render("CalibrationEvidenceSections",{resolution,source,logId:"log",vehicleId:"vehicle"});
  assert.equal((html.match(/data-primary-table=/g) ?? []).length,2);
  assert.equal((html.match(/Same exact table/g) ?? []).length,2);
  for (const r of resolution.relationships) for (const item of [r.channel,r.grade,r.assertion,...r.provenance,...r.limitations]) assert(html.includes(item),item);
  assert.match(html,/boost, boost_target/); assert.match(html,/Direct table relationship/);
  assert.match(html,/Related system to inspect — Boost &amp; Air Control/);
  assert.match(html,/Unbound reason retained/); assert.equal(JSON.stringify(resolution),before);
});

test("identifiers and provenance are closed technical evidence, not default subscriber text", () => {
  const html = render("CalibrationEvidenceSections",{resolution,source,logId:"log",vehicleId:"vehicle"}), visible = defaultView(html);
  for (const secret of ["assertion:private","provenance-private","revision-private","digest-private","dataset-private","limit-private"]) {
    assert(html.includes(secret)); assert(!visible.replace(/<[^>]*>/g,"").includes(secret),secret);
  }
  assert.match(html,/Advanced technical evidence/); assert.match(html,/Exact source identity and admission evidence/);
  assert.doesNotMatch(html,/<details[^>]* open=/); assert.match(html,/focus-visible:outline-sky-300/);
});

test("system labels follow admitted meaning and never guess from table names", () => {
  const r = {...resolution,relationships:[{...relationship,channel:"wgdc",meaning:relationship.meaning.replace("Boost & Air Control","Wastegate / WGDC")},{...relationship,key:"fuel",revision:"fuel",channel:"afr",meaning:relationship.meaning.replace("Boost & Air Control","Fueling / Lambda")}]};
  const html = render("CalibrationEvidenceSections",{resolution:r,source,logId:"log",vehicleId:"vehicle"});
  assert.match(html,/Related system to inspect — Wastegate \/ WGDC/); assert.match(html,/Related system to inspect — Fueling \/ Lambda/);
  assert.match(html,/Fuel pressure and fueling/); assert.match(html,/Boost and WGDC/);
});

test("unavailable source and unknown grades remain explicit without invented authority", () => {
  const r = {...resolution,relationships:[{...relationship,grade:"future grade"}],reason:"Exact unavailable reason"};
  const html = render("CalibrationEvidenceSections",{resolution:r,source:null,logId:null,vehicleId:"vehicle"});
  assert.match(html,/Evidence unavailable/); assert.match(html,/future grade/); assert.match(html,/Exact unavailable reason/);
  assert.match(html,/No owned source selected/);
});

test("detailed sections occupy the full workspace row and selected navigation has target/focus treatment", () => {
  const {EngineeringWorkspaceShell} = load("components/EngineeringWorkspaceShell.tsx") as {EngineeringWorkspaceShell:(props: object)=>ReactNode};
  const html:string = renderToStaticMarkup(React.createElement(EngineeringWorkspaceShell,{investigation:"Detailed investigation",calibrationContext:"Detailed calibration"}));
  for (const id of ["engineering-investigation","calibration-context"]) assert.match(html,new RegExp(`<section[^>]*xl:col-span-12[^>]*id="${id}"`));
  assert.doesNotMatch(html,/xl:col-span-6/); assert.match(html,/group-has-\[\#calibration-context:target\]/);
  assert.match(html,/focus-visible:outline-blue-400/); assert.match(html,/overflow-x-auto/);
});
