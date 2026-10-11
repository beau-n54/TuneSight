import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as nodeModule from "node:module";
import test from "node:test";

// Node 24 hooks load the actual server implementations with controlled service
// boundaries. No subscriber data, network requests or production credentials.
const globals = globalThis as unknown as Record<string, unknown>;
const mockSource = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
type Context = { parentURL?: string };
type Resolution = { url: string };
const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: {
  resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolution): Resolution;
}): unknown };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return next(mockSource("export {};"), context);
  if (specifier === "@supabase/ssr") return next(mockSource("export function createServerClient(...args){return globalThis.__securitySsrFactory(...args)}"), context);
  if (specifier === "next/server") return next("next/server.js", context);
  if (specifier === "next/navigation") return next(mockSource("export function redirect(path){throw new Error('REDIRECT:'+path)}"), context);
  if (specifier === "next/headers") return next(mockSource("export async function headers(){return globalThis.__securityHeaders}"), context);
  const local = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : specifier.startsWith(".") && context.parentURL?.startsWith("file:") ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
  if (local) {
    const normalized = local.replaceAll("\\", "/").replace(/\.ts$/, "");
    if (normalized.endsWith("/lib/supabase/server")) return next(mockSource("export async function createClient(){return globalThis.__securityClient}"), context);
    if (normalized.endsWith("/lib/supabase/trustedServer")) return next(mockSource("export function createTrustedServerClient(){return globalThis.__securityStorage}"), context);
    if (normalized.endsWith("/lib/supabase/trustedServerConfiguration")) return next(mockSource("export function resolveTrustedServerConfiguration(){return {serviceRoleKey:'synthetic-test-only-secret',url:'https://test.invalid'}}"), context);
    if (context.parentURL?.replaceAll("\\", "/").endsWith("/app/api/vehicles/update-tune/route.ts")) {
      const processingExports: Record<string, string[]> = {
        tuneProfile: ["buildTuneProfile"], parseBinaryTune: ["parseEngineeringBinary"], detectBinaryDifferences: ["detectBinaryDifferences"],
        romFingerprint: ["fingerprintRom"], buildRunTimeRomLibrary: ["buildRuntimeRomLibrary"], libraryCache: ["getLibrary", "hasLibrary", "lookupRuntimeStockVariantKnowledge"],
        vehicleIdentityKnowledgeInterpretation: ["interpretRuntimeStockVariantKnowledge"], calculateBinaryHash: ["calculateBinaryHash"],
        comparisonReferenceQualification: ["qualifyComparisonReference"], binaryContainer: ["resolveBinaryContainer"],
      };
      const names = processingExports[normalized.split("/").at(-1)!];
      if (names) return next(mockSource(names.map(name => `export function ${name}(){throw new Error('Completed retry unexpectedly reprocessed evidence')}`).join("\n")), context);
    }
    if (!/\.(?:m?js|tsx?)$/.test(local)) {
      const match = [local + ".ts", path.join(local,"index.ts")].find(file => fs.existsSync(file));
      if (match) return next(pathToFileURL(match).href, context);
    }
  }
  return next(specifier, context);
} });
const { protectSubscriberRequest, subscriberAccess, requireSubscriberAction } = await import("./subscriberAccess.server.ts");
const { boundedRequest } = await import("./requestBounds.ts");
const { readLatestDurableSubscriberWorkshopSession } = await import("../calibration-workshop/subscriberCalibrationStorage.ts");
const { encodeSubscriberSession, inspectSubscriberSession } = await import("../calibration-workshop/subscriberCalibrationPersistence.ts");
const approved = { legal_accepted: true, beta_access: true, beta_status: "approved", beta_expires_at: null, role: "user" };
function client(user: { id: string } | null, profile: object | null = approved, error: object | null = null) {
  return { auth: { getUser: async () => ({ data: { user }, error }) }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: null }) }) }) }) };
}
const request = (body = "{}", origin = "https://site.invalid") => new Request("https://site.invalid/api/test", { method:"POST", headers: { origin }, body });
test("actual server route guard denies unauthenticated/suspended/expired callers before its handler or body parsing", async () => {
  let invoked = 0;
  const guarded = protectSubscriberRequest(async () => { invoked++; return Response.json({ok:true}); }, 8);
  for (const [candidate,status] of [[client(null),401],[client({id:"alice"},{...approved,beta_status:"suspended"}),403],[client({id:"alice"},{...approved,beta_expires_at:"2000-01-01"}),403]] as const) {
    globals.__securityClient = candidate;
    const body = request("x".repeat(100)); const result = await guarded(body);
    assert.equal(result.status,status);assert.equal(body.bodyUsed,false);assert.equal(invoked,0);
  }
});
test("actual guard enforces Origin and byte caps, marks success no-store and conceals internal errors", async () => {
  globals.__securityClient=client({id:"alice"});let invoked=0;
  const guarded=protectSubscriberRequest(async()=>{invoked++;return Response.json({ok:true});},8);
  assert.equal((await guarded(request("{}","https://evil.invalid"))).status,403);
  assert.equal((await guarded(request("123456789"))).status,413);assert.equal(invoked,0);
  const ok=await guarded(request());assert.equal(ok.status,200);assert.equal(ok.headers.get("Cache-Control"),"no-store");
  const failed=await protectSubscriberRequest(async()=>{throw new Error("PRIVATE_SECRET_INTERNAL_PATH");},8)(request());
  assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/PRIVATE_SECRET_INTERNAL_PATH/);
});
test("network failure never grants access and Server Actions require same-origin headers", async()=>{
  globals.__securityClient={auth:{getUser:async()=>{throw new Error("controlled offline")}}};
  assert.equal((await protectSubscriberRequest(async()=>assert.fail(),8)(request())).status,503);
  globals.__securityClient=client({id:"alice"});
  globals.__securityHeaders=new Headers({origin:"https://evil.invalid",host:"site.invalid"});
  await assert.rejects(requireSubscriberAction(),/Same-origin/);
  globals.__securityHeaders=new Headers({origin:"https://site.invalid",host:"site.invalid"});
  assert.equal((await requireSubscriberAction()).user.id,"alice");
  assert.equal((await subscriberAccess(globals.__securityClient as Parameters<typeof subscriberAccess>[0])).allowed,true);
});
test("stalled chunked request times out without treating cancelled partial input as complete", async()=>{
  let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array([1]));},cancel(){cancelled=true;}});
  const req=new Request("https://site.invalid",{method:"POST",body:stream,duplex:"half"} as RequestInit);
  await assert.rejects(boundedRequest(req,100,15),/timed out/);assert.equal(cancelled,true);
});

