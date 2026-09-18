"use client";

import type { EngineeringNavigationIndex, EngineeringNavigationMode } from "@/lib/calibration-workshop/engineeringNavigation";

const MODES: readonly Readonly<{ id: EngineeringNavigationMode; label: string }>[] = Object.freeze([
  { id: "all", label: "All Tables" },
  { id: "essentials", label: "Tuning Essentials" },
  { id: "systems", label: "Systems" },
  { id: "evidence", label: "Changed / Evidence" },
]);

export default function EngineeringNavigationControl({ navigation, mode, selectedSystem, onMode, onSystem }: {
  navigation: EngineeringNavigationIndex;
  mode: EngineeringNavigationMode;
  selectedSystem: string | null;
  onMode: (mode: EngineeringNavigationMode) => void;
  onSystem: (system: string | null) => void;
}) {
  return <nav className="my-3 flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3" aria-label="Calibration Workspace engineering navigation">
    {MODES.map(item => <button key={item.id} type="button" onClick={() => onMode(item.id)} className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase ${mode === item.id ? "border-blue-400 text-blue-200" : "border-zinc-700 text-zinc-500 hover:text-zinc-200"}`}>{item.label}</button>)}
    {mode === "systems" && <select aria-label="Engineering system" value={selectedSystem ?? ""} onChange={event => onSystem(event.target.value || null)} className="rounded-lg border border-zinc-700 bg-black px-2 py-1 text-xs">
      <option value="">Choose system</option>
      {navigation.systems.map(system => <option key={system.id} value={system.label}>{system.label} ({system.essentials})</option>)}
    </select>}
    <span className="text-[10px] text-zinc-500">{navigation.counts.ENGINEERING_QUALIFIED} qualified · {navigation.counts.SOURCE_DERIVED_CANDIDATE} candidate · {navigation.counts.UNCLASSIFIED} unclassified</span>
  </nav>;
}
