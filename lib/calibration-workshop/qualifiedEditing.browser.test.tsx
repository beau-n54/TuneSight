/** Synthetic browser exercise of actual controller and edit engine, not vehicle acceptance. */
import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import Workspace from "../../app/dashboard/vehicles/[id]/calibration/shared-workspace-client";
import type { WorkspaceBrowserFixture } from "./sharedWorkspace.browser.test";
import type { DurableWorkingSnapshot } from "./durableWorking";

export async function runQualifiedEditingBrowserTests(container:HTMLElement,fixtures:WorkspaceBrowserFixture[],report:(message:string)=>void) {
  const nativeFetch=window.fetch, confirm=window.confirm;
  const check=(value:unknown,label:string)=>{if(!value)throw Error(label);};
  const button=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.trim()===label)!;
  const settle=async (predicate:()=>boolean)=>{const until=performance.now()+10000;while(!predicate()){if(performance.now()>until)throw Error("R05 UI timeout");await new Promise(requestAnimationFrame);}};
  const input=(el:HTMLInputElement|HTMLTextAreaElement,value:string)=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value")!.set!.call(el,value);el.dispatchEvent(new Event("input",{bubbles:true}));};
  const operation=async(value:string)=>{const el=container.querySelector<HTMLSelectElement>('[name="workingOperation"]')!;el.value=value;el.dispatchEvent(new Event("change",{bubbles:true}));await new Promise(requestAnimationFrame);};
  window.confirm=()=>true;
  try { for(const fixture of fixtures) {
    const scope=fixture.props.context.ownerId;check(scope.startsWith("r02-controlled"),"Synthetic scope required");
    const clear=()=>{for(const key of Object.keys(localStorage))if(key.includes(scope))localStorage.removeItem(key);};clear();
    let snapshot:DurableWorkingSnapshot={head:null,working:null,history:[]};
    window.fetch=async(url,init)=>{const body=JSON.parse(String(init?.body));
      if(!String(url).endsWith("/working"))return Response.json(fixture.responses[body.selection.key]);
      if(body.action==="save")snapshot={working:body.working,head:{id:crypto.randomUUID(),sequence:1,parent_id:null,previous_head_id:null,restored_from_id:null,content_hash:"controlled",created_at:new Date().toISOString(),contract_version:"tunesight.durable-working.v1",capability_state:"EDIT_ONLY_OUTPUT_LOCKED"},history:[]};
      return Response.json({status:"ready",...snapshot});};
    const root=createRoot(container);
    try {
      root.render(createElement(StrictMode,null,createElement(Workspace,{...fixture.props,upload:null,initialWorking:{status:"ready",snapshot}})));
      await settle(()=>Boolean(button("Create Working Calibration"))&&!button("Create Working Calibration").disabled);
      button("Create Working Calibration").click();await settle(()=>button("WORKING")?.getAttribute("aria-pressed")==="true");
      const projection=fixture.props.evidence.projection!, definition=fixture.props.workshop.definitions.find(d=>d.key===projection.selection.key)!, inverse=definition.editCapability.inverse!;
      const expected=10*inverse.scale+inverse.offset;
      const cell=()=>container.querySelector<HTMLButtonElement>('[data-working-cell="0"]')!;
      cell().dispatchEvent(new KeyboardEvent("keydown",{key:"F2",bubbles:true}));await settle(()=>Boolean(container.querySelector('[name="workingCellValue"]')));
      input(container.querySelector<HTMLInputElement>('[name="workingCellValue"]')!,"0x20");
      container.querySelector('[name="workingCellValue"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
      await settle(()=>container.textContent?.includes("without grouping separators")===true);
      check(Boolean(container.querySelector('[name="workingCellValue"]')),"Invalid input retains pending draft");
      container.querySelector('[name="workingCellValue"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
      await settle(()=>!container.querySelector('[name="workingCellValue"]'));
      await operation("assign");input(container.querySelector<HTMLInputElement>('[name="workingOperand"]')!,String(expected));await settle(()=>!button("Apply to 1 cell").disabled);
      button("Apply to 1 cell").click();await settle(()=>!button("Undo").disabled);
      button("Undo").click();await settle(()=>!button("Redo").disabled);button("Redo").click();await settle(()=>!button("Undo").disabled);
      cell().dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",shiftKey:true,bubbles:true}));
      await settle(()=>Boolean(button("Apply to 2 cells")));
      await operation("matrix");input(container.querySelector<HTMLTextAreaElement>('[name="workingOperand"]')!,String(expected)+"\t"+String(expected));
      await settle(()=>!button("Apply to 2 cells").disabled);button("Apply to 2 cells").click();
      await settle(()=>container.textContent?.includes("Matrix paste")===true);
      button("Save durable revision").click();await settle(()=>snapshot.working?.mutations.length===2&&container.textContent?.includes("Saved as a durable Working revision")===true);
      check(snapshot.working!.mutations.every(m=>m.exactRaw?.length===m.targets.length),"Every new UI mutation records exact raw evidence");
      const explorer=[...container.querySelectorAll<HTMLButtonElement>('[aria-label="Explorer table list"] button')];
      const oneD=Object.values(fixture.responses).find(r=>r.status==="ready"&&r.projection.slots.current.definition?.dimensions?.kind==="array_1d");
      check(oneD?.status==="ready","1D fixture exists");
      if(oneD?.status==="ready") {
        explorer.find(b=>b.title===oneD.projection.slots.current.definition!.title)!.click();await settle(()=>container.querySelectorAll('[role="tab"]').length===2&&Boolean(cell()));
        const d=fixture.props.workshop.definitions.find(d=>d.key===oneD.projection.selection.key)!;
        await operation("assign"); input(container.querySelector<HTMLInputElement>('[name="workingOperand"]')!,String(10*d.editCapability.inverse!.scale+d.editCapability.inverse!.offset));
        await settle(()=>!button("Apply to 1 cell").disabled);button("Apply to 1 cell").click();await settle(()=>container.textContent?.includes("3 applied changes")===true);
      }
      const scalar=Object.values(fixture.responses).find(r=>r.status==="ready"&&r.projection.slots.current.definition?.dimensions?.kind==="scalar");
      check(scalar?.status==="ready","Scalar fixture exists");
      if(scalar?.status==="ready") {
        [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Explorer table list"] button')].find(b=>b.title===scalar.projection.slots.current.definition!.title)!.click();
        await settle(()=>container.querySelectorAll('[role="tab"]').length===3&&container.querySelectorAll('[data-working-cell]').length===1);
        const d=fixture.props.workshop.definitions.find(d=>d.key===scalar.projection.selection.key)!;
        await operation("assign");input(container.querySelector<HTMLInputElement>('[name="workingOperand"]')!,String(10*d.editCapability.inverse!.scale+d.editCapability.inverse!.offset));
        await settle(()=>!button("Apply to 1 cell").disabled);button("Apply to 1 cell").click();await settle(()=>container.textContent?.includes("4 applied changes")===true);
        check(button("2D").disabled&&button("3D").disabled,"Scalar cannot manufacture plot axes");
      }
      button("Save durable revision").click();await settle(()=>snapshot.working?.mutations.length===4&&container.textContent?.includes("Saved as a durable Working revision")===true);
      button("Revert complete Working to Current").click();await settle(()=>container.textContent?.includes("No Working changes")===true);
      check(snapshot.working!.mutations.length===4,"Complete revert is unsaved until explicit save; durable history survives");
      check(container.textContent?.includes("Axis editing, floating and masked values")&&container.textContent.includes("Export BIN · LOCKED"),"Unqualified structures and output remain disclosed/locked");
      // Reproduce the production defect on actual 2D grid/controller/history components.
      const dimensions=projection.slots.current.definition?.dimensions;
      if(!dimensions || dimensions.rows<3 || dimensions.columns<3)throw Error("3x3 qualified fixture required");
      const columns=dimensions.columns;
      [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(b=>b.textContent===definition.title)!.click();
      await settle(()=>Boolean(container.querySelector(`[data-working-cell="${2*columns+2}"]`)));
      cell().dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));
      container.querySelector(`[data-working-cell="${2*columns+2}"]`)!.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,shiftKey:true}));
      await settle(()=>Boolean(button("Apply to 9 cells")));
      await operation("matrix");input(container.querySelector<HTMLTextAreaElement>('[name="workingOperand"]')!,Array(3).fill(Array(3).fill(String(expected)).join("\t")).join("\n"));
      await settle(()=>!button("Apply to 9 cells").disabled);button("Apply to 9 cells").click();
      await settle(()=>container.textContent?.includes("9 cells · R0 C0 → R2 C2")===true);
      button("Save durable revision").click();await settle(()=>snapshot.working?.mutations.length===1&&container.textContent?.includes("Saved as a durable Working revision")===true);
      check(snapshot.working!.mutations[0].targets.length===9&&snapshot.working!.mutations[0].exactRaw?.length===9,"All nine targets and byte traces survive UI save");
      root.render(createElement(StrictMode,null,createElement(Workspace,{...fixture.props,key:"history-reload",upload:null,initialWorking:{status:"ready",snapshot}})));
      await settle(()=>container.textContent?.includes("9 cells · R0 C0 → R2 C2")===true);
      report("PASS R05 history "+fixture.label+": 3x3 numeric bounds, nine targets/raw traces and remounted durable history");
      report("PASS R05 controlled "+fixture.label+": exact scalar/1D/2D edits, malformed input, cancellation, keyboard rectangle, matrix paste, raw-byte trace, undo/redo, save and safe complete revert");
    } finally {root.unmount();clear();}
  }} finally {window.fetch=nativeFetch;window.confirm=confirm;}
}
