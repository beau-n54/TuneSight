import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import type {TuneByteEvidence} from "./analysisTuneEvidence";
const require = createRequire(import.meta.url), ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(new URL("./analysisTuneEvidence.server.ts",import.meta.url),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(mode = "same") {
  const filters: string[][] = [], downloads: string[] = [];
  const db = {from: () => {
    let id = "";
    const q = {select:()=>q, eq:(k:string,v:string)=>{filters.push([k,v]); if(k==="id")id=v; return q;}, maybeSingle:async()=>({data:{id,file_name:"MHD Stage2.bin",storage_path:mode==="foreign"?"other/vehicle/source":`owner/vehicle/${id}`,is_stock_reference: id === "ref" && mode!=="not-stock",reference_tune_id:id==="src"?"ref":null}})};
    return q;
  },storage:{from:()=>({info:async()=>({data:{size:mode==="oversize"?101:mode==="missing-size"?undefined:3}}),download:async(p:string)=>{downloads.push(p);return {data:new Blob([new Uint8Array(mode==="different"&&p.endsWith("ref")?[3,2,1]:[1,2,3])])};}})}};
  const m={exports:{} as {readAnalysisTuneEvidence:(owner:string,vehicle:string,id:string|null)=>Promise<TuneByteEvidence|null>}};
  new Function("require","module","exports",code)((id:string)=>{
    if(id==="server-only")return {};
    if(id.includes("trustedServer"))return {createTrustedServerClient:()=>db};
    if(id.includes("uploadPolicy"))return {ownedStoragePath:(p:string,o:string,v:string)=>p.startsWith(`${o}/${v}/`),TUNE_MAX_BYTES:100};
    return require(id);
  },m,m.exports);
  return {read:()=>m.exports.readAnalysisTuneEvidence("owner","vehicle","src"),filters,downloads};
}
test("fresh byte equality uses exact owned source and explicit owned stock reference, with read-only capabilities", async()=>{
  const h=harness(),r=await h.read(); assert(r?.matchesOwnedStockReference);
  assert.equal(r?.digest,r?.referenceDigest); assert.equal(r?.byteLength,3);
  assert.deepEqual(h.filters,[["id","src"],["user_id","owner"],["vehicle_id","vehicle"],["id","ref"],["user_id","owner"],["vehicle_id","vehicle"]]);
  assert.equal(h.downloads.length,2);
});
for(const mode of ["different","not-stock"])test(`${mode}: filename cannot establish stock or active tune`,async()=>{
  assert.equal((await harness(mode).read())?.matchesOwnedStockReference,false);
});
for(const mode of ["foreign","oversize","missing-size"])test(`${mode}: invalid evidence fails closed before download`,async()=>{
  const h=harness(mode);assert.equal(await h.read(),null);assert.equal(h.downloads.length,0);
});
