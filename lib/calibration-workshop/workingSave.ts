import type { WorkingCalibration } from "./workingCalibration.ts";

export type WorkingSaveStatus = "loading" | "saved" | "not-created" | "unsaved" | "failed";
/** Durable revisions preserve the complete redo tail as well as active values.
 * The legacy active-value revision alone cannot detect an unsaved undone edit. */
export function hasUnsavedDurableWorking(working: WorkingCalibration | null, saved: WorkingCalibration | null): boolean {
  return working !== null && (saved === null || JSON.stringify(working) !== JSON.stringify(saved));
}
export function hasUnpersistedWorking(working: WorkingCalibration | null, persistedRevision: string | null): boolean {
  return working !== null && working.workingCalibrationRevision !== persistedRevision;
}
export function persistWorkingRevision(working: WorkingCalibration, save: (working: WorkingCalibration) => void): { status: "saved"; revision: string } | { status: "failed"; revision: null } {
  try { save(working); return { status: "saved", revision: working.workingCalibrationRevision }; }
  catch { return { status: "failed", revision: null }; }
}
