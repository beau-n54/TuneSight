import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider.ts";
import { parseWorkspaceBootstrapRequest, type WorkspaceBootstrapResponse } from "./workspaceBootstrapContract.ts";
import { resolveSubscriberWorkshopSession } from "./subscriberWorkshopEntry.ts";
import { resolveVehicleOwnedCalibrationEvidence } from "./vehicleOwnedCalibrationEvidence.ts";
import { selectRestoredSubscriberWorkshop } from "./selectRestoredSubscriberWorkshop.ts";
import { maskRetainedWorkspace } from "./sharedWorkspaceDispatch.ts";
import { buildSharedWorkspacePayload, exactWorkspaceDefinition, workspaceCatalogue } from "./sharedWorkspaceAdapter.ts";
import { workspaceUiKey } from "./workspaceRestoration.ts";
import { WORKSPACE_UI_VERSION } from "./workspaceUiVersion.ts";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation.ts";

export type WorkspaceBootstrapOwners = {
  readWorking?(sessionId: string, result: SubscriberCalibrationResult): Promise<import("./workspaceBootstrapContract.ts").InitialDurableWorking>;
  authenticate(): Promise<{ id: string; scope: string } | null>;
  ownsVehicle(ownerId: string, vehicleId: string): Promise<boolean>;
  readSession(id: string, ownerId: string, vehicleId: string): Promise<SubscriberCalibrationResult | null>;
  readLatest(ownerId: string, vehicleId: string, hint?: string): Promise<{ sessionId: string; result: SubscriberCalibrationResult } | null>;
  onTiming?: (phase: string, durationMs: number) => void;
};
/** One admitted session read and one projection. Browser hints never choose a
 * session, Dataset, owner, qualification or evidence layer. No durable writes.
 */
export async function loadSubscriberWorkspace(input: unknown, owners: WorkspaceBootstrapOwners): Promise<WorkspaceBootstrapResponse> {
  const timed = async <T>(phase: string, run: () => T | Promise<T>) => {
    const start = performance.now();
    try { return await run(); } finally { owners.onTiming?.(phase, performance.now() - start); }
  };
  const failure = (code: string, finding: string): WorkspaceBootstrapResponse => ({ status: "unavailable", code, finding });
  try {
    const owner = await timed("auth", owners.authenticate);
    if (!owner) return failure("AUTH_REQUIRED", "Authentication is required.");
    const request = parseWorkspaceBootstrapRequest(input);
    if (!request) return failure("INVALID_REQUEST", "An exact workspace request is required.");
    if (request.ownerScope !== owner.scope) return failure("OWNER_MISMATCH", "The subscriber owner does not match this workspace.");
    if (!await timed("ownership", () => owners.ownsVehicle(owner.id, request.vehicleId))) return failure("VEHICLE_UNAVAILABLE", "Vehicle evidence is unavailable to this subscriber.");
    const candidates = new Set<string>();
    for (const hint of request.hints) {
      const prefix = WORKSPACE_UI_VERSION + ":adaptive:";
      if (!hint.scope.startsWith(prefix)) continue;
      try {
        const scope = JSON.parse(hint.scope.slice(prefix.length));
        if (Array.isArray(scope) && scope[0] === owner.scope && scope[1] === request.vehicleId && scope[3] === "subscriber" &&
          isSubscriberWorkshopSessionId(scope[2])) candidates.add(scope[2]);
      } catch { /* Malformed identity cannot start a candidate read. */ }
    }
    const hintedSession = candidates.size === 1 ? [...candidates][0] : undefined;
    const session = await timed("session", () => resolveSubscriberWorkshopSession({ requestedSession: request.requestedSession,
      ownerId: owner.id, vehicleId: request.vehicleId }, { readSession: owners.readSession,
      readLatest: (ownerId, vehicleId) => owners.readLatest(ownerId, vehicleId, hintedSession), recoverVehicle: async () => null }));
    const context = { ownerId: owner.scope, vehicleId: request.vehicleId, sessionId: session.sessionId ?? null, sourceMode: "subscriber" as const };
    const success = resolveVehicleOwnedCalibrationEvidence({ ownerId: owner.id, vehicleId: request.vehicleId, result: session.result }).workshop;
    if (!success) return { status: session.explicit ? "session_unavailable" : "empty", context,
      finding: session.result?.status !== "workshop_ready" && session.result?.message || (session.explicit
        ? "The exact Calibration session is unavailable. Re-open the Calibration file; no saved or Development evidence was substituted."
        : "Open Calibration File to begin.") };
    let key = request.requestedKey;
    if (key === undefined) {
      const exactScope = workspaceUiKey(context, success.workshop, "adaptive");
      const hints = request.hints.filter(h => h.scope === exactScope);
      if (hints.length > 1) return failure("RESTORATION_AMBIGUOUS", "Saved Table selection is ambiguous; no fallback was selected.");
      if (hints.length) {
        const selected = exactWorkspaceDefinition(success.workshop, hints[0].selection.key);
        if (!selected || selected.definitionRevision !== hints[0].selection.definitionRevision || selected.occurrence !== hints[0].selection.occurrence)
          return failure("RESTORATION_UNAVAILABLE", "Saved Table identity is incompatible; no fallback was selected.");
        key = selected.key;
      }
    }
    // Unknown explicit URLs retain the existing unavailable projection instead of
    // selecting another Table. The client preserves incompatible saved UI state.
    const selected = key === undefined || exactWorkspaceDefinition(success.workshop, key);
    const workshop = await timed("selection", () => maskRetainedWorkspace(selected ? selectRestoredSubscriberWorkshop(success, key) : success.workshop, success));
    const evidence = await timed("projection", () => buildSharedWorkspacePayload(workshop, success, context, key));
    const catalogue = await timed("catalogue", () => workspaceCatalogue(workshop));
    const durableWorking = owners.readWorking && session.sessionId ? await timed("working", () => owners.readWorking!(session.sessionId!, success)) : undefined;
    return { status: "ready", context, workshop: catalogue, evidence, ...(durableWorking ? { durableWorking } : {}) };
  } catch { return failure("WORKSPACE_UNAVAILABLE", "Calibration evidence could not be restored. Retry; no values were substituted."); }
}
