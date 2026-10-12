"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CalibrationTerminology, CalibrationTerminologyMode } from "@/lib/calibration-workshop/calibrationTerminology";

const KEY = "tunesight.calibration.terminology-mode";
const CalibrationTerminologyContext = createContext<CalibrationTerminology | null>(null);
export const useCalibrationTerminologyScope = () => useContext(CalibrationTerminologyContext);
export function CalibrationTerminologyScope({ terminology, children }: { terminology: CalibrationTerminology; children: ReactNode }) { return <CalibrationTerminologyContext.Provider value={terminology}>{children}</CalibrationTerminologyContext.Provider>; }
export function useCalibrationTerminologyMode(ownerScope = "legacy") {
  const [mode, setMode] = useState<CalibrationTerminologyMode>("standard");
  const scopedKey = KEY + ":" + ownerScope;
  useEffect(() => { try { const stored = window.localStorage.getItem(scopedKey); queueMicrotask(() => setMode(stored === "engineer" ? "engineer" : "standard")); } catch { /* The in-memory mode remains usable. */ } }, [scopedKey]);
  const select = (next: CalibrationTerminologyMode) => { setMode(next); try { window.localStorage.setItem(scopedKey, next); } catch { /* Working persistence reports its own failure independently. */ } };
  return [mode, select] as const;
}

export default function CalibrationTerminologyControl({ mode, onMode }: { mode: CalibrationTerminologyMode; onMode: (mode: CalibrationTerminologyMode) => void }) {
  return <div className="flex rounded-lg border border-zinc-700 p-1" aria-label="Calibration terminology mode">{(["standard", "engineer"] as const).map(item => <button key={item} type="button" onClick={() => onMode(item)} aria-pressed={mode === item} className={`rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${mode === item ? "bg-blue-500/20 text-blue-200" : "text-zinc-500"}`}>{item}</button>)}</div>;
}
