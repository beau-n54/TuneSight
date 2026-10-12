/** Controlled browser entry: real React components, mocked Supabase/navigation.
 * The isolated harness supplies module replacements; never import from a route. */
import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import Login from "../../app/login/page";
import ResetPassword from "../../app/reset-password/page";
import Logout from "../../components/LogoutControl";
import SessionBoundary from "../../components/SubscriberSessionBoundary";
import LogFileInput from "../../components/LogFileInput";
import { BrowserRecordingStore } from "../vehicle-interface/offlineRecordingQueue";

export async function runAccountRecoveryBrowserTests(container: HTMLElement, report: (message: string) => void) {
  const globals = globalThis as unknown as Record<string, unknown>;
  let mode="offline", calls=0, root:Root|undefined;
  const navigations:string[]=[];
  let authChanged:((event:string,session:{user:{id:string}}|null)=>void)|undefined;
  const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
  const until=async(predicate:()=>boolean)=>{const end=performance.now()+4000;while(!predicate()){if(performance.now()>end)throw new Error("Account UI did not settle");await pause(10);}};
  const button=(label:string)=>[...container.querySelectorAll("button")].find(item=>item.textContent===label)!;
  const type=(id:string,value:string)=>{const input=container.querySelector<HTMLInputElement>(`#${id}`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));};
  globals.__securityNavigate=(url:string)=>navigations.push(url);
  globals.__securityUiRouter={replace:(url:string)=>navigations.push(url),push:(url:string)=>navigations.push(url),refresh:()=>undefined};
  globals.__securityUiClient={auth:{
    signInWithPassword:async()=>{calls++;await pause(20);if(mode==="offline")throw new Error("controlled outage");return {data:{user:{id:"alice"}},error:null};},
    resetPasswordForEmail:async()=>{calls++;if(mode==="offline")throw new Error("controlled outage");return {error:null};},
    getUser:async()=>({data:{user:mode==="expired"?null:{id:"alice"}},error:null}),
    updateUser:async()=>{calls++;if(mode==="offline")throw new Error("controlled outage");return {error:null};},
    signOut:async(options:{scope:string})=>{check(options.scope==="local","Logout scope is explicit");calls++;if(mode==="offline")throw new Error("controlled outage");return {error:null};},
    onAuthStateChange:(callback:typeof authChanged)=>{authChanged=callback;return {data:{subscription:{unsubscribe:()=>undefined}}};},
  }};
  const mount=async(node:ReactNode)=>{root?.unmount();root=createRoot(container);root.render(<StrictMode>{node}</StrictMode>);await pause(50);};
  try {
    await mount(<Login/>);type("login-email","controlled@example.invalid");type("login-password","test-only-unused");await pause(20);
    button("Login").click();button("Login")?.click();await until(()=>Boolean(container.textContent?.includes("could not complete")));
    check(calls===1&&!button("Login").disabled,"Login exception restores state and blocks duplicate request");report("PASS login exception/finally and duplicate guard");
    mode="success";button("Login").click();await until(()=>navigations.length>0);check(navigations.at(-1)==="/dashboard","Login returns to safe server-checked destination");report("PASS login retry and return navigation");
    // Mock navigation does not unmount Login. Wait for React to finish rendering
    // the successful request before exercising this separate recovery action.
    await until(()=>!button("Forgot Password?").disabled);
    button("Forgot Password?").click();await until(()=>Boolean(container.textContent?.includes("If this is your registered address")));report("PASS recovery request does not reveal account membership");
    mode="expired";await mount(<ResetPassword/>);await until(()=>Boolean(container.textContent?.includes("Recovery session missing")));check(button("Update Password").disabled,"Expired recovery must be disabled");report("PASS expired recovery session fails closed");
    mode="offline";await mount(<ResetPassword/>);await until(()=>!button("Update Password").disabled);type("new-password","test-only-unused");type("confirm-password","test-only-unused");await pause(20);button("Update Password").click();await until(()=>Boolean(container.textContent?.includes("could not be confirmed")));check(!button("Update Password").disabled,"Password retry remains possible");report("PASS password exception restores retry state");
    mode="success";button("Update Password").click();await until(()=>navigations.at(-1)==="/login");report("PASS mock password update signs out and returns to login");
    mode="offline";await mount(<Logout/>);button("Sign out").click();await until(()=>Boolean(container.textContent?.includes("did not complete")));check(!button("Sign out").disabled,"Logout can retry");report("PASS logout error recovery");
    mode="success";const before=navigations.length;button("Sign out").click();await until(()=>navigations.length>before);check(navigations.at(-1)==="/login","Logout discards subscriber page");report("PASS logout full navigation contract");
    await mount(<SessionBoundary ownerId="alice"><p>PRIVATE_FIXTURE</p></SessionBoundary>);authChanged?.("SIGNED_IN",{user:{id:"bob"}});await until(()=>!container.textContent?.includes("PRIVATE_FIXTURE"));report("PASS account switch hides previous owner content");
    await mount(<form><LogFileInput/></form>);
    const fileInput=container.querySelector<HTMLInputElement>("#logFile")!;
    const files=new DataTransfer();files.items.add(new File([new Uint8Array(4*1024*1024+1)],"oversized.csv",{type:"text/csv"}));fileInput.files=files.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}));
    check(!fileInput.checkValidity(),"Oversized source cannot submit to hosted function");
    const validFiles=new DataTransfer();validFiles.items.add(new File(["Time,RPM\n0,3000"],"fixture.csv",{type:"text/csv"}));fileInput.files=validFiles.files;fileInput.dispatchEvent(new Event("change",{bubbles:true}));
    check(fileInput.checkValidity(),"Qualified size restores submission");report("PASS native upload size boundary and correction");
  } finally { root?.unmount(); }

  // Native browser IndexedDB, synthetic unique owner/vehicle only. No legacy or
  // subscriber database is opened; the store's new scoped database is used.
  const owner=`security-fixture-${crypto.randomUUID()}`,vehicle="synthetic-car",id=crypto.randomUUID();
  const store=new BrowserRecordingStore(owner,vehicle);
  try {
    await store.begin({recordingId:id,vehicleId:vehicle,sessionId:"synthetic",transport:"controlled-browser-test",dmeIdentity:null,romSoftwareIdentity:null,startedAt:"2026-01-01T00:00:00.000Z"});
    await store.append(id,[{channelKey:"rpm",channelRevisionId:"fixture",sequence:1,value:1000,unit:"rpm",acquiredAt:"2026-01-01T00:00:00.100Z",receivedAt:"2026-01-01T00:00:00.100Z",latencyMs:1,droppedSincePrevious:0,provenance:"synthetic"}]);
    const recovered=await new BrowserRecordingStore(owner,vehicle).export(id);
    check(Boolean(recovered.recovery)&&recovered.samples.length===1,"Only committed interrupted data is recovered");report("PASS native IndexedDB transaction and interrupted reload");
    check((await new BrowserRecordingStore(owner+"-other",vehicle).list()).length===0,"Different owner cannot see recording");report("PASS native IndexedDB owner isolation");
    await store.finish(id,"recorded","2026-01-01T00:00:01.000Z");check(!(await store.export(id)).recovery,"Completion is explicit");report("PASS native IndexedDB finish and exact export");
  } finally { await store.delete(id); }
}
