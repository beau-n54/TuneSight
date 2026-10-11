import type { WorkingCalibration } from "./workingCalibration.ts";

export type WorkingSaveStatus = "loading" | "saved" | "not-created" | "unsaved" | "failed";
export function hasUnpersistedWorking(working: WorkingCalibration | null, persistedRevision: string | null): boolean {
  return working !== null && working.workingCalibrationRevision !== persistedRevision;
}
export function persistWorkingRevision(working: WorkingCalibration, save: (working: WorkingCalibration) => void): { status: "saved"; revision: string } | { status: "failed"; revision: null } {
  try { save(working); return { status: "saved", revision: working.workingCalibrationRevision }; }
  catch { return { status: "failed", revision: null }; }
}
