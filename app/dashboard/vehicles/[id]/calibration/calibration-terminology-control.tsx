"use client";

import { useEffect, useState } from "react";
import type { CalibrationTerminologyMode } from "@/lib/calibration-workshop/calibrationTerminology";

const KEY = "tunesight.calibration.terminology-mode";
export function useCalibrationTerminologyMode() {
  const [mode, setMode] = useState<CalibrationTerminologyMode>("standard");
  useEffect(() => { const stored = window.localStorage.getItem(KEY); if (stored === "engineer") queueMicrotask(() => setMode("engineer")); }, []);
  const select = (next: CalibrationTerminologyMode) => { setMode(next); window.localStorage.setItem(KEY, next); };
  return [mode, select] as const;
}

export default function CalibrationTerminologyControl({ mode, onMode }: { mode: CalibrationTerminologyMode; onMode: (mode: CalibrationTerminologyMode) => void }) {
  return <div className="flex rounded-lg border border-zinc-700 p-1" aria-label="Calibration terminology mode">{(["standard", "engineer"] as const).map(item => <button key={item} type="button" onClick={() => onMode(item)} aria-pressed={mode === item} className={`rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${mode === item ? "bg-blue-500/20 text-blue-200" : "text-zinc-500"}`}>{item}</button>)}</div>;
}
