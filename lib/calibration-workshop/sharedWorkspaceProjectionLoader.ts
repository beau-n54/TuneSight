import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider.ts";
import { compactWorkspaceProjection, projectWorkspaceTable, sharedWorkspaceEvidence } from "./sharedWorkspaceAdapter.ts";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation.ts";
import { parseProjectionRequest, projectionMatchesRequest, unavailableProjection, type ProjectionResponse } from "./sharedWorkspaceProjectionRequest.ts";

export type ProjectionBoundaryOwners = {
  authenticate(): Promise<{ id: string; scope: string } | null>;
  ownsVehicle(ownerId: string, vehicleId: string): Promise<boolean>;
  readSession(sessionId: string, ownerId: string, vehicleId: string): Promise<SubscriberCalibrationResult | null>;
  project?: typeof projectWorkspaceTable;
  onTiming?: (phase: "auth" | "ownership" | "session" | "projection", durationMs: number) => void;
};
/** The route supplies real auth, ownership and durable reads; tests substitute only those owner boundaries. */
export async function loadSubscriberTableProjection(input: unknown, owners: ProjectionBoundaryOwners): Promise<ProjectionResponse> {
  const timed = async <T>(phase: "auth" | "ownership" | "session", operation: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try { return await operation(); } finally { owners.onTiming?.(phase, performance.now() - start); }
  };
  try {
    const owner = await timed("auth", () => owners.authenticate());
    if (!owner) return unavailableProjection("AUTH_REQUIRED", "Authentication is required.");
    const request = parseProjectionRequest(input);
    if (!request || !isSubscriberWorkshopSessionId(request.context.sessionId)) return unavailableProjection("INVALID_REQUEST", "An exact subscriber Table identity is required.");
    if (owner.scope !== request.context.ownerId) return unavailableProjection("OWNER_MISMATCH", "The subscriber owner does not match this workspace.");
    if (!await timed("ownership", () => owners.ownsVehicle(owner.id, request.context.vehicleId))) return unavailableProjection("VEHICLE_UNAVAILABLE", "Vehicle evidence is unavailable to this subscriber.");
    const result = await timed("session", () => owners.readSession(request.context.sessionId!, owner.id, request.context.vehicleId));
    if (!result || result.status !== "workshop_ready") return unavailableProjection("SESSION_UNAVAILABLE", "The exact subscriber session is unavailable or expired.");
    const dataset = result.material.current;
    if (request.currentDatasetId !== dataset.datasetId || request.currentDatasetRevision !== dataset.datasetRevision ||
      request.romLayoutId !== dataset.romLayoutId || request.relationshipRevision !== dataset.relationshipRevision ||
      request.definitionSetRevision !== dataset.definitionSetRevisionId) return unavailableProjection("DATASET_MISMATCH", "The admitted Dataset or qualification revisions changed.");
    const matches = result.workshop.definitions.filter(item => item.key === request.selection.key &&
      item.definitionRevision === request.selection.definitionRevision && item.occurrence === request.selection.occurrence);
    if (matches.length !== 1 || result.workshop.definitions.filter(item => item.key === request.selection.key).length !== 1 ||
      result.workshop.definitions.filter(item => item.definitionRevision === request.selection.definitionRevision && item.occurrence === request.selection.occurrence).length !== 1)
      return unavailableProjection("DEFINITION_UNAVAILABLE", "The exact Definition revision, key and occurrence are unknown or ambiguous.");
    const projectionStart = performance.now();
    const projection = (owners.project ?? projectWorkspaceTable)(result.workshop, sharedWorkspaceEvidence(result), request.context, matches[0].key);
    if (!projectionMatchesRequest(request, projection)) return unavailableProjection("IDENTITY_MISMATCH", "The projected owner identity does not match the admitted session.");
    if (projection.slots.current.state !== "available" || projection.slots.reference.state === "quarantined")
      return unavailableProjection("EVIDENCE_UNAVAILABLE", "The exact Table evidence is unavailable or quarantined. No values were substituted.");
    const compact = compactWorkspaceProjection(projection);
    owners.onTiming?.("projection", performance.now() - projectionStart);
    return { status: "ready", projection: compact };
  } catch {
    return unavailableProjection("MATERIALIZATION_FAILED", "The exact Table could not be materialized. No fallback was selected.");
  }
}
