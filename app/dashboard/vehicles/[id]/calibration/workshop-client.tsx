"use client";

import type { ReactNode } from "react";
import { exactNumber, type SharedTablePresentation } from "@/lib/calibration-workshop/sharedTablePresentation";
import { gridAxisCoordinate } from "@/lib/calibration-workshop/gridAxisPresentation";
import { tableGuidanceInput } from "@/lib/calibration-workshop/tableGuidanceContract";
import type { QualifiedSemanticField, WorkshopSemanticBinding } from "@/lib/calibration-workshop/definitionKnowledgeBinding";
import { engineeringToRawRepresentation } from "@/lib/calibration-workshop/manualEditorUx";
import { presentationFindings } from "@/lib/calibration-workshop/presentationFindings";
import CalibrationAxisGrid from "./calibration-axis-grid";
import DirectGridCell from "./direct-grid-cell";

/** Shared production consumers. The former comparison-specific controller is retired. */
export function TableEvidenceFilter({ search, onSearch, filter, onFilter, referenceAvailable }: {
  search: string; onSearch(value: string): void; filter: string; onFilter(value: string): void; referenceAvailable: boolean;
}) {
  return <div className="flex flex-wrap gap-3">
    <input id="u1-table-search" name="tableSearch" aria-label="Search Tables" placeholder="Search Tables" value={search} onChange={event => onSearch(event.target.value)} className="min-w-0 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"/>
    <select id="u1-evidence-filter" name="evidenceFilter" aria-label="Table evidence filter" value={filter} onChange={event => onFilter(event.target.value)} className="rounded border border-zinc-700 bg-zinc-950 p-2 text-xs">
      <option value="all">All Tables · all evidence states</option><option value="working">Changed Tables · Working versus Current</option>
      <option value="reference" disabled={!referenceAvailable}>Changed Tables · Current versus Reference{!referenceAvailable ? " — unavailable" : ""}</option><option value="unavailable">Unavailable Tables</option>
    </select>
  </div>;
}

export function Grid({ model, zoom = 1, onZoom, selected, onSelect, canEdit, onNavigate, onCommit, onEditingChange, onDraftCancelled }: {
  zoom?: number; onZoom?(zoom: number): void;
  model: SharedTablePresentation; selected: readonly number[]; onSelect(index: number, region?: boolean): void; canEdit: boolean;
  onNavigate(index: number, region?: boolean): void; onCommit(index: number, value: number): ReturnType<Parameters<typeof DirectGridCell>[0]["onCommit"]>;
  onEditingChange?(index: number, editing: boolean): void; onDraftCancelled?(): void;
}) {
  const byCoordinate = new Map(model.cells.map(cell => [cell.row + ":" + cell.column, cell]));
  return <><label className="text-xs">Grid zoom <select id="calibration-grid-zoom" name="gridZoom" aria-label="Grid zoom" value={zoom} onChange={event => onZoom?.(Number(event.target.value))} className="bg-zinc-950">{[.75,1,1.25,1.5].map(value => <option key={value} value={value}>{value * 100}%</option>)}</select></label><div style={{ zoom }}><CalibrationAxisGrid presentation={model.terminology.grid} terminology={model.terminology} rows={model.rows} columns={model.columns}
    renderCell={(row, column) => {
      const cell = byCoordinate.get(row + ":" + column), key = model.projection.tableIdentity + ":" + row + ":" + column;
      if (!cell || cell.value === null) return <td key={key} aria-label={"Cell row " + row + " column " + column + " unavailable"}>Unavailable</td>;
      return <td key={key} className="p-0.5"><DirectGridCell cellKey={key} index={cell.index} row={row} column={column} columnCount={model.columns}
        value={cell.value} currentValue={cell.current?.value ?? cell.value} referenceValue={model.comparison && model.display !== "reference" ? cell.reference?.value : undefined}
        changed={cell.changed} selected={selected.includes(cell.index)} canEdit={canEdit && model.display === "working" && model.workingBound}
        onSelect={onSelect} onNavigate={onNavigate} onCommit={value => onCommit(cell.index, value)} format={exactNumber}
        onEditingChange={editing => onEditingChange?.(cell.index, editing)} onDraftCancelled={onDraftCancelled}/></td>;
    }} footer={<><p className="mt-2 text-xs text-zinc-500">{model.display === "reference" ? "Reference" : model.display === "working" ? "Working" : "Current"} values. Green changed markers mean {model.display === "working" ? "Working versus immutable Current" : "qualified Current versus Reference"}; they are not safety judgments.</p>
      <p className="mt-2 text-xs text-zinc-500">Drag or Shift-click selects a rectangular region. Arrow keys navigate governed coordinates. In WORKING mode, double-click or press Enter on an editable cell; Enter applies, Escape cancels, and Tab moves between cells.</p></>}/></div></>;
}

