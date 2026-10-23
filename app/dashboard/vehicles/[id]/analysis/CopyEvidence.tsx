"use client";

import {useState} from "react";

/** Explicit user action only. No storage, network request or token handling. */
export function CopyEvidence({text}:{text:string}) {
  const [status,setStatus]=useState("");
  return <div className="space-y-2"><button type="button" className="rounded border border-blue-700 px-3 py-2 text-sky-200 hover:bg-blue-950 focus-visible:outline-2" onClick={async()=>{
    try {await navigator.clipboard.writeText(text);setStatus("Evidence copied.");}
    catch {setStatus("Clipboard unavailable. Select and copy the evidence below.");}
  }}>Copy exact evidence</button><span role="status" className="ml-2 text-sm">{status}</span>
  {status.startsWith("Clipboard unavailable")&&<textarea aria-label="Exact evidence for manual copy" readOnly value={text} className="w-full bg-slate-950 p-2"/>}</div>;
}
