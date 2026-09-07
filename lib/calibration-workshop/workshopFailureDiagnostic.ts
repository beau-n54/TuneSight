export const WORKSHOP_FAILURE_STAGES = ["RESOURCE_RESOLUTION", "AUTHORITY_LAYOUT", "RELATIONSHIP_MEMBERSHIP", "DEFINITION_SET_BINDING", "BINARY_IDENTITY", "REFERENCE_DATASET", "CURRENT_DATASET", "COMPARISON", "VIEW_MODEL", "UNKNOWN"] as const;
export type WorkshopFailureStage = (typeof WORKSHOP_FAILURE_STAGES)[number];
export type WorkshopFailureClassification = "RESOURCE_MISSING" | "RESOURCE_ACCESS_DENIED" | "MEMORY_LIMIT" | "GOVERNANCE_REJECTION" | "STAGE_FAILURE";
export type PublicWorkshopFailureDiagnostic = Readonly<{ errorId: string; stage: WorkshopFailureStage; classification: WorkshopFailureClassification; elapsedMs: number; completedStageTimings: Readonly<Partial<Record<WorkshopFailureStage, number>>> }>;

export class WorkshopFailureDiagnosticError extends Error {
  readonly diagnostic: PublicWorkshopFailureDiagnostic;
  constructor(diagnostic: PublicWorkshopFailureDiagnostic, cause: unknown) { super(`Calibration Workshop failed at ${diagnostic.stage}.`, { cause }); this.name = "WorkshopFailureDiagnosticError"; this.diagnostic = diagnostic; }
}

function classification(error: unknown): WorkshopFailureClassification {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "ENOENT") return "RESOURCE_MISSING";
  if (code === "EACCES" || code === "EPERM") return "RESOURCE_ACCESS_DENIED";
  if (error instanceof RangeError) return "MEMORY_LIMIT";
  if (error instanceof Error && /authority|relationship|dataset|comparison|definition|layout|fixture/i.test(error.message)) return "GOVERNANCE_REJECTION";
  return "STAGE_FAILURE";
}

export class WorkshopDiagnosticTrace {
  private readonly started = performance.now();
  private readonly timings: Partial<Record<WorkshopFailureStage, number>> = {};
  run<T>(stage: WorkshopFailureStage, operation: () => T, safeFailureCode?: string): T {
    const started = performance.now();
    try { const result = operation(); this.timings[stage] = Math.round((this.timings[stage] ?? 0) + performance.now() - started); return result; }
    catch (error) { throw this.wrap(stage, error, safeFailureCode); }
  }
  wrap(stage: WorkshopFailureStage, error: unknown, safeFailureCode?: string): WorkshopFailureDiagnosticError {
    if (error instanceof WorkshopFailureDiagnosticError) return error;
    const kind = classification(error), code = safeFailureCode && /^[A-Z][A-Z0-9_]*$/.test(safeFailureCode) ? safeFailureCode : kind;
    const diagnostic = Object.freeze({ errorId: `CW-${stage}-${code}`, stage, classification: kind, elapsedMs: Math.round(performance.now() - this.started), completedStageTimings: Object.freeze({ ...this.timings }) });
    return new WorkshopFailureDiagnosticError(diagnostic, error);
  }
}

export function publicWorkshopFailureDiagnostic(error: unknown): PublicWorkshopFailureDiagnostic {
  return error instanceof WorkshopFailureDiagnosticError ? error.diagnostic : Object.freeze({ errorId: "CW-UNKNOWN-STAGE_FAILURE", stage: "UNKNOWN", classification: "STAGE_FAILURE", elapsedMs: 0, completedStageTimings: Object.freeze({}) });
}
