import type { SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { buildWorkshopViewModel, type WorkshopViewModel } from "./viewModel.ts";
import { buildCurrentOnlyWorkshopViewModel, type CurrentOnlyWorkshopViewModel } from "./currentOnlyViewModel.ts";
import { calibrationKnowledgeForRelationship } from "../knowledge/publishedCalibrationSemantics.ts";

// Reconstruct admitted session evidence without loading the upload/Definition catalogue.
export function buildSubscriberWorkshop(result: Pick<SubscriberCalibrationSuccess, "material" | "identity" | "digest" | "quarantines" | "editCapabilities">, selectedDefinition?: string | null): WorkshopViewModel | CurrentOnlyWorkshopViewModel {
  const knowledgeRecords = calibrationKnowledgeForRelationship(result.material.current.relationshipRevision);
  if (result.material.reference === null || result.material.comparison === null) return buildCurrentOnlyWorkshopViewModel({ current: result.material.current, quarantines: result.quarantines, editCapabilities: result.editCapabilities, knowledgeRecords, selectedKey: selectedDefinition });
  return buildWorkshopViewModel({ reference: result.material.reference, current: result.material.current, comparison: result.material.comparison, editCapabilities: result.editCapabilities, knowledgeRecords, source: { kind: "subscriber_upload", label: `${result.identity} governed Reference → subscriber Current`, fixtureIdentity: `subscriber-upload:${result.digest}` }, selectedKey: selectedDefinition });
}
