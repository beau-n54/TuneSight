"use client";

import { useEffect, useState } from "react";
import { validationExplanation } from "@/lib/calibration-workshop/manualEditorUx";
import type { WorkingValidationState } from "@/lib/calibration-workshop/workingCalibration";

import { DIRECT_DRAFT_CANCELLED, directDraftPolicy, discardRevokedDraft, submitDirectDraft } from "@/lib/calibration-workshop/sharedWorkspacePresentationState";

type DirectEditResult = Readonly<{ status: "applied"; validation: WorkingValidationState; findings: readonly string[] }> | Readonly<{ status: "blocked"; findings: readonly string[] }>;

export default function DirectGridCell({ cellKey, index, row, column, columnCount, value, currentValue, referenceValue, changed, selected, canEdit, onSelect, onNavigate, onCommit, format, onEditingChange, onDraftCancelled }: {
  cellKey: string;
  index: number;
  row: number;
  column: number;
  columnCount: number;
  value: number;
  currentValue: number;
  referenceValue?: number;
  changed: boolean;
  selected: boolean;
  canEdit: boolean;
  onSelect: (index: number, region?: boolean) => void;
  onNavigate: (index: number) => void;
  onCommit: (value: number) => DirectEditResult;
  format: (value: number) => string;
  onEditingChange?: (editing: boolean) => void;
  onDraftCancelled?: () => void;
}) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(""), [feedback, setFeedback] = useState<Readonly<{ state: WorkingValidationState; findings: readonly string[] }> | null>(null);
  const policy = directDraftPolicy(editing, canEdit);
  useEffect(() => {
    if (!policy.cancel) return;
    queueMicrotask(() => {
      discardRevokedDraft(true, false, () => {
        setEditing(false); setDraft(""); setFeedback({ state: "BLOCKED", findings: [DIRECT_DRAFT_CANCELLED] });
      }, onEditingChange, onDraftCancelled);
    });
  }, [policy.cancel, onEditingChange, onDraftCancelled]);
  const begin = () => { if (!canEdit) return; onSelect(index); setDraft(String(value)); setFeedback(null); setEditing(true); onEditingChange?.(true); };
  const cancel = () => { setEditing(false); setDraft(""); setFeedback(null); onEditingChange?.(false); };
  const commit = () => {
    if (!policy.canSubmit) return false;
    if (!draft.trim()) { setFeedback({ state: "BLOCKED", findings: ["Working value must be supplied."] }); return false; }
    const result = submitDirectDraft(editing, canEdit, Number(draft), onCommit);
    if (!result) return false;
    if (result.status === "blocked") { setFeedback({ state: "BLOCKED", findings: result.findings }); return false; }
    setFeedback({ state: result.validation, findings: result.findings }); setEditing(false); setDraft(""); onEditingChange?.(false); return true;
  };
  if (policy.showInput) return <div className="min-w-28 rounded-lg border border-blue-300 bg-black p-1">
    <input autoFocus aria-label={`Edit cell row ${row} column ${column}`} value={draft} onChange={event => setDraft(event.target.value)} inputMode="decimal" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); cancel(); }
      else if (event.key === "Enter") { event.preventDefault(); if (commit()) onNavigate(index); }
      else if (event.key === "Tab") { event.preventDefault(); if (commit()) onNavigate(index + (event.shiftKey ? -1 : 1)); }
    }} className="w-full rounded border border-blue-400 bg-zinc-950 px-2 py-1 text-right font-mono text-white outline-none" />
    {feedback && <div role="alert" className="mt-1 max-w-64 whitespace-normal px-1 text-[10px] text-amber-200"><strong>{feedback.state}</strong><span className="block">{validationExplanation(feedback.state, feedback.findings)}</span><details><summary>Engineering Detail</summary>{feedback.findings.map(item => <p key={item}>{item}</p>)}</details></div>}
  </div>;
  return <div><button type="button" data-working-cell={index} data-cell-key={cellKey} aria-label={`Cell row ${row} column ${column}${changed ? ", changed" : ""}${canEdit ? ", double-click to edit" : ""}`} onDoubleClick={begin} onPointerDown={event => onSelect(index, event.shiftKey)} onPointerEnter={event => { if (event.buttons === 1) onSelect(index, true); }} onKeyDown={event => {
    if ((event.key === "Enter" || event.key === "F2") && canEdit) { event.preventDefault(); begin(); return; }
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -columnCount : event.key === "ArrowDown" ? columnCount : 0;
    if (step) { event.preventDefault(); onNavigate(index + step); }
  }} className={`w-full min-w-28 rounded-lg border p-2 text-left font-mono ${selected ? "border-blue-300 ring-1 ring-blue-300/40" : changed ? "border-emerald-400/35 bg-emerald-400/10" : "border-zinc-800 bg-zinc-900"}`}>
    {referenceValue !== undefined && <span className="block text-[10px] text-zinc-500">REF {format(referenceValue)}</span>}
    <span className="block">{format(value)}</span>
    {changed && <span className="block text-[9px] text-emerald-300">{value === currentValue ? "CHANGED" : `CURRENT ${format(currentValue)} · CHANGED`}</span>}
  </button>{feedback && <div role="status" className={`mt-1 max-w-64 whitespace-normal text-[10px] ${feedback.state === "VALID" ? "text-emerald-300" : "text-amber-200"}`}><strong>{feedback.state}</strong><span className="ml-1">{validationExplanation(feedback.state, feedback.findings)}</span>{feedback.findings.length > 0 && <details><summary>Engineering Detail</summary>{feedback.findings.map(item => <p key={item}>{item}</p>)}</details>}</div>}</div>;
}