type RelatedDefinition = Readonly<{ key: string; definitionRevision: string; occurrence: number; title: string; semantic: WorkshopSemanticBinding }>;
function Field({ label, fields, reason, render = String }: { label: string; fields: readonly QualifiedSemanticField<unknown>[]; reason: string | null; render?(value: unknown): ReactNode }) {
  return <section className="mt-3"><h4 className="font-semibold">{label}</h4>{fields.length ? fields.map((field, index) => <div key={field.assertionId + ":" + field.assertionRevision + ":" + index} className="mt-1">
    <p>{render(field.value)}</p><details className="text-xs text-zinc-500"><summary>Evidence and limitations</summary><p>{field.assertionId} · {field.assertionRevision}</p><p>Authority: {field.authority}</p>
      {field.provenance.map((item, i) => <p key={"p:" + i}>{item}</p>)}{field.limitations.map((item, i) => <p key={"l:" + i}>{item}</p>)}</details></div>) : <p className="text-zinc-400">{reason ?? "Not yet established."}</p>}</section>;
}

export function TableGuidance({ model, definitions, onOpen }: { model: SharedTablePresentation; definitions: readonly RelatedDefinition[]; onOpen(key: string): void }) {
  const input = tableGuidanceInput({ tableKey: model.projection.selection.key, definitionRevision: model.projection.selection.definitionRevision,
    sourceTitle: model.terminology.sourceTitle, semantic: model.semantic });
  // Only producer-qualified fields enter either disclosure; source titles never generate education.
  const semantic = { controls: input.understand.controls.fields, provenance: input.engineering.provenance,
    unavailableReason: model.semantic.unavailableReason ?? input.unavailableReason };
  const controls = semantic.controls.map(field => field);
  return <>
    <details open={model.terminology.mode === "standard"}><summary className="cursor-pointer font-semibold">Understand</summary>
      {semantic.unavailableReason && <p className="mt-2 text-zinc-400">{semantic.unavailableReason}</p>}
      <Field label="What this Table does" fields={controls} reason={input.understand.controls.unavailableReason}/>
      <Field label="Why it matters" {...input.understand.whyItMatters} reason={input.understand.whyItMatters.unavailableReason}/>
      <Field label="How to read it" {...input.understand.howToRead} reason={input.understand.howToRead.unavailableReason}/>
      <Field label="When it is used" {...input.understand.operatingContexts} reason={input.understand.operatingContexts.unavailableReason}/>
      <Field label="Important consideration" {...input.understand.considerations} reason={input.understand.considerations.unavailableReason}/>
      <Field label="Telemetry to inspect" {...input.engineering.telemetry} reason={input.engineering.telemetry.unavailableReason} render={value => { const field = value as { channelId: string; meaning: string }; return field.channelId + ": " + field.meaning; }}/>
    </details>
    <details open={model.terminology.mode === "engineer"}><summary className="cursor-pointer font-semibold">Engineering Detail</summary>
      <p>{semantic.unavailableReason}</p><p>Knowledge: {input.knowledgeId ?? "Not established"} · {input.knowledgeRevision ?? "Not established"}</p>
      <Field label="Axis meaning" {...input.engineering.axes} reason={input.engineering.axes.unavailableReason} render={value => { const field = value as { axisId: string; meaning: string }; return field.axisId + ": " + field.meaning; }}/>
      <Field label="Output meaning" {...input.engineering.output} reason={input.engineering.output.unavailableReason}/>
      {semantic.provenance.map((item, index) => <p key={index} className="mt-2 break-all text-xs">{item}</p>)}
      {input.engineering.limitations.map((item, index) => <p key={index} className="mt-2 text-xs">{item}</p>)}
    </details>
    <details><summary className="cursor-pointer font-semibold">Related Tables</summary>
      {!input.engineering.relatedTables.fields.length && <p className="mt-2 text-zinc-400">No qualified Related Tables for this exact Definition/ROM. {input.engineering.relatedTables.unavailableReason}</p>}
      {input.engineering.relatedTables.fields.map((edge, index) => {
        const targets = definitions.filter(item => item.semantic.outcome === "exact" && item.semantic.knowledgeId === edge.value.targetKnowledgeId && item.semantic.knowledgeRevision);
        return <div key={edge.assertionId + ":" + index} className="mt-3"><Field label="Related Table" fields={[edge]} reason={null} render={() => edge.value.relationship}/>
          {targets.length === 0 ? <p>Exact target is unavailable in this authorised Dataset.</p> : <>{targets.length > 1 && <p>Multiple exact occurrences: choose explicitly.</p>}{targets.map(target => <button key={target.key} type="button" onClick={() => onOpen(target.key)} className="mt-2 block rounded border border-blue-400/40 px-2 py-1 text-left">{target.title} · occurrence {target.occurrence}<span className="block break-all font-mono text-xs">{target.definitionRevision}</span></button>)}</>}
        </div>;
      })}
    </details>
  </>;
}

