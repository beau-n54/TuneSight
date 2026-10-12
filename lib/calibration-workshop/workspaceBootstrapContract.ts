import type { ProjectionContext, ExactTableSelection } from "./sharedTableProjection.ts";
import type { SharedWorkspacePayload, WorkspaceCatalogue } from "./sharedWorkspaceAdapter.ts";
import { WORKSPACE_UI_VERSION } from "./workspaceUiVersion.ts";

export type WorkspaceManifest = Readonly<{
  ownerScope: string; vehicleId: string; requestedSession?: string | string[]; requestedKey?: string;
}>;
export type WorkspaceSelectionHint = Readonly<{ scope: string; selection: ExactTableSelection }>;
export type WorkspaceBootstrapRequest = WorkspaceManifest & { kind: "workspace"; hints: readonly WorkspaceSelectionHint[] };
export type WorkspaceBootstrapResponse =
  | { status: "ready"; context: ProjectionContext; workshop: WorkspaceCatalogue; evidence: SharedWorkspacePayload }
  | { status: "empty" | "session_unavailable"; context: ProjectionContext; finding: string }
  | { status: "unavailable"; code: string; finding: string };

/** Browser storage supplies a bounded selection hint, never admission authority.
 * Only identifiers cross this boundary: no cells, axes, Working history or values.
 * The server compares the entire scope against freshly admitted session evidence.
 */
export function readWorkspaceSelectionHints(storage: Pick<Storage, "length" | "key" | "getItem">, manifest: WorkspaceManifest): WorkspaceSelectionHint[] {
  if (manifest.requestedKey !== undefined) return [];
  const hints: WorkspaceSelectionHint[] = [], prefix = WORKSPACE_UI_VERSION + ":adaptive:";
  try {
    for (let i = storage.length - 1, checked = 0; i >= 0 && checked < 256 && hints.length < 8; i--, checked++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix) || key.length > 4096) continue;
      const scope = JSON.parse(key.slice(prefix.length));
      if (!Array.isArray(scope) || scope[0] !== manifest.ownerScope || scope[1] !== manifest.vehicleId || scope[3] !== "subscriber" ||
        manifest.requestedSession !== undefined && scope[2] !== manifest.requestedSession) continue;
      const raw = storage.getItem(key);
      if (!raw || raw.length > 96_000) continue;
      const saved = JSON.parse(raw);
      if (saved.version !== WORKSPACE_UI_VERSION || saved.scope !== key || !Array.isArray(saved.workspace?.tabs) || saved.workspace.tabs.length > 12) continue;
      const tabs = saved.workspace.tabs.filter((tab: { id?: unknown }) => tab?.id === saved.workspace.activeId);
      if (tabs.length !== 1) continue;
      const tab = tabs[0];
      if (typeof tab.definitionKey !== "string" || tab.definitionKey.length > 4096 || typeof tab.definitionRevision !== "string" ||
        tab.definitionRevision.length > 4096 || !Number.isSafeInteger(tab.occurrence) || tab.occurrence < 0 || tab.datasetRevision !== scope[5]) continue;
      hints.push({ scope: key, selection: { key: tab.definitionKey, definitionRevision: tab.definitionRevision, occurrence: tab.occurrence } });
    }
  } catch { /* Full UI restoration still reports unreadable storage; no hint is authority. */ }
  return hints;
}

export function parseWorkspaceBootstrapRequest(value: unknown): WorkspaceBootstrapRequest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as WorkspaceBootstrapRequest;
  const bounded = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;
  if (input.kind !== "workspace" || !bounded(input.ownerScope, 64) || !bounded(input.vehicleId, 100) ||
    input.requestedKey !== undefined && !bounded(input.requestedKey, 4096) ||
    input.requestedSession !== undefined && !(typeof input.requestedSession === "string" && input.requestedSession.length <= 256 ||
      Array.isArray(input.requestedSession) && input.requestedSession.length <= 8 && input.requestedSession.every(v => typeof v === "string" && v.length <= 256)) ||
    !Array.isArray(input.hints) || input.hints.length > 8 || input.hints.some(h => !h || !bounded(h.scope, 4096) ||
      !h.selection || !bounded(h.selection.key, 4096) || !bounded(h.selection.definitionRevision, 4096) ||
      !Number.isSafeInteger(h.selection.occurrence) || h.selection.occurrence < 0)) return null;
  return { kind: "workspace", ownerScope: input.ownerScope, vehicleId: input.vehicleId, requestedSession: input.requestedSession,
    requestedKey: input.requestedKey, hints: input.hints.map(h => ({ scope: h.scope, selection: { key: h.selection.key,
      definitionRevision: h.selection.definitionRevision, occurrence: h.selection.occurrence } })) };
}
