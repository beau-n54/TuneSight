import type { SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { buildWorkshopDefinitionDetail, selectWorkshopDefinitionKey } from "./viewModel.ts";

/** Select within an admitted Workshop without rebuilding its Definitions/material.
 * Admission, session ownership/expiry and presentation masking remain with callers. */
export function selectRestoredSubscriberWorkshop(
  result: SubscriberCalibrationSuccess,
  requestedKey?: string | null,
): SubscriberCalibrationSuccess["workshop"] {
  const workshop = result.workshop;
  const currentOnly = "mode" in workshop;
  const key = requestedKey ?? (currentOnly
    ? (workshop.definitions.find(item => item.availability === "current_available") ?? workshop.definitions[0])?.key
    : selectWorkshopDefinitionKey(workshop.definitions));
  const matches = workshop.definitions.filter(item => item.key === key);
  const selected = matches[0];
  if (matches.length !== 1 || !selected || !Number.isSafeInteger(selected.occurrence) || selected.occurrence < 0
    || workshop.definitions.filter(item => item.definitionRevision === selected.definitionRevision
      && item.occurrence === selected.occurrence).length !== 1) {
    throw new Error("Restored Workshop Definition identity is unknown or ambiguous.");
  }

  if (currentOnly) {
    const definition = workshop.definitions.find(item => item.key === key)!;
    return Object.freeze({ ...workshop, selectedDefinition: definition });
  }
  if (workshop.selectedDefinition.summary.key === key) return workshop;

  const summary = workshop.definitions.find(item => item.key === key)!;
  const { reference, current, comparison } = result.material;
  const definition = comparison?.definitions.filter(item => item.definitionRevisionId === summary.definitionRevision)[summary.occurrence];
  if (!reference || !comparison || !definition) {
    throw new Error("Restored Workshop comparison occurrence is unavailable.");
  }
  const referenceRecord = reference.definitions.filter(item => item.definitionRevisionId === summary.definitionRevision)[summary.occurrence] ?? null;
  // The existing detail builder recursively freezes inputs. Copy only the chosen
  // occurrence and its context so it cannot freeze caller-owned admitted evidence.
  const copy = structuredClone({ definition, summary, referenceRecord, context: {
    definitionSetRevision: reference.definitionSetRevisionId,
    romLayoutId: reference.romLayoutId,
    referenceDatasetId: reference.datasetId,
    currentDatasetId: current.datasetId,
    referenceRole: comparison.reference.role,
    currentRole: comparison.modified.role,
    datasetProvenance: [...new Set([...reference.provenance, ...current.provenance])],
    limitations: [...new Set([...reference.limitations, ...current.limitations])],
  } });
  return Object.freeze({ ...workshop, selectedDefinition: buildWorkshopDefinitionDetail(
    copy.definition, undefined, copy.summary, copy.context, copy.referenceRecord,
  ) });
}
