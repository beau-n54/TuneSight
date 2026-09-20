"use client";

import type { ReactNode } from "react";
import { deriveWorkshopLayout, type WorkshopLayoutState } from "@/lib/calibration-workshop/workspaceLayout";

/** The same landmarks and panel ownership for every admitted evidence state. */
export default function SharedCalibrationShell({ header, evidence, controls, navigation, explorer, tabs, table, inspector, working, limitations, panels, onPanels }: {
  header: ReactNode; evidence: ReactNode; controls: ReactNode; navigation: ReactNode;
  explorer: ReactNode; tabs: ReactNode; table: ReactNode; inspector: ReactNode; working: ReactNode; limitations: ReactNode;
  panels: WorkshopLayoutState; onPanels: (state: WorkshopLayoutState) => void;
}) {
  const layout = deriveWorkshopLayout(panels);
  return <main className="min-h-screen min-w-0 bg-black [overflow-wrap:anywhere] px-3 py-5 text-white sm:px-6" data-calibration-shell="universal-u1">
    <div className="mx-auto max-w-[1800px] space-y-4">
      <header aria-label="Calibration Workspace identity" className="bmw-border break-words rounded-2xl bg-zinc-900 p-6">{header}</header>
      <section aria-label="Calibration evidence and capabilities">{evidence}</section>
      <section aria-label="Workspace controls" className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 p-3">
        {controls}
        <button type="button" aria-pressed={panels.focusWorkspace} onClick={() => onPanels({ ...panels, focusWorkspace: !panels.focusWorkspace })} className="rounded border border-blue-400/50 px-3 py-2 text-xs">{panels.focusWorkspace ? "Restore panels" : "Focus Workspace"}</button>
        <button type="button" aria-pressed={!panels.explorerCollapsed} disabled={panels.focusWorkspace} onClick={() => onPanels({ ...panels, explorerCollapsed: !panels.explorerCollapsed })} className={`${panels.explorerCollapsed ? "bmw-border" : "border border-zinc-700"} rounded px-3 py-2 text-xs disabled:opacity-40`}>{panels.explorerCollapsed ? "Show Explorer" : "Hide Explorer"}</button>
        <button type="button" aria-pressed={!panels.inspectorCollapsed} disabled={panels.focusWorkspace} onClick={() => onPanels({ ...panels, inspectorCollapsed: !panels.inspectorCollapsed })} className={`${panels.inspectorCollapsed ? "bmw-border" : "border border-zinc-700"} rounded px-3 py-2 text-xs disabled:opacity-40`}>{panels.inspectorCollapsed ? "Show Inspector" : "Hide Inspector"}</button>
      </section>
      <div>{navigation}</div>
      <div className={`grid min-w-0 gap-4 ${layout.columns}`} data-workspace-columns={layout.columns}>
        {layout.explorerVisible && <aside aria-label="Table Explorer" className="bmw-border flex min-h-0 min-w-0 flex-col rounded-2xl bg-zinc-950 p-4 xl:[contain:size]">{explorer}</aside>}
        <section aria-label="Table workspace" className="bmw-border min-w-0 space-y-4 rounded-2xl bg-zinc-950 p-4 sm:p-5">
          <div aria-label="Multi-Table tabs">{tabs}</div>
          <div aria-label="Table presentation" className="min-w-0 overflow-x-auto">{table}</div>
          <div aria-label="Working and history">{working}</div>
        </section>
        {layout.inspectorVisible && <aside aria-label="Cell Inspector and Raw Representation" className="min-w-0">{inspector}</aside>}
      </div>
      <section aria-label="Workspace limitations" className="bmw-border rounded-2xl bg-zinc-950 p-5 text-sm text-zinc-400">{limitations}</section>
    </div>
  </main>;
}
