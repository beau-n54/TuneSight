import type { ProjectionContext, ExactTableSelection } from "./sharedTableProjection.ts";
import type { SharedWorkspaceWorkshop, WorkspaceTableProjection } from "./sharedWorkspaceAdapter.ts";

export type ProjectionRequest = Readonly<{
  context: ProjectionContext;
  currentDatasetId: string; currentDatasetRevision: string; romLayoutId: string;
  relationshipRevision: string; definitionSetRevision: string;
  selection: ExactTableSelection;
}>;
export type ProjectionResponse = { status: "ready"; projection: WorkspaceTableProjection } |
  { status: "unavailable"; code: string; finding: string };
export const unavailableProjection = (code: string, finding: string): ProjectionResponse => ({ status: "unavailable", code, finding });
export function projectionRequest(context: ProjectionContext, workshop: SharedWorkspaceWorkshop, selection: ExactTableSelection): ProjectionRequest {
  const { currentDatasetId, currentDatasetRevision, romLayoutId, relationshipRevision, definitionSetRevision } = workshop.source;
  return { context, currentDatasetId, currentDatasetRevision, romLayoutId, relationshipRevision, definitionSetRevision,
    selection: { key: selection.key, definitionRevision: selection.definitionRevision, occurrence: selection.occurrence } };
}
export function parseProjectionRequest(value: unknown): ProjectionRequest | null {
  if (!value || typeof value !== "object") return null;
  const r = value as ProjectionRequest, c = r.context, s = r.selection;
  if (!c || !s || c.sourceMode !== "subscriber" || !Number.isSafeInteger(s.occurrence) || s.occurrence < 0) return null;
  const strings = [c.ownerId, c.vehicleId, c.sessionId, r.currentDatasetId, r.currentDatasetRevision, r.romLayoutId,
    r.relationshipRevision, r.definitionSetRevision, s.key, s.definitionRevision];
  if (!strings.every(item => typeof item === "string" && item.length > 0 && item.length <= 4096)) return null;
  return { context: { ownerId: c.ownerId, vehicleId: c.vehicleId, sessionId: c.sessionId, sourceMode: "subscriber" },
    currentDatasetId: r.currentDatasetId, currentDatasetRevision: r.currentDatasetRevision, romLayoutId: r.romLayoutId,
    relationshipRevision: r.relationshipRevision, definitionSetRevision: r.definitionSetRevision,
    selection: { key: s.key, definitionRevision: s.definitionRevision, occurrence: s.occurrence } };
}
export const projectionRequestKey = (request: ProjectionRequest) => JSON.stringify([
  request.context.ownerId, request.context.vehicleId, request.context.sessionId, request.context.sourceMode,
  request.currentDatasetId, request.currentDatasetRevision, request.romLayoutId, request.relationshipRevision,
  request.definitionSetRevision, request.selection.key, request.selection.definitionRevision, request.selection.occurrence,
]);
export function projectionMatchesRequest(request: ProjectionRequest, projection: WorkspaceTableProjection): boolean {
  const dataset = projection.slots.current.dataset;
  return Boolean(dataset && projectionRequestKey(request) === projectionRequestKey({ ...request, context: projection.context,
    currentDatasetId: dataset.datasetId, currentDatasetRevision: dataset.datasetRevision, romLayoutId: dataset.romLayoutId,
    relationshipRevision: dataset.relationshipRevision, definitionSetRevision: dataset.definitionSetRevision, selection: projection.selection }));
}

/** Per-mounted-context cache. Explicit open only; no catalogue iteration, prefetch or background fill. */
export function createProjectionCache(load: (request: ProjectionRequest, signal: AbortSignal) => Promise<ProjectionResponse>) {
  const ready = new Map<string, WorkspaceTableProjection>();
  const pending = new Map<string, Promise<ProjectionResponse>>();
  let generation = 0, controller = new AbortController();
  return {
    seed(request: ProjectionRequest, projection: WorkspaceTableProjection) {
      if (projectionMatchesRequest(request, projection)) ready.set(projectionRequestKey(request), projection);
    },
    get(request: ProjectionRequest) { return ready.get(projectionRequestKey(request)); },
    clear() { generation++; controller.abort(); controller = new AbortController(); ready.clear(); pending.clear(); },
    request(request: ProjectionRequest): Promise<ProjectionResponse> {
      const key = projectionRequestKey(request), cached = ready.get(key);
      if (cached) return Promise.resolve({ status: "ready", projection: cached });
      const inflight = pending.get(key); if (inflight) return inflight;
      const epoch = generation, signal = controller.signal;
      const promise = Promise.resolve().then(() => signal.aborted ? unavailableProjection("STALE_RESPONSE", "The workspace context changed.") : load(request, signal)).then(result => {
        if (epoch !== generation) return unavailableProjection("STALE_RESPONSE", "The workspace context changed; this response was discarded.");
        if (result.status === "ready") {
          if (!projectionMatchesRequest(request, result.projection)) return unavailableProjection("IDENTITY_MISMATCH", "Projection identity did not match the exact request.");
          if (ready.size >= 12) ready.delete(ready.keys().next().value!);
          ready.set(key, result.projection);
        }
        return result;
      }).catch(() => unavailableProjection("REQUEST_FAILED", "Table evidence could not be loaded. No values were substituted."))
        .finally(() => { if (epoch === generation) pending.delete(key); });
      pending.set(key, promise); return promise;
    },
  };
}