test("actual middleware refresh propagates cookies to server request and response; expired session preserves safe return path",async()=>{
  const {middleware}=await import("../../middleware.ts");
  const {NextRequest}=await import("next/server");
  globals.__securitySsrFactory=(_url:string,_key:string,options:{cookies:{setAll:(cookies:{name:string;value:string;options:object}[])=>void}})=>{
    options.cookies.setAll([{name:"sb-synthetic-auth",value:"refreshed-fixture",options:{httpOnly:true,path:"/",sameSite:"lax"}}]);return client({id:"alice"});
  };
  const req=new NextRequest("https://site.invalid/dashboard/vehicles/fixture/calibration");
  const response=await middleware(req);
  assert.equal(req.cookies.get("sb-synthetic-auth")?.value,"refreshed-fixture");
  assert.match(response.headers.get("set-cookie")??"",/refreshed-fixture/);assert.equal(response.status,200);
  globals.__securitySsrFactory=()=>client(null);
  const expired=await middleware(new NextRequest("https://site.invalid/account/login-details"));
  const destination=new URL(expired.headers.get("location")!);assert.equal(destination.pathname,"/login");assert.equal(destination.searchParams.get("next"),"/account/login-details");
  globals.__securitySsrFactory=()=>client(null,approved,{status:503});
  assert.equal((await middleware(new NextRequest("https://site.invalid/garage"))).status,503);
});

