"use client";

import type { WorkingCalibration, WorkingEditOperation, WorkingEditPreview } from "@/lib/calibration-workshop/workingCalibration";

export type CalibrationDisplayMode = "current" | "working";

export default function WorkingCalibrationPanel({ mode, onMode, working, onCreate, onUndo, onRedo, operation, onOperation, operand, onOperand, preview, onApply, selectedCount, definitionTitles, editQualified, blockers, warnings, saveStatus }: {
  mode: CalibrationDisplayMode;
  onMode: (mode: CalibrationDisplayMode) => void;
  working: WorkingCalibration | null;
  onCreate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  operation: WorkingEditOperation;
  onOperation: (operation: WorkingEditOperation) => void;
  operand: string;
  onOperand: (value: string) => void;
  preview: WorkingEditPreview | null;
  onApply: () => void;
  selectedCount: number;
  definitionTitles: Readonly<Record<string, string>>;
  editQualified: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
  saveStatus: "loading" | "saved" | "not-created";
}) {
  const activeHistory = working?.mutations.slice(0, working.cursor) ?? [];
  return <section className="mt-4 space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-4" aria-label="Working Calibration controls">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex rounded-lg border border-zinc-700 bg-black p-1" aria-label="Calibration state">
        <button type="button" aria-pressed={mode === "current"} onClick={() => onMode("current")} className={`rounded-md px-4 py-2 text-xs font-bold ${mode === "current" ? "bg-blue-500/20 text-blue-200" : "text-zinc-400"}`}>CURRENT</button>
        <button type="button" aria-pressed={mode === "working"} disabled={!working} onClick={() => onMode("working")} className={`rounded-md px-4 py-2 text-xs font-bold ${mode === "working" ? "bg-emerald-500/20 text-emerald-200" : "text-zinc-400 disabled:text-zinc-700"}`}>WORKING</button>
      </div>
      <p className="text-xs text-zinc-400" role="status">{saveStatus === "saved" ? "Saved in this subscriber Workshop" : saveStatus === "loading" ? "Restoring saved Working Calibration…" : "Working Calibration not created"}</p>
    </div>

    {!working ? <div><p className="text-sm text-zinc-300">Current Calibration is immutable. Create one separate Working Calibration from this exact Current Dataset to begin editing.</p><button type="button" onClick={onCreate} className="mt-3 rounded-lg border border-blue-400 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100">Create Working Calibration</button></div> : <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{working.state === "dirty" ? `${working.cursor} applied change${working.cursor === 1 ? "" : "s"}` : "No Working changes"}</span>
        <button type="button" disabled={working.cursor === 0} onClick={onUndo} className="rounded border border-zinc-700 px-3 py-2 text-xs disabled:opacity-40">Undo</button>
        <button type="button" disabled={working.cursor >= working.mutations.length} onClick={onRedo} className="rounded border border-zinc-700 px-3 py-2 text-xs disabled:opacity-40">Redo</button>
      </div>
      <div className="grid gap-3 rounded-xl border border-zinc-800 bg-black/40 p-3 md:grid-cols-[minmax(150px,220px)_minmax(130px,1fr)_auto] md:items-end">
        <label className="text-xs text-zinc-400">Operation<select aria-label="Edit operation" value={operation} onChange={event => onOperation(event.target.value as WorkingEditOperation)} className="mt-1 block w-full rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white"><option value="assign">Set value</option><option value="delta">Add / subtract</option><option value="percentage">Percentage change</option></select></label>
        <label className="text-xs text-zinc-400">Engineering value<input aria-label="Edit value" value={operand} onChange={event => onOperand(event.target.value)} inputMode="decimal" placeholder={operation === "assign" ? "18.5" : operation === "delta" ? "+2.0" : "+5"} className="mt-1 block w-full rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white"/></label>
        <button type="button" disabled={!editQualified || preview?.validation === "BLOCKED" || !preview || mode !== "working"} onClick={onApply} className="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:border-zinc-700 disabled:text-zinc-600">Apply to {selectedCount} cell{selectedCount === 1 ? "" : "s"}</button>
      </div>
      <div className={`rounded-lg border p-3 text-xs ${preview?.validation === "VALID" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : preview?.validation === "WARNING" ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : "border-zinc-700 bg-black/30 text-zinc-400"}`} role="status">
        <strong>{preview?.validation ?? (editQualified ? "Enter a value to validate" : "BLOCKED")}</strong>
        <span className="ml-2">{preview ? `${selectedCount} governed coordinate${selectedCount === 1 ? "" : "s"} selected.` : "No valid edit is ready."}</span>
        {[...blockers, ...warnings, ...(preview?.findings ?? [])].map(item => <p key={item} className="mt-1">{item}</p>)}
      </div>
      <details className="rounded-lg border border-zinc-800 p-3" open={activeHistory.length > 0}>
        <summary className="cursor-pointer text-sm font-semibold">Change history · {activeHistory.length}</summary>
        <ol className="mt-3 max-h-56 space-y-2 overflow-auto">{activeHistory.map(mutation => <li key={mutation.sequence} className="rounded-lg bg-black/40 p-3 text-xs"><div className="flex justify-between gap-3"><strong>#{mutation.sequence} · {definitionTitles[`${mutation.targets[0]!.definitionRevision}:${mutation.targets[0]!.occurrence}`] ?? "Governed Table"}</strong><span className={mutation.validation === "WARNING" ? "text-amber-200" : "text-emerald-200"}>{mutation.validation}</span></div><p className="mt-1 text-zinc-400">{mutation.operation} {mutation.operand} · {mutation.targets.length} cell{mutation.targets.length === 1 ? "" : "s"} · R{mutation.targets[0]!.row} C{mutation.targets[0]!.column}{mutation.targets.length > 1 ? ` → R${mutation.targets.at(-1)!.row} C${mutation.targets.at(-1)!.column}` : ""}</p><p className="mt-1 text-zinc-500">{mutation.before.slice(0, 8).map((value, index) => `${value} → ${mutation.after[index]}`).join(" · ")}{mutation.before.length > 8 ? ` · +${mutation.before.length - 8} more` : ""}</p></li>)}</ol>
      </details>
    </>}

    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-lg border border-blue-400/25 bg-blue-400/5 p-3"><strong className="text-blue-200">Build Calibration</strong><p className="mt-1 text-zinc-400">Available for valid Working changes when the exact source lease and reconstruction contract remain qualified.</p></div>
      <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3"><strong className="text-amber-200">Export BIN · LOCKED</strong><p className="mt-1 text-zinc-400">Checksum/integrity qualification required. No downloadable or flashable BIN is produced.</p></div>
    </div>
  </section>;
}
