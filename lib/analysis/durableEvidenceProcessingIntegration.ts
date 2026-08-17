import type { LoggerPlatform } from "../logging/types.ts";
import type { EvidencePromotionOperationResult } from "./evidenceCandidatePersistence.ts";
import {
  EvidenceLifecycleWriteError,
  recordEvidencePersistenceFailure,
  recordEvidenceProcessingFailure,
  recordEvidenceProcessingStage,
  recordQualificationTerminal,
  type EvidenceLifecycleContext,
  type EvidenceLifecycleDatabase,
} from "./evidenceLifecyclePersistence.ts";
import type { EvidenceSourceQualification } from "./evidenceSourceQualification.ts";

export type DurableEvidenceAttemptResult = Readonly<{
  status:
    | "confirmed_established"
    | "terminal_failure"
    | "reconciliation_required"
    | "lifecycle_write_failed";
  promotion: EvidencePromotionOperationResult | null;
}>;

export type DurableEvidenceAttemptDependencies<TDerived> = Readonly<{
  lifecycleDatabase: EvidenceLifecycleDatabase;
  lifecycleContext: EvidenceLifecycleContext;
  qualify(): EvidenceSourceQualification;
  derive(
    qualification: Extract<
      EvidenceSourceQualification,
      { kind: "supported_and_usable" }
    >
  ): Promise<TDerived>;
  persist(derived: TDerived): Promise<EvidencePromotionOperationResult>;
}>;

function attemptResult(
  status: DurableEvidenceAttemptResult["status"],
  promotion: EvidencePromotionOperationResult | null = null
): DurableEvidenceAttemptResult {
  return Object.freeze({ status, promotion });
}

async function persistKnownFailure(
  write: () => Promise<void>
): Promise<DurableEvidenceAttemptResult> {
  try {
    await write();
    return attemptResult("terminal_failure");
  } catch (error) {
    if (error instanceof EvidenceLifecycleWriteError) {
      return attemptResult("lifecycle_write_failed");
    }
    throw error;
  }
}

export async function runDurableEvidenceProcessingAttempt<TDerived>(
  dependencies: DurableEvidenceAttemptDependencies<TDerived>
): Promise<DurableEvidenceAttemptResult> {
  const { lifecycleDatabase, lifecycleContext } = dependencies;

  try {
    await recordEvidenceProcessingStage(
      lifecycleDatabase,
      lifecycleContext,
      "source_classification",
      null
    );
  } catch (error) {
    if (error instanceof EvidenceLifecycleWriteError) {
      return attemptResult("lifecycle_write_failed");
    }
    throw error;
  }

  let qualification: EvidenceSourceQualification;
  try {
    qualification = dependencies.qualify();
  } catch {
    return persistKnownFailure(() =>
      recordEvidenceProcessingFailure(
        lifecycleDatabase,
        lifecycleContext,
        "source_classification",
        null
      )
    );
  }

  if (qualification.kind !== "supported_and_usable") {
    return persistKnownFailure(() =>
      recordQualificationTerminal(
        lifecycleDatabase,
        lifecycleContext,
        qualification.outcome,
        qualification.translatedLog.platform
      )
    );
  }

  const loggerPlatform: LoggerPlatform = qualification.translatedLog.platform;
  try {
    await recordEvidenceProcessingStage(
      lifecycleDatabase,
      lifecycleContext,
      "evidence_derivation",
      loggerPlatform
    );
  } catch (error) {
    if (error instanceof EvidenceLifecycleWriteError) {
      return attemptResult("lifecycle_write_failed");
    }
    throw error;
  }

  let derived: TDerived;
  try {
    derived = await dependencies.derive(qualification);
  } catch {
    return persistKnownFailure(() =>
      recordEvidenceProcessingFailure(
        lifecycleDatabase,
        lifecycleContext,
        "evidence_derivation",
        loggerPlatform
      )
    );
  }

  try {
    await recordEvidenceProcessingStage(
      lifecycleDatabase,
      lifecycleContext,
      "evidence_persistence",
      loggerPlatform
    );
  } catch (error) {
    if (error instanceof EvidenceLifecycleWriteError) {
      return attemptResult("lifecycle_write_failed");
    }
    throw error;
  }

  let promotion: EvidencePromotionOperationResult;
  try {
    promotion = await dependencies.persist(derived);
  } catch {
    return persistKnownFailure(() =>
      recordEvidencePersistenceFailure(
        lifecycleDatabase,
        lifecycleContext,
        loggerPlatform
      )
    );
  }

  if (promotion.resolution === "confirmed_established") {
    return attemptResult("confirmed_established", promotion);
  }

  if (promotion.resolution === "reconciliation_required") {
    return attemptResult("reconciliation_required", promotion);
  }

  const terminal = await persistKnownFailure(() =>
    recordEvidencePersistenceFailure(
      lifecycleDatabase,
      lifecycleContext,
      loggerPlatform
    )
  );
  return Object.freeze({ ...terminal, promotion });
}