test("actual callback and confirmation retain recovery navigation, bound network access and reject external redirects",async()=>{
  const {GET:callback}=await import("../../app/auth/callback/route.ts"),{GET:confirm}=await import("../../app/auth/confirm/route.ts");
  const {NextRequest}=await import("next/server");let fail=false,calls=0;
  globals.__securitySsrFactory=(_url:string,_key:string,options:{global:{fetch:unknown}})=>{
    assert.equal(typeof options.global.fetch,"function");
    const action=async()=>{calls++;if(fail)throw new Error("PRIVATE_FAILURE");return {error:null};};
    return {auth:{exchangeCodeForSession:action,verifyOtp:action}};
  };
  const recovery=await callback(new NextRequest("https://site.invalid/auth/callback?code=fixture&next=/reset-password"));
  assert.equal(new URL(recovery.headers.get("location")!).pathname,"/reset-password");
  const external=await confirm(new NextRequest("https://site.invalid/auth/confirm?token_hash=fixture&type=recovery&next=//evil.invalid"));
  assert.equal(external.headers.get("location"),"https://site.invalid/dashboard");
  const before=calls;await confirm(new NextRequest("https://site.invalid/auth/confirm?token_hash=fixture&type=admin"));assert.equal(calls,before);
  fail=true;const denied=await callback(new NextRequest("https://site.invalid/auth/callback?code=fixture"));
  assert.equal(new URL(denied.headers.get("location")!).pathname,"/login");assert.equal(denied.headers.get("cache-control"),"no-store");assert.doesNotMatch(denied.headers.get("location")!,/PRIVATE_FAILURE/);
});
const diagnostic={status:"coverage_unavailable" as const,title:"Unqualified",message:"Controlled fixture",identity:null,digest:null,container:null,byteLength:null,coverage:null,timings:{}};
test("source download signs for 60 seconds only after current entitlement and exact owner checks; GET does not mutate", async () => {
  const { GET } = await import("../../app/api/vehicles/source-download/route.ts");
  const owner = "11111111-1111-4111-8111-111111111111", vehicle = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", sourceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const sourcePath = `${owner}/${vehicle}/${sourceId}.csv`;
  let entitled = true, rowAvailable = true, ownedVehicle = true, pathValue = sourcePath, signCalls = 0;
  globals.__securityClient = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    from(table: string) {
      const filters = new Map<string, string>();
      return { select() { return this; }, eq(key: string, value: string) { filters.set(key, value); return this; },
        async single() {
          if (table === "profiles") return { data: { ...approved, beta_status: entitled ? "approved" : "suspended" }, error: null };
          assert.equal(filters.get("user_id"), owner);
          if (table === "vehicles") { assert.equal(filters.get("id"), vehicle); return { data: ownedVehicle ? { id: vehicle } : null, error: null }; }
          assert.equal(table, "logs"); assert.equal(filters.get("id"), sourceId);
          return { data: rowAvailable ? { vehicle_id: vehicle, raw_source_storage_path: pathValue, file_url: null } : null, error: null };
        },
      };
    },
    storage: { from() { assert.fail("subscribers cannot read or sign Storage objects directly"); } },
  };
  globals.__securityStorage = { storage: { from(bucket: string) {
    assert.equal(bucket, "logs");
    return { createSignedUrl: async (path: string, expiresIn: number, options: object) => {
      assert.equal(path, sourcePath); assert.equal(expiresIn, 60); assert.deepEqual(options, { download: true }); signCalls++;
      return { data: { signedUrl: "https://storage.invalid/synthetic-short-link" }, error: null };
    } };
  } } };
  const request = () => new Request(`https://site.invalid/api/vehicles/source-download?kind=log&id=${sourceId}`);
  const response = await GET(request());
  assert.equal(response.status, 303); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer"); assert.equal(signCalls, 1);
  entitled = false; assert.equal((await GET(request())).status, 403);
  entitled = true; rowAvailable = false; assert.equal((await GET(request())).status, 404);
  rowAvailable = true; ownedVehicle = false; assert.equal((await GET(request())).status, 404);
  ownedVehicle = true; pathValue = `22222222-2222-4222-8222-222222222222/${vehicle}/${sourceId}.csv`;
  assert.equal((await GET(request())).status, 404); assert.equal(signCalls, 1);
});
test("actual session storage distinguishes missing/expired/corrupt/transient without cleanup or writes", async()=>{
  const id="A".repeat(32);let writes=0;
  let mode:"missing"|"expired"|"corrupt"|"transient"|"available"="missing";
  globals.__securityStorage={storage:{from:()=>({download:async(path:string)=>{
    if(mode==="transient")return {data:null,error:{statusCode:503,message:"offline"}};
    if(mode==="missing")return {data:null,error:{statusCode:404,message:"Object not found"}};
    if(path.startsWith("session-active/"))return {data:new Blob([id]),error:null};
    const bytes=mode==="corrupt"?new Uint8Array([1,2]):encodeSubscriberSession("alice","car",mode==="expired"?0:Date.now()+10000,diagnostic);
    return {data:new Blob([Buffer.from(bytes)]),error:null};
  },remove:async()=>{writes++;assert.fail("read deleted storage");},upload:async()=>{writes++;assert.fail("read wrote storage");}})}};
  for(const next of ["missing","expired","corrupt"] as const){mode=next;assert.equal(await readLatestDurableSubscriberWorkshopSession("alice","car"),null);}
  mode="transient";await assert.rejects(readLatestDurableSubscriberWorkshopSession("alice","car"),/TEMPORARILY_UNAVAILABLE/);
  mode="available";assert.equal((await readLatestDurableSubscriberWorkshopSession("alice","car"))?.sessionId,id);assert.equal(writes,0);
  const bytes=encodeSubscriberSession("alice","car",1000,diagnostic);
  assert.equal(inspectSubscriberSession(bytes,"bob","car",0).state,"scope_mismatch");
  assert.equal(inspectSubscriberSession(bytes,"alice","car",1000).state,"expired");
});
test("disabled ROM endpoint has constant bounded output and no filesystem work",async()=>{
  const {GET}=await import("../../app/api/rom-library/route.ts");
  const response=await GET();assert.equal(response.status,410);assert.ok((await response.text()).length<512);
  const source=fs.readFileSync("app/api/rom-library/route.ts","utf8");assert.doesNotMatch(source,/node:fs|loadRomLibrary|readdir|error\.message/);
});

