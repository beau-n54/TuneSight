export type PlotPresentation = "reference-current" | "reference-working" | "current" | "working";
export type SurfacePresentation = "reference" | "current" | "working";
export function plotPresentationLabels(presentation: PlotPresentation) {
  const reference = presentation === "reference-current" || presentation === "reference-working";
  const value = presentation === "working" || presentation === "reference-working" ? "Working" : "Current";
  return { reference, value, description: reference ? `Reference and ${value}` : value };
}
export const DIRECT_DRAFT_CANCELLED = "The cell draft was cancelled because the workspace entered review-only mode.";
export function directDraftPolicy(editing: boolean, canEdit: boolean) {
  return { showInput: editing && canEdit, cancel: editing && !canEdit, canSubmit: editing && canEdit };
}
export function discardRevokedDraft(editing: boolean, canEdit: boolean, discard: () => void,
  notifyEditing?: (editing: boolean) => void, notifyCancellation?: () => void) {
  if (!directDraftPolicy(editing, canEdit).cancel) return;
  discard(); notifyEditing?.(false); notifyCancellation?.();
}
export function submitDirectDraft<T>(editing: boolean, canEdit: boolean, value: number, commit: (value: number) => T): T | null {
  return directDraftPolicy(editing, canEdit).canSubmit ? commit(value) : null;
}
