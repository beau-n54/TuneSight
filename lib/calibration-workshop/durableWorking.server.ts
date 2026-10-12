import "server-only";
import { createHash } from "node:crypto";
import { createTrustedServerClient } from "../supabase/trustedServer";
import type { SubscriberRequestAuthority } from "../security/subscriberAccess.server";
import { readSubscriberWorkshopSession } from "./subscriberWorkshopSession.server";
import { calibrationSourceIdentity } from "../identity/calibrationIdentity";
import { createWorkingCalibration } from "./workingCalibration";
import { resolveSharedWorkingDefinition, sharedWorkspaceEvidence } from "./sharedWorkspaceAdapter";
import { canonicalWorkingJson, durableWorkingScope, replayDurableWorking, workingSha256,
  DURABLE_WORKING_CONTRACT, type DurableRevisionSummary, type DurableWorkingSnapshot } from "./durableWorking";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation";
import { UUID_PATTERN } from "../security/uploadPolicy";
import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider";

const summaryColumns = "id,sequence,parent_id,previous_head_id,restored_from_id,content_hash,created_at,contract_version,capability_state";
type Row = DurableRevisionSummary & { payload_text: string; scope_id: string };
export type WorkingCandidate = { scope_id: string; identity_text: string; head: Row; history: DurableRevisionSummary[] };
export async function readWorkingCandidate(ownerId: string, vehicleId: string, sessionId: string): Promise<WorkingCandidate[]> {
  const response = await createTrustedServerClient().rpc("read_calibration_working_v1", { p_owner: ownerId, p_vehicle: vehicleId, p_session: sessionId });
  if (response.error || !Array.isArray(response.data) || response.data.length > 1) throw Error("WORKING_STORE_UNAVAILABLE");
  return response.data as WorkingCandidate[];
}
type RequestInput = { action: "read" | "save" | "restore"; vehicleId: string; sessionId: string;
  datasetId: string; datasetRevision: string; expectedHead?: string | null; key?: string; restoreId?: string; working?: unknown };
/** No browser-supplied identity, capability or values become authority. Fresh
 * session/version checks remain mandatory even for history reads and retries. */