test("completed vehicle deletion retries verify the authenticated RPC and owner-bound job without deleting again",async()=>{
  const {deleteOwnedVehicle}=await import("./vehicleDeletion.server.ts");
  const vehicleId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";let rpcCalls=0;
  const absent={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})};
  const ownedJob={select(){return this;},eq(key:string,value:string){if(key==="owner_id")assert.equal(value,"alice");return this;},single:async()=>({data:{status:"completed"},error:null})};
  globals.__securityStorage={from:()=>ownedJob,storage:{from:()=>assert.fail("completed retry must not delete")}};
  const retryClient={from:()=>absent,rpc:async(name:string)=>{assert.equal(name,"prepare_vehicle_deletion_v1");rpcCalls++;return {data:"job-fixture",error:null};}};
  await deleteOwnedVehicle(retryClient as unknown as Parameters<typeof deleteOwnedVehicle>[0],"alice",vehicleId);assert.equal(rpcCalls,1);
  await assert.rejects(deleteOwnedVehicle({...retryClient,rpc:async()=>({data:null,error:{message:"owner rejected"}})} as unknown as Parameters<typeof deleteOwnedVehicle>[0],"bob",vehicleId),/could not be prepared/);
});

test("actual log and Tune intake reject cross-owner and oversized evidence before storage or reservations",async()=>{
  const {POST:logUpload}=await import("../../app/api/vehicles/update-log/route.ts");
  const {POST:prepareTune}=await import("../../app/api/vehicles/prepare-tune/route.ts");
  const vehicleId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  globals.__securityClient={auth:{getUser:async()=>({data:{user:{id:"alice"}},error:null})},from:(table:string)=>{
    const query={select(){return this;},eq(key:string,value:string){if(table==="vehicles"&&key==="user_id")assert.equal(value,"alice");return this;},single:async()=>({data:table==="profiles"?approved:null,error:null})};return query;
  },rpc:()=>assert.fail("invalid intake must not reserve")};
  globals.__securityStorage={storage:{from:()=>assert.fail("invalid intake must not store")}};
  const form=new FormData();form.set("vehicleId",vehicleId);form.set("logFile",new File(["Time,RPM\n0,3000"],"fixture.csv",{type:"text/csv"}));
  const denied=await logUpload(new Request("https://site.invalid/api/vehicles/update-log",{method:"POST",headers:{origin:"https://site.invalid"},body:form}));
  assert.equal(denied.status,404);
  const metadata={vehicleId,fileName:"fixture.bin",fileType:"application/octet-stream",fileSize:100,digest:"a".repeat(64)};
  assert.equal((await prepareTune(request(JSON.stringify(metadata)))).status,404);
  assert.equal((await prepareTune(request(JSON.stringify({...metadata,fileSize:33*1024*1024})))).status,400);
  assert.equal((await logUpload(new Request("https://site.invalid/api/vehicles/update-log",{method:"POST",headers:{origin:"https://site.invalid","content-length":String(5*1024*1024)},body:"not parsed"}))).status,413);
});

