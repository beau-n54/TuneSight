"use client";

import type { WorkspaceTabState } from "@/lib/calibration-workshop/workspaceTabs";

export default function WorkspaceTabs({ tabs, activeId, changedKeys, onActivate, onClose, onCloseOthers }: { tabs: readonly WorkspaceTabState[]; activeId: string; changedKeys: ReadonlySet<string>; onActivate: (id: string) => void; onClose: (id: string) => void; onCloseOthers: (id: string) => void }) {
  return <div className="mb-4 flex min-w-0 items-center gap-1 overflow-x-auto border-b border-zinc-800 pb-2" role="tablist" aria-label="Open Calibration Tables">
    {tabs.map(tab => { const changed = changedKeys.has(`${tab.definitionRevision}:${tab.occurrence}`); return <div key={tab.id} className={`flex shrink-0 items-center rounded-t-lg border px-2 ${tab.id === activeId ? "border-blue-400/60 bg-blue-400/10 text-blue-100" : "border-zinc-800 bg-zinc-900 text-zinc-400"}`}>
      <button type="button" role="tab" aria-selected={tab.id === activeId} onClick={() => onActivate(tab.id)} onDoubleClick={() => onCloseOthers(tab.id)} className="max-w-56 truncate px-2 py-2 text-xs font-medium" title={`${tab.title} · Double-click to close other tabs`}>{tab.title}{changed ? <span className="ml-2 text-emerald-300" aria-label="Working changes">●</span> : null}</button>
      <button type="button" onClick={() => onClose(tab.id)} aria-label={`Close ${tab.title}`} className="rounded px-1 text-zinc-500 hover:bg-white/10 hover:text-white">×</button>
    </div>})}
    <span className="px-2 text-sm text-zinc-600" title="Open another Table from Explorer">+</span>
  </div>;
}