export function Inspector({ model, selected, definitions, onOpen, onCollapse }: {
  model: SharedTablePresentation; selected: number; definitions: readonly RelatedDefinition[]; onOpen(key: string): void; onCollapse(): void;
}) {
  const cell = model.cells.find(item => item.index === selected), projection = model.projection;
  const coordinate = cell ? gridAxisCoordinate(model.terminology.grid, cell.row, cell.column) : null;
  const workingRaw = cell?.workingValue != null ? engineeringToRawRepresentation(cell.workingValue, projection.capabilities.edit?.inverse ?? null) : null;
  const findings = presentationFindings([{ sourceId: "current", findings: projection.slots.current.findings }, { sourceId: "reference", findings: projection.slots.reference.findings },
    { sourceId: "edit", findings: projection.capabilities.edit?.findings ?? [] }]);
  return <aside className="bmw-border space-y-5 rounded-2xl bg-zinc-950 p-5">
    <div className="flex justify-between"><h2 className="text-xs uppercase tracking-widest text-blue-300">Cell Inspector</h2><button type="button" onClick={onCollapse} aria-label="Collapse Cell Inspector" className="rounded border border-zinc-700 px-2 py-1 text-xs">Collapse</button></div>
    {cell ? <dl className="grid grid-cols-2 gap-3 text-sm" data-selection={projection.selection.definitionRevision + ":" + projection.selection.occurrence + ":" + cell.index}>
      <dt>Row / column</dt><dd>R{cell.row + 1} / C{cell.column + 1}</dd>
      {coordinate?.x && <><dt>{model.terminology.x?.label ?? "X"}</dt><dd>{String(coordinate.x.value)} {coordinate.x.units}</dd></>}
      {coordinate?.y && <><dt>{model.terminology.y?.label ?? "Y"}</dt><dd>{String(coordinate.y.value)} {coordinate.y.units}</dd></>}
      <dt>Reference</dt><dd>{exactNumber(cell.reference?.value)}</dd><dt>Current</dt><dd>{exactNumber(cell.current?.value)}</dd>
      <dt>Working</dt><dd>{model.workingBound ? exactNumber(cell.workingValue) : "Not created or incompatible"}</dd>
      <dt>Working − Current</dt><dd>{exactNumber(cell.workingDelta)}</dd><dt>Working percentage delta</dt><dd>{cell.workingDelta === null ? "Unavailable" : cell.current?.value === 0 ? "Undefined from zero" : exactNumber(cell.percentageDelta) + "%"}</dd>
      <dt>Current − Reference</dt><dd>{exactNumber(cell.referenceDelta)}</dd><dt>Units</dt><dd>{cell.units ?? "Not supplied"}</dd>
      <dt>Displayed state</dt><dd>{model.display}</dd><dt>EDIT capability</dt><dd>{projection.capabilities.edit?.state ?? "VIEW_ONLY"}</dd>
    </dl> : <p>No qualified cell is available. {model.selectedLayer.state}</p>}
    {model.comparisonReason && <p className="text-xs text-amber-200">{model.comparisonReason}</p>}
    <details><summary>Raw Representation</summary>{cell ? <dl className="mt-2 grid grid-cols-2 gap-2 break-all text-xs">
      <dt>Reference raw / offset</dt><dd>{exactNumber(cell.reference?.rawValue)} / {exactNumber(cell.reference?.rawOffset)}</dd>
      <dt>Current raw / offset</dt><dd>{exactNumber(cell.current?.rawValue)} / {exactNumber(cell.current?.rawOffset)}</dd>
      <dt>Working raw (qualified inverse)</dt><dd>{exactNumber(workingRaw)}</dd>
      <dt>Representation</dt><dd>{model.selectedLayer.rawRepresentation ? model.selectedLayer.rawRepresentation.datatype + " · " + model.selectedLayer.rawRepresentation.widthBits + " bits · " + model.selectedLayer.rawRepresentation.endianness + " · signed " + String(model.selectedLayer.rawRepresentation.signed) : "Unavailable"}</dd>
    </dl> : <p>Raw evidence unavailable.</p>}</details>
    <section className="border-t border-zinc-800 pt-4"><h3 className="font-semibold">Table Information</h3><p className="mt-2">{model.terminology.sourceTitle}</p><p className="mt-2 text-xs text-zinc-400">Source description: {model.selectedLayer.definition?.description ?? "Not supplied"}</p><p className="text-xs">{model.shape} · {model.rows} × {model.columns}</p>
      <details className="mt-2 break-all text-xs"><summary>Exact evidence identity</summary><p>Definition: {projection.selection.definitionRevision} · occurrence {projection.selection.occurrence}</p><p>Dataset: {model.selectedLayer.dataset?.datasetId} · {model.selectedLayer.dataset?.datasetRevision}</p><p>ROM Layout: {model.selectedLayer.dataset?.romLayoutId}</p><p>Definition Set: {model.selectedLayer.dataset?.definitionSetRevision}</p></details>
      {findings.map(item => <p key={item.key} className="mt-2 text-xs text-amber-200">{item.text}</p>)}
    </section>
    <div className="space-y-4 text-sm"><TableGuidance model={model} definitions={definitions} onOpen={onOpen}/></div>
  </aside>;
}