test("actual Analysis engine rejects fabricated time and preserves N54/B58/Supra applicability boundaries",async()=>{
  const {buildAnalysisResult}=await import("../analysis/engine.ts");
  const {buildQualifiedParsedLog}=await import("../analysis/qualifiedAnalysisInput.ts");
  const {translateMhdRows}=await import("../logging/mhd.ts");
  const parsedLog=buildQualifiedParsedLog(translateMhdRows([0,0.1,0.2].map((Time,index)=>({Time,RPM:3000+index*100,"Boost Mean PSI":15,"Boost target (PSI)":17,"Accel Ped. Pos. (%)":100,"Throttle Position (%)":95,"WGDC Bank 1 (%)":60,"IAT[F]":104}))));
  for(const engineCode of ["B58","B58 Gen1","B58TUE","Supra",null]){
    const result=buildAnalysisResult({parsedLog,vehicle:{vehicleId:"fixture",engineCode},tuneProfile:null});
    assert.equal(result.inputQualification?.platform,"unknown");assert.equal(result.quickVerdict.confidence,0);
    assert.deepEqual(result.events,[]);assert.deepEqual(result.suggestedFixes,[]);assert.equal(result.fuelPressureThresholds,null);
  }
  const n54=buildAnalysisResult({parsedLog,vehicle:{vehicleId:"fixture",engineCode:"N54"},tuneProfile:null});
  assert.equal(n54.inputQualification?.platform,"n54");assert.notEqual(n54.quickVerdict.status,"healthy");
  assert.equal(n54.summary.maxIat,40);assert.equal(n54.fuelValidation.status,"unavailable");
  assert.throws(()=>buildAnalysisResult({parsedLog:{...parsedLog,timestamps:[0,0,0]},vehicle:null,tuneProfile:null}),/timebase/);
});

test("Tune finalisation retry preserves completed evidence after a lost acknowledgement", async () => {
  const { POST } = await import("../../app/api/vehicles/update-tune/route.ts");
  const vehicleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const token = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const tuneId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const storagePath = `alice/${vehicleId}/${tuneId}.bin`;
  let profileUnavailable = false;
  const completions: boolean[] = [];
  const released: string[] = [];
  globals.__securityClient = {
    auth: { getUser: async () => ({ data: { user: { id: "alice" } }, error: null }) },
    from(table: string) {
      const filters = new Map<string, unknown>();
      const result = () => {
        if (table === "profiles") return { data: approved, error: null };
        assert.equal(filters.get(table === "security_upload_attempts" ? "owner_id" : "user_id"), "alice");
        if (table === "vehicles") return { data: { id: vehicleId }, error: null };
        assert.equal(filters.get("vehicle_id"), vehicleId);
        if (table === "security_upload_attempts") return { data: { id: attemptId, token, resource_id: tuneId, digest: "a".repeat(64), status: "processing", lease_until: new Date(Date.now() + 60_000).toISOString() }, error: null };
        if (table === "tunes") { assert.equal(filters.get("id"), tuneId); return { data: { id: tuneId, storage_path: storagePath }, error: null }; }
        assert.equal(table, "tune_profiles"); assert.equal(filters.get("tune_id"), tuneId);
        return profileUnavailable ? { data: null, error: { message: "PRIVATE_DATABASE_ERROR" } } : { data: { id: "saved-profile" }, error: null };
      };
      return { select() { return this; }, eq(key: string, value: unknown) { filters.set(key, value); return this; }, limit() { return this; }, single: async () => result(), maybeSingle: async () => result() };
    },
    storage: { from() { assert.fail("completed retry must not read or remove its source"); } },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "claim_calibration_repair_v1") return { data: "mutation-lease", error: null };
      if (name === "finish_security_upload_v1") completions.push(args.p_completed as boolean);
      else { assert.equal(name, "release_calibration_repair_v1"); released.push(args.p_token as string); }
      return { data: null, error: null };
    },
  };
  globals.__securityStorage = { from() { assert.fail("completed retry must not modify evidence"); }, storage: { from() { assert.fail("completed retry must not remove evidence"); } } };
  const metadata = { vehicleId, fileName: "fixture.bin", fileSize: 1024, fileType: "application/octet-stream", storageBucket: "tunes", storagePath, isStockReference: false, referenceTuneId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", attemptId, attemptToken: token };
  const response = await POST(request(JSON.stringify(metadata)));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, tuneId, tuneProfileId: "saved-profile" });
  assert.deepEqual(completions, [true]);
  profileUnavailable = true;
  const failure = await POST(request(JSON.stringify(metadata)));
  assert.equal(failure.status, 503);
  assert.doesNotMatch(await failure.text(), /PRIVATE_DATABASE_ERROR/);
  assert.deepEqual(completions, [true, false]);
  assert.deepEqual(released, ["mutation-lease", "mutation-lease"]);
});