export async function durableWorkingRequest(input: unknown, authority: SubscriberRequestAuthority,
  admitted?: { session: SubscriberCalibrationResult; candidate: WorkingCandidate[] }): Promise<DurableWorkingSnapshot> {
  const request = input as RequestInput;
  if (!request || !["read", "save", "restore"].includes(request.action) || !UUID_PATTERN.test(request.vehicleId ?? "") ||
    !isSubscriberWorkshopSessionId(request.sessionId) || typeof request.datasetId !== "string" || typeof request.datasetRevision !== "string") throw Error("WORKING_INVALID_REQUEST");
  const { supabase, user } = authority;
  const vehicle = await supabase.from("vehicles").select("id").eq("id", request.vehicleId).eq("user_id", user.id).maybeSingle();
  if (vehicle.error || !vehicle.data) throw Error("WORKING_SCOPE_UNAVAILABLE");
  const result = admitted?.session ?? await readSubscriberWorkshopSession(request.sessionId, user.id, request.vehicleId);
  if (!result || result.status !== "workshop_ready") throw Error("WORKING_SESSION_UNAVAILABLE");
  const dataset = result.material.current, source = calibrationSourceIdentity(result);
  if (dataset.datasetId !== request.datasetId || dataset.datasetRevision !== request.datasetRevision || !source.containerDigest)
    throw Error("WORKING_SCOPE_MISMATCH");
  const ownerScope = createHash("sha256").update(user.id).digest("hex").slice(0, 24);
  const scope = durableWorkingScope({ ownerId: user.id, vehicleId: request.vehicleId, sessionId: request.sessionId,
    currentDatasetId: dataset.datasetId, currentDatasetRevision: dataset.datasetRevision, romLayoutId: dataset.romLayoutId,
    relationshipRevision: dataset.relationshipRevision, definitionSetRevision: dataset.definitionSetRevisionId,
    sourceDigest: source.engineeringBinaryDigest, containerDigest: source.containerDigest, containerType: result.container,
    sourceBytes: result.byteLength, definitionSourceId: dataset.sourceArtifactId, definitionSourceDigest: dataset.sourceArtifactDigest });
  const context = { ownerId: ownerScope, vehicleId: request.vehicleId, sessionId: request.sessionId, sourceMode: "subscriber" as const };
  const seed = createWorkingCalibration({ ownerScope, vehicleId: request.vehicleId, currentDatasetId: dataset.datasetId,
    currentDatasetRevision: dataset.datasetRevision, romLayoutId: dataset.romLayoutId, relationshipRevision: dataset.relationshipRevision,
    definitionSetRevision: dataset.definitionSetRevisionId, createdAt: new Date().toISOString() });
  const definitions = new Map<string, ReturnType<typeof resolveSharedWorkingDefinition>>();
  const replay = (value: unknown) => replayDurableWorking(value, seed, (revision, occurrence) => {
    const key = JSON.stringify([revision, occurrence]);
    if (!definitions.has(key)) definitions.set(key, resolveSharedWorkingDefinition(result.workshop, sharedWorkspaceEvidence(result), context, revision, occurrence));
    return definitions.get(key);
  });
  if (request.action === "read") {
    const candidates = admitted?.candidate ?? await readWorkingCandidate(user.id, request.vehicleId, request.sessionId);
    if (!candidates.length) return { head: null, working: null, history: [] };
    const candidate = candidates[0], row = candidate.head;
    if (candidate.scope_id !== scope.scopeId || candidate.identity_text !== scope.identityText || !row ||
      row.contract_version !== DURABLE_WORKING_CONTRACT || row.capability_state !== "EDIT_ONLY_OUTPUT_LOCKED" ||
      workingSha256(row.payload_text) !== row.content_hash) throw Error("WORKING_REVISION_INCOMPATIBLE");
    const { id, sequence, parent_id, previous_head_id, restored_from_id, content_hash, created_at, contract_version, capability_state } = row;
    return { head: { id, sequence, parent_id, previous_head_id, restored_from_id, content_hash, created_at, contract_version, capability_state },
      working: replay(JSON.parse(row.payload_text)), history: candidate.history };
  }
  const trusted = createTrustedServerClient();
  const readRevision = async (id: string): Promise<Row> => {
    const response = await trusted.from("calibration_working_revisions").select(summaryColumns + ",payload_text,scope_id")
      .eq("scope_id", scope.scopeId).eq("id", id).single();
    if (response.error || !response.data) throw Error("WORKING_REVISION_UNAVAILABLE");
    const row = response.data as unknown as Row;
    if (row.contract_version !== DURABLE_WORKING_CONTRACT || row.capability_state !== "EDIT_ONLY_OUTPUT_LOCKED" || workingSha256(row.payload_text) !== row.content_hash)
      throw Error("WORKING_REVISION_INCOMPATIBLE");
    return row;
  };
  let savedId: string | null = null;
  {
    if (!UUID_PATTERN.test(request.key ?? "") || request.expectedHead !== null && !UUID_PATTERN.test(request.expectedHead ?? "") ||
      request.action === "restore" && !UUID_PATTERN.test(request.restoreId ?? "")) throw Error("WORKING_INVALID_REQUEST");
    const historic = request.action === "restore" ? await readRevision(request.restoreId!) : null;
    const accepted = replay(historic ? JSON.parse(historic.payload_text) : request.working);
    const payload = canonicalWorkingJson(accepted);
    const hash = workingSha256(canonicalWorkingJson({ expected: request.expectedHead, restore: request.restoreId ?? null, payload }));
    const saved = await trusted.rpc("save_calibration_working_v1", { p_owner: user.id, p_vehicle: request.vehicleId,
      p_session: request.sessionId, p_identity: scope.identityText, p_expected: request.expectedHead,
      p_parent: historic?.id ?? request.expectedHead, p_restore: historic?.id ?? null, p_key: request.key, p_request_hash: hash, p_payload: payload });
    if (saved.error) {
      const code = /WORKING_[A-Z_]+/.exec(saved.error.message)?.[0];
      throw Error(code ?? "WORKING_SAVE_UNCERTAIN");
    }
    const receipt = Array.isArray(saved.data) ? saved.data.length === 1 ? saved.data[0] : null : saved.data;
    savedId = receipt?.id ?? null;
    if (!savedId || !UUID_PATTERN.test(savedId)) throw Error("WORKING_SAVE_UNCERTAIN");
  }
  const scoped = await trusted.from("calibration_working_scopes").select("head_id").eq("scope_id", scope.scopeId).eq("owner_id", user.id).maybeSingle();
  if (scoped.error) throw Error("WORKING_STORE_UNAVAILABLE");
  if (!scoped.data) throw Error("WORKING_SAVE_UNCERTAIN");
  if (savedId && scoped.data.head_id !== savedId) throw Error("WORKING_HEAD_CONFLICT");
  const head = scoped.data.head_id ? await readRevision(scoped.data.head_id) : null;
  const history = await trusted.from("calibration_working_revisions").select(summaryColumns).eq("scope_id", scope.scopeId).order("sequence", { ascending: false }).limit(128);
  if (history.error || !head) throw Error("WORKING_STORE_UNAVAILABLE");
  const { payload_text, scope_id: _scope, ...summary } = head; void _scope;
  return { head: summary, working: replay(JSON.parse(payload_text)), history: history.data as DurableRevisionSummary[] };
}
