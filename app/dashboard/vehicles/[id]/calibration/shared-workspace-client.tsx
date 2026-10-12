"use client";

import { hasUnpersistedWorking, hasUnsavedDurableWorking, persistWorkingRevision, type WorkingSaveStatus } from "@/lib/calibration-workshop/workingSave";
import { createDurableWorkingClient } from "@/lib/calibration-workshop/durableWorkingClient";
import type { DurableWorkingSnapshot } from "@/lib/calibration-workshop/durableWorking";
import { planWorkingToolbar, selectedRectangle, MAX_MATRIX_CHARACTERS } from "@/lib/calibration-workshop/qualifiedEditing";
import { workingCellValue, type WorkingEditInput, type WorkingEditPreview } from "@/lib/calibration-workshop/workingCalibration";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { currentRendererDefinition, exactWorkspaceDefinition,
  resolveProjectedWorkingDefinition, type SharedWorkspacePayload, type WorkspaceCatalogue } from "@/lib/calibration-workshop/sharedWorkspaceAdapter";
import { createProjectionCache, projectionRequest, type ProjectionResponse } from "@/lib/calibration-workshop/sharedWorkspaceProjectionRequest";
import { pendingTransitionAllowed, recognizedReviewDevice } from "@/lib/calibration-workshop/sharedWorkspacePolicy";
import type { ProjectionContext } from "@/lib/calibration-workshop/sharedTableProjection";
import { requestWorkspaceTab, workspaceInteractionPolicy } from "@/lib/calibration-workshop/sharedWorkspacePolicy";
import { activateWorkspaceTab, closeOtherWorkspaceTabs, closeWorkspaceTab, createWorkspaceTab,
  updateActiveWorkspaceTab, type WorkspaceTabsState } from "@/lib/calibration-workshop/workspaceTabs";
import { applyWorkingEdit, createWorkingCalibration, previewWorkingEdit, redoWorkingEdit, undoWorkingEdit,
  workingChangedDefinitionKeys, type WorkingCalibration, type WorkingDefinitionSeed } from "@/lib/calibration-workshop/workingCalibration";
import { createBrowserWorkingCalibrationStore, workingCalibrationStorageKey, workingRestoreDefinitions } from "@/lib/calibration-workshop/workingCalibrationPersistence";
import { buildEngineeringNavigationIndex, filterEngineeringNavigation, engineeringNavigationEmptyState,
  type EngineeringNavigationMode } from "@/lib/calibration-workshop/engineeringNavigation";
import { calibrationTableLabel } from "@/lib/calibration-workshop/calibrationTerminology";
import { restoreWorkspaceUi, serializeWorkspaceUi, workspaceUiKey } from "@/lib/calibration-workshop/workspaceRestoration";
import { buildSharedTablePresentation } from "@/lib/calibration-workshop/sharedTablePresentation";
import SharedCalibrationShell from "./shared-calibration-shell";
import { SharedEvidenceStrip } from "./shared-evidence-strip";
import { Grid, Inspector, TableEvidenceFilter } from "./workshop-client";

import CalibrationPlot2D from "./CalibrationPlot2D";
import CalibrationSurface3D from "./CalibrationSurface3D";
import CalibrationTerminologyControl, { CalibrationTerminologyScope, useCalibrationTerminologyMode } from "./calibration-terminology-control";
import EngineeringNavigationControl from "./engineering-navigation-control";
import WorkspaceTabs from "./workspace-tabs";
import WorkingCalibrationPanel, { type CalibrationDisplayMode } from "./working-calibration-panel";
import IdentityOwnerSummary from "@/components/IdentityOwnerSummary";

export type WorkspaceVehicle = Readonly<{ id: string; nickname: string | null; year: number | null; make: string | null; model: string | null; engine_code: string | null }>;
const button = "rounded border border-zinc-700 px-3 py-2 text-xs disabled:opacity-40";
const editingMedia = "(min-width: 900px) and (pointer: fine)";
function subscribeDisplay(callback: () => void) {
  const media = window.matchMedia(editingMedia);
  media.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  window.addEventListener("focus", callback);
  return () => { media.removeEventListener("change", callback); window.removeEventListener("resize", callback); window.removeEventListener("focus", callback); };
}
function Header({ vehicle, context, evidence, upload, onNavigate }: { onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void; vehicle: WorkspaceVehicle; context: ProjectionContext; evidence?: SharedWorkspacePayload; upload: ReactNode }) {
  return <><a onClick={onNavigate} href={`/dashboard/vehicles/${vehicle.id}`} className="text-xs text-zinc-400">← Back to Vehicle</a>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-blue-300">Calibration Workspace</p>
      <h1 className="mt-1 text-3xl font-bold">{vehicle.nickname || "Unnamed Vehicle"}</h1>
      <p className="text-sm text-zinc-400">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.engine_code || "Engine unknown"}</p>
      <IdentityOwnerSummary vehicle={vehicle} calibration={evidence?.sourceIdentity}/></div>{upload}</div>
    {context.sourceMode === "development_fixture" && <p role="status" className="mt-3 rounded border border-amber-400/35 p-3 text-sm text-amber-200">Development Evidence Preview · {evidence?.identity}. Controlled interface evidence; not derived from this vehicle. No subscriber Calibration was substituted.</p>}
    <details className="mt-3 text-xs"><summary className="cursor-pointer">Exact workspace identity</summary><dl className="mt-2 space-y-2 break-all font-mono">
      {Object.entries({ "Owner scope": context.ownerId, Vehicle: context.vehicleId, Session: context.sessionId ?? "No active session", Source: context.sourceMode,
        "Current Dataset": evidence?.projection?.slots.current.dataset?.datasetId ?? "Not established", "Current Dataset revision": evidence?.projection?.slots.current.dataset?.datasetRevision ?? "Not established",
        "ROM/software": evidence?.identity ?? "Not established", Container: evidence?.container ?? "Not established", Bytes: evidence?.byteLength ?? "Not established" }).map(([label, value]) => <div key={label}><dt className="text-zinc-500">{label}</dt><dd>{value}</dd></div>)}
    </dl></details></>;
}

export function EmptySharedWorkspace({ vehicle, context, reason, upload }: { vehicle: WorkspaceVehicle; context: ProjectionContext; reason: string; upload: ReactNode }) {
  const [panels, setPanels] = useState({ explorerCollapsed: false, inspectorCollapsed: false, focusWorkspace: false });
  const [mode, setMode] = useCalibrationTerminologyMode(context.ownerId);
  return <SharedCalibrationShell header={<Header vehicle={vehicle} context={context} upload={upload}/>} evidence={<SharedEvidenceStrip projection={null} reason={reason}/>}
    controls={<CalibrationTerminologyControl mode={mode} onMode={setMode}/>} panels={panels} onPanels={setPanels}
    navigation={<EngineeringNavigationControl navigation={buildEngineeringNavigationIndex([])} mode="all" selectedSystem={null} onMode={() => {}} onSystem={() => {}}/>}
    explorer={<p className="text-sm text-zinc-400">No authorised Tables available.</p>} tabs={<p className="text-xs text-zinc-500">No open Tables</p>}
    table={<><h2>No Current Calibration loaded</h2><p role="status" className="mt-2 text-sm text-zinc-400">{reason}</p><div className="mt-3 flex gap-2">{["Grid", "2D", "3D"].map(view => <button key={view} type="button" disabled className={button}>{view}</button>)}</div></>}
    inspector={<p className="bmw-border rounded-2xl bg-zinc-950 p-5 text-sm text-zinc-400">Cell Inspector · Raw Representation unavailable.</p>}
    working={<p className="text-sm text-zinc-400">Working Calibration and history require an exact authorised Current Dataset.</p>}
    limitations="No evidence or numeric values have been substituted. Open Calibration File to begin."/>;
}

export default function SharedWorkspaceClient({ workshop, evidence, context, vehicle, requestedKey, upload, onInteractive, initialWorking }: {
  initialWorking?: import("@/lib/calibration-workshop/workspaceBootstrapContract").InitialDurableWorking;
  workshop: WorkspaceCatalogue; evidence: SharedWorkspacePayload; context: ProjectionContext; vehicle: WorkspaceVehicle; requestedKey?: string; upload: ReactNode; onInteractive?: (workspaceMs: number) => void;
}) {
  const [mountedAt] = useState(() => performance.now());
  const [workspace, setWorkspace] = useState<WorkspaceTabsState>(() => {
    const selected = exactWorkspaceDefinition(workshop, requestedKey);
    if (!selected) return { tabs: [], activeId: "" };
    const tab = createWorkspaceTab({ definitionKey: selected.key, definitionRevision: selected.definitionRevision, occurrence: selected.occurrence, title: selected.title, datasetRevision: workshop.source.currentDatasetRevision });
    return { tabs: [tab], activeId: tab.id };
  });
  const cache = useMemo(() => {
    const instance = createProjectionCache(async (request, signal) => {
      const response = await fetch("/api/calibration-workshop/projection", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal });
      return await response.json() as ProjectionResponse;
    });
    if (evidence.projection) instance.seed(projectionRequest(context, workshop, evidence.projection.selection), evidence.projection);
    return instance;
  }, [context, workshop, evidence]);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; if (evidence.projection) cache.seed(projectionRequest(context, workshop, evidence.projection.selection), evidence.projection); return () => { mounted.current = false; cache.clear(); }; }, [cache, context, evidence, workshop]);
  const [loaded, setLoaded] = useState<Record<string, ProjectionResponse | { status: "loading" }>>(() => evidence.projection
    ? { [evidence.projection.selection.key]: { status: "ready", projection: evidence.projection } } : {});
  const loadTable = useCallback((key: string) => {
    const selected = exactWorkspaceDefinition(workshop, key);
    if (!selected) return;
    if (context.sourceMode === "development_fixture") {
      const url = new URL(window.location.href); url.searchParams.set("definition", key); window.location.assign(url.href); return;
    }
    const request = projectionRequest(context, workshop, selected), cached = cache.get(request);
    if (cached) { setLoaded(previous => ({ ...previous, [key]: { status: "ready", projection: cached } })); return; }
    setLoaded(previous => ({ ...previous, [key]: { status: "loading" } }));
    void cache.request(request).then(result => {
      if (mounted.current && !(result.status === "unavailable" && result.code === "STALE_RESPONSE"))
        setLoaded(previous => key in previous ? { ...previous, [key]: result } : previous);
    });
  }, [workshop, context, cache]);
  const [panels, setPanels] = useState({ explorerCollapsed: false, inspectorCollapsed: false, focusWorkspace: false });
  const [mode, setMode] = useCalibrationTerminologyMode(context.ownerId);
  const [search, setSearch] = useState(""), [navigationMode, setNavigationMode] = useState<EngineeringNavigationMode>("all");
  const [system, setSystem] = useState<string | null>(null), [evidenceFilter, setEvidenceFilter] = useState("all");
  const [working, setWorking] = useState<WorkingCalibration | null>(null), [displayMode, setDisplayMode] = useState<CalibrationDisplayMode>("current");
  const [saveStatus, setSaveStatus] = useState<WorkingSaveStatus>("loading");
  const [pendingCells, setPendingCells] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const displayEditing = useSyncExternalStore(subscribeDisplay, () => window.matchMedia(editingMedia).matches && !recognizedReviewDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), () => false);
  const panelScope = "tunesight.workspace-panels.v1:" + encodeURIComponent(context.ownerId) + (displayEditing ? ":desktop" : ":review");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = window.localStorage.getItem(panelScope), value = raw ? JSON.parse(raw) : null;
        const valid = value && typeof value.explorerCollapsed === "boolean" && typeof value.inspectorCollapsed === "boolean";
        setPanels(previous => ({ ...previous, explorerCollapsed: valid ? value.explorerCollapsed : false, inspectorCollapsed: valid ? value.inspectorCollapsed : false }));
      } catch { setNotice("Panel preferences could not be restored; normal workspace controls remain available."); }
    });
    return () => { active = false; };
  }, [panelScope]);
  const changePanels = (next: typeof panels) => {
    setPanels(next);
    try { window.localStorage.setItem(panelScope, JSON.stringify({ explorerCollapsed: next.explorerCollapsed, inspectorCollapsed: next.inspectorCollapsed })); }
    catch { setNotice("Panel preference not saved; this window retains the selected layout."); }
  };
  const interaction = workspaceInteractionPolicy(displayEditing ? 1024 : 0, displayEditing);
  const active = workspace.tabs.find(tab => tab.id === workspace.activeId) ?? null;
  const updateTab = (update: Parameters<typeof updateActiveWorkspaceTab>[1]) => setWorkspace(state => updateActiveWorkspaceTab(state, update));
  const source = workshop.source;
  const seed = useCallback(() => createWorkingCalibration({ ownerScope: context.ownerId, vehicleId: context.vehicleId,
    currentDatasetId: source.currentDatasetId, currentDatasetRevision: source.currentDatasetRevision, romLayoutId: source.romLayoutId,
    relationshipRevision: source.relationshipRevision, definitionSetRevision: source.definitionSetRevision, createdAt: new Date().toISOString() }), [context, source]);
  const [persistedRevision, setPersistedRevision] = useState<string | null>(null);
  const durable = useMemo(() => context.sourceMode === "subscriber" && context.sessionId ? createDurableWorkingClient({
    vehicleId: context.vehicleId, sessionId: context.sessionId, datasetId: source.currentDatasetId, datasetRevision: source.currentDatasetRevision,
  }) : null, [context, source]);
  const [savedHistory, setSavedHistory] = useState<DurableWorkingSnapshot>({ head: null, working: null, history: [] });
  const [legacyWorking, setLegacyWorking] = useState<WorkingCalibration | null>(null);
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [uiRestored, setUiRestored] = useState(false);
  const uiScope = workspaceUiKey(context, workshop, "adaptive");
  const unsaved = useMemo(() => durable ? hasUnsavedDurableWorking(working, savedHistory.working) : hasUnpersistedWorking(working, persistedRevision), [durable, working, savedHistory.working, persistedRevision]);
  const visibleSaveStatus: WorkingSaveStatus = unsaved ? (saveStatus === "failed" ? "failed" : "unsaved") : saveStatus;
  const acceptSnapshot = (snapshot: DurableWorkingSnapshot) => {
    setSavedHistory(snapshot); setWorking(snapshot.working); setPersistedRevision(snapshot.working?.workingCalibrationRevision ?? null);
    setSaveStatus(snapshot.working ? "saved" : "not-created"); setDisplayMode(snapshot.working ? "working" : "current");
  };
  const saveDurable = async (restoreId?: string) => {
    if (!durable || !working || savePending.current || !guardPending()) return;
    savePending.current = true; setSaving(true);
    try {
      const snapshot = await (durable.uncertain ? durable.retry() : durable.request(restoreId ? { action: "restore", restoreId, expectedHead: savedHistory.head?.id ?? null }
        : { action: "save", working, expectedHead: savedHistory.head?.id ?? null }));
      if (mounted.current) acceptSnapshot(snapshot);
    } catch (error) { if (mounted.current) { setSaveStatus("failed"); setNotice(error instanceof Error ? error.message : "Working save failed; retry."); } }
    finally { savePending.current = false; if (mounted.current) setSaving(false); }
  };
  const retryLocalSave = () => { if (durable) { if (working) void saveDurable(); else window.location.reload(); return; }
    if (!working) { window.location.reload(); return; } setSaveAttempt(attempt => attempt + 1); };
  useEffect(() => {
    let active = true;
    queueMicrotask(async () => {
      if (!active) return;
      try {
        const current = seed();
        if (initialWorking?.status === "unavailable") throw Error("Durable Working is unavailable; existing history is preserved.");
        const server = initialWorking?.status === "ready" ? initialWorking.snapshot : durable ? await durable.request({ action: "read" }) : null;
        if (!active) return;
        const resolved = new Map<string, WorkingDefinitionSeed>();
        for (const identity of workingRestoreDefinitions(window.localStorage, current)) {
          const matches = workshop.definitions.filter(item => item.definitionRevision === identity.definitionRevision && item.occurrence === identity.occurrence);
          if (matches.length !== 1) throw Error("Working history Definition is unresolved.");
          const response = await cache.request(projectionRequest(context, workshop, matches[0]));
          if (!active) return;
          if (response.status !== "ready") throw Error("Working history evidence could not be restored.");
          resolved.set(JSON.stringify([identity.definitionRevision, identity.occurrence]), resolveProjectedWorkingDefinition(workshop, response.projection));
        }
        const resolveDefinition = (revision: string, occurrence: number) => resolved.get(JSON.stringify([revision, occurrence]));
        const legacy = createBrowserWorkingCalibrationStore(window.localStorage, true).load(current, current, resolveDefinition);
        const restored = server?.working ?? legacy;
        if (server) { setSavedHistory(server); setLegacyWorking(legacy); }
        setPersistedRevision(server ? server.working?.workingCalibrationRevision ?? null : restored?.workingCalibrationRevision ?? null);
        setWorking(restored);
        setDisplayMode(restored ? "working" : "current");
        setSaveStatus(restored ? server && !server.working ? "unsaved" : "saved" : "not-created");
        if (server && legacy && legacy.workingCalibrationRevision !== server.working?.workingCalibrationRevision)
          setNotice("Existing browser Working is preserved. Save explicitly to import it; a different durable head is never overwritten automatically.");
        try {
        const ui = restoreWorkspaceUi(window.localStorage.getItem(uiScope), uiScope, workshop, requestedKey, Boolean(restored), evidence.referenceAvailable);
        if (ui.state) {
          setWorkspace(ui.state.workspace); setSearch(ui.state.search); setNavigationMode(ui.state.navigationMode); setSystem(ui.state.system);
          setEvidenceFilter(ui.state.evidenceFilter); setDisplayMode(ui.state.displayMode);
          setPanels(previous => ({ ...previous, focusWorkspace: window.sessionStorage.getItem(uiScope + ":focus") === "true" }));
          const tab = ui.state.workspace.tabs.find(item => item.id === ui.state!.workspace.activeId);
          if (tab && tab.definitionKey !== evidence.projection?.selection.key) loadTable(tab.definitionKey);
        } else if (ui.finding && requestedKey === undefined) setWorkspace({ tabs: [], activeId: "" });
        if (ui.finding) setNotice(ui.finding);
        setUiRestored(!ui.preserveSaved);
        } catch { setNotice("Workspace preferences could not be restored. Working history remains separate."); }

      } catch { setSaveStatus("failed"); }
    });
    return () => { active = false; };
  }, [seed, cache, context, uiScope, workshop, requestedKey, evidence, loadTable, durable, initialWorking]);
  useEffect(() => {
    if (durable || !working || working.workingCalibrationRevision === persistedRevision) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const save = () => {
        if (!active) return;
        const result = persistWorkingRevision(working, value => createBrowserWorkingCalibrationStore(window.localStorage, true).save(value, persistedRevision));
        if (result.status === "saved") setPersistedRevision(result.revision);
        setSaveStatus(result.status);
      };
      if (navigator.locks) void navigator.locks.request(workingCalibrationStorageKey(working), save).catch(() => { if (active) setSaveStatus("failed"); });
      else save();
    });
    return () => { active = false; };
  }, [working, persistedRevision, saveAttempt, durable]);
  useEffect(() => {
    if (!unsaved && !(pendingCells.size > 0 || workspace.tabs.some(tab => tab.operand.trim()))) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [unsaved, pendingCells, workspace.tabs]);
  useEffect(() => {
    if (!uiRestored) return;
    try {
      window.localStorage.setItem(uiScope, serializeWorkspaceUi(uiScope, { workspace, search, navigationMode, system, evidenceFilter, displayMode, panels }));
      window.sessionStorage.setItem(uiScope + ":focus", String(panels.focusWorkspace));
    } catch { queueMicrotask(() => setNotice("Workspace preferences could not be saved. Working history uses its separate storage status.")); }
  }, [uiRestored, uiScope, workspace, search, navigationMode, system, evidenceFilter, displayMode, panels]);
  const activeKey = active?.definitionKey;
  const activeEvidence = activeKey ? loaded[activeKey] : undefined;
  const projection = activeEvidence?.status === "ready" ? activeEvidence.projection : null;
  const currentDetail = useMemo(() => projection ? currentRendererDefinition(workshop, projection) : null, [workshop, projection]);
  const tableModel = useMemo(() => projection ? buildSharedTablePresentation(projection, working, displayMode, mode) : null, [projection, working, displayMode, mode]);
  const visual = tableModel?.visual ?? null, views = tableModel?.views ?? null, terminology = tableModel?.terminology ?? null;
  const navigation = useMemo(() => buildEngineeringNavigationIndex(workshop.definitions), [workshop]);
  const changedKeys = useMemo(() => new Set(working ? workingChangedDefinitionKeys(working) : []), [working]);
  const definitions = filterEngineeringNavigation(navigation, { mode: navigationMode, system, query: search }).filter(({ definition }) => {
    if (evidenceFilter === "working") return changedKeys.has(`${definition.definitionRevision}:${definition.occurrence}`);
    if (evidenceFilter === "reference") return "changedCellCount" in definition && definition.changedCellCount > 0;
    if (evidenceFilter === "unavailable") return !definition.available;
    return true;
  });
  const explorerList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = explorerList.current;
    if (!list) return;
    // Scroll only this list, never the page or the table workspace.
    const revealSelection = () => {
      const selected = list.querySelector<HTMLElement>('[aria-current="true"]');
      if (!selected) return;
      const row = selected.getBoundingClientRect(), viewport = list.getBoundingClientRect();
      if (row.top < viewport.top) list.scrollTop += row.top - viewport.top;
      else if (row.bottom > viewport.bottom) list.scrollTop += row.bottom - viewport.bottom;
    };
    revealSelection();
    const resize = new ResizeObserver(revealSelection);
    resize.observe(list);
    return () => resize.disconnect();
  }, [activeKey, search, evidenceFilter, navigationMode, system, mode, panels.explorerCollapsed, panels.focusWorkspace]);
  const navigationEmpty = engineeringNavigationEmptyState(navigation, { mode: navigationMode, system, query: search }, definitions.length);
  const guardPending = () => { if (pendingTransitionAllowed(pendingCells.size)) return true; setNotice("Finish or cancel the pending cell input (Enter / Escape) before leaving this Table."); return false; };
  function open(key: string) {
    if (!guardPending()) return;
    const definition = exactWorkspaceDefinition(workshop, key);
    if (!definition) { setNotice("The exact Table is unresolved. No fallback was selected."); return; }
    const tab = createWorkspaceTab({ definitionKey: key, definitionRevision: definition.definitionRevision, occurrence: definition.occurrence,
      title: definition.title, datasetRevision: source.currentDatasetRevision });
    const result = requestWorkspaceTab(workspace, tab);
    if (result.capacity) setNotice("All 12 provisional Table slots are open. Close a Table explicitly, then open this Table again. Working changes and history remain in this Calibration.");
    else { setUiRestored(true); setWorkspace(result.state); setNotice(null); const url = new URL(window.location.href); url.searchParams.set("definition", key); window.history.replaceState(null, "", url); loadTable(key); }
  }
  function close(id: string, others = false) {
    if (!guardPending()) return;
    if (!others && workspace.tabs.length === 1) { setNotice("The retained tab engine keeps one Table open. Open another Table before closing this one."); return; }
    const removed = workspace.tabs.filter(tab => others ? tab.id !== id : tab.id === id);
    if (removed.some(tab => tab.operand.trim())) { setNotice("A Table has an unapplied toolbar value. Apply it or clear that value explicitly before closing its tab."); return; }
    setLoaded(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !removed.some(tab => tab.definitionKey === key))));
    setWorkspace(state => others ? closeOtherWorkspaceTabs(state, id) : closeWorkspaceTab(state, id));
  }
  function select(index: number, region = false) {
    if (!active || !tableModel?.cells.some(cell => cell.index === index)) return;
    const first = tableModel.cells.find(cell => cell.index === active.selectedCells[0]), last = tableModel.cells.find(cell => cell.index === index)!;
    updateTab({ selectedCells: region && first ? tableModel.cells.filter(cell => cell.row >= Math.min(first.row, last.row) && cell.row <= Math.max(first.row, last.row)
      && cell.column >= Math.min(first.column, last.column) && cell.column <= Math.max(first.column, last.column)).map(cell => cell.index) : [index] });
  }
  function navigateCell(index: number, region = false) {
    if (!tableModel?.cells.some(cell => cell.index === index)) return;
    select(index, region);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-working-cell="' + index + '"]')?.focus({ preventScroll: true }));
  }
  const activeSeed = useMemo(() => projection ? resolveProjectedWorkingDefinition(workshop, projection) : undefined, [workshop, projection]);
  const targets = active && currentDetail ? active.selectedCells.flatMap(index => currentDetail.cells[index] ? [{ definitionRevision: active.definitionRevision, occurrence: active.occurrence,
    index, row: currentDetail.cells[index].row, column: currentDetail.cells[index].column }] : []) : [];
  const editQualified = projection?.slots.current.state === "available" && projection.capabilities.edit?.state === "EDIT_QUALIFIED";
  const canMutate = interaction.editing && editQualified && !saving && !durable?.uncertain && saveStatus !== "loading" && !(saveStatus === "failed" && !working);
  let plan: WorkingEditInput | null = null, preview: WorkingEditPreview | null = null;
  if (working && active && activeSeed && (active.operand.trim() || active.operation === "revert" || active.operation.startsWith("interpolate-"))) {
    try { plan = planWorkingToolbar(active.operation, active.operand, targets, activeSeed); preview = previewWorkingEdit(working, plan); }
    catch (error) { preview = { validation: "BLOCKED", before: [], after: [], findings: [(error as Error).message] }; }
  }
  function applyToolbar() {
    if (!canMutate || !working || !plan || displayMode !== "working" || !guardPending()) return;
    const result = applyWorkingEdit(working, { ...plan, updatedAt: new Date().toISOString() });
    if (result.status === "applied") { setWorking(result.calibration); updateTab({ operand: "" }); } else setNotice(result.findings.join(" "));
  }
  async function copyMatrix() {
    if (!activeSeed || !guardPending()) return;
    try {
      const rectangle = selectedRectangle(targets), values = rectangle.ordered.map(t => {
        const current = activeSeed.cells.find(c => c.index === t.index)!.currentValue;
        return displayMode === "working" && working ? workingCellValue(working,t,current)! : current;
      });
      if (displayMode === "reference") throw Error("Switch to Current or Working before copying a matrix; Reference is never substituted.");
      const rows = Array.from({ length: rectangle.rows }, (_,r) => values.slice(r*rectangle.columns,(r+1)*rectangle.columns).join("\t"));
      const text=rows.join("\n"); if(text.length>MAX_MATRIX_CHARACTERS) throw Error("Selected matrix exceeds the clipboard limit.");
      await navigator.clipboard.writeText(text); setNotice("Exact selected values copied as a tab-separated matrix. No axes or units were substituted.");
    } catch (error) { setNotice((error as Error).message); }
  }
  function revertTable() {
    if (!working || !activeSeed || !canMutate || displayMode !== "working" || !guardPending() ||
      !window.confirm("Revert this exact Table to Current in Working? This adds an undoable operation; saved revisions remain unchanged.")) return;
    const result=applyWorkingEdit(working,{operation:"revert",operand:0,recordExactRaw:true,
      targets:activeSeed.cells.map(({definitionRevision,occurrence,index,row,column})=>({definitionRevision,occurrence,index,row,column})),
      definitions:[activeSeed],updatedAt:new Date().toISOString()});
    if(result.status==="applied")setWorking(result.calibration);else setNotice(result.findings.join(" "));
  }
  function commitCell(index: number, value: number) {
    if (!canMutate || !working || !activeSeed || !active || displayMode !== "working" || !currentDetail?.cells[index]) return { status: "blocked" as const, findings: ["Editing is unavailable in this context."] };
    const cell = currentDetail.cells[index];
    const result = applyWorkingEdit(working, { operation: "assign", source: "direct", recordExactRaw: true, operand: value, targets: [{ definitionRevision: active.definitionRevision, occurrence: active.occurrence, index, row: cell.row, column: cell.column }], definitions: [activeSeed], updatedAt: new Date().toISOString() });
    if (result.status === "blocked") return result;
    setWorking(result.calibration);
    return { status: "applied" as const, validation: result.calibration.validation, findings: result.calibration.mutations.at(-1)?.findings ?? [] };
  }
  const selectedCell = active?.selectedCells[0] ?? 0;
  const sliceDirection = tableModel?.columns === 1 && tableModel.rows > 1 ? "column" : active?.sliceDirection ?? "row";
  const editingChanged = (index: number, editing: boolean) => setPendingCells(previous => { const next = new Set(previous); if (editing) next.add(index); else next.delete(index); return next; });
  const table = tableModel && currentDetail && active && terminology ? <>
    <h2 className="text-lg font-semibold">{terminology.tableName}</h2><details className="my-2 text-xs"><summary>Exact Table selection</summary><p className="break-all font-mono">{active.definitionKey}</p><p className="break-all font-mono">{active.definitionRevision} · occurrence {active.occurrence}</p></details>
    <div className="mb-3 flex flex-wrap gap-2" aria-label="Table presentation controls">{(["grid", "2d", "3d"] as const).map(view => <button key={view} type="button" className={button} aria-pressed={active.view === view}
      disabled={view === "grid" ? !views?.grid : view === "2d" ? !views?.line : !views?.surface} onClick={() => { if (guardPending()) updateTab({ view }); }}>{view === "grid" ? "Grid" : view.toUpperCase()}</button>)}</div>
    {!views?.line && <p className="my-1 text-xs text-zinc-500">2D: {views?.reason2d}</p>}{!views?.surface && <p className="my-1 text-xs text-zinc-500">3D: {views?.reason3d}</p>}
    {!tableModel.available ? <p role="status">Selected {displayMode} values unavailable: {tableModel.selectedLayer.state}. {currentDetail.findings.join(" ")}</p>
      : active.view !== "grid" && (active.view === "2d" ? !views?.line : !views?.surface) ? <p role="status">The selected view is unavailable for this exact layer. {active.view === "2d" ? views?.reason2d : views?.reason3d} Select Grid to inspect qualified cells.</p>
      : active.view === "2d" && views?.line && visual ? <><label className="text-xs">Slice <select id="u1-slice-direction" name="sliceDirection" value={sliceDirection} disabled={tableModel.shape === "1D"} onChange={event => updateTab({ sliceDirection: event.target.value as "row" | "column", sliceIndex: 0 })} className="bg-black"><option value="row">Row</option><option value="column">Column</option></select></label><input id="u1-slice-index" name="sliceIndex" aria-label="Slice index" type="number" min={0} max={(sliceDirection === "row" ? tableModel.rows : tableModel.columns) - 1} value={active.sliceIndex} onChange={event => { const index = Number(event.target.value); if (Number.isSafeInteger(index) && index >= 0 && index < (sliceDirection === "row" ? tableModel.rows : tableModel.columns)) updateTab({ sliceIndex: index }); }} className="w-20 bg-black"/><CalibrationPlot2D view={active.plotView} onView={plotView => updateTab({ plotView })} model={visual} presentation={displayMode === "reference" ? "reference" : tableModel.comparison ? displayMode === "working" ? "reference-working" : "reference-current" : displayMode} selectedCell={selectedCell} direction={sliceDirection} sliceIndex={active.sliceIndex} terminology={terminology} onSelect={select}/></>
      : active.view === "3d" && views?.surface && visual ? <CalibrationSurface3D camera={active.camera} onCamera={camera => updateTab({ camera })} model={visual} detail={tableModel} state={displayMode} terminology={terminology} selectedCell={selectedCell} onSelect={select}/>
      : <Grid zoom={active.gridZoom ?? 1} onZoom={gridZoom => updateTab({ gridZoom })} model={tableModel} selected={active.selectedCells} onSelect={select} canEdit={Boolean(canMutate && working && displayMode === "working")} onNavigate={navigateCell} onCommit={commitCell} onEditingChange={editingChanged} onDraftCancelled={() => setNotice("The uncommitted cell draft was cancelled because editing is unavailable in this workspace.")}/>}

  </> : <p role="status">{activeEvidence?.status === "loading" ? "Loading exact Table evidence…" : activeEvidence?.status === "unavailable"
    ? activeEvidence.finding : evidence.finding ?? "Exact Table evidence is unavailable; select the Table in Explorer to load it."}</p>;
  const inspector = tableModel ? <Inspector model={tableModel} selected={selectedCell} definitions={workshop.definitions} onOpen={open} onCollapse={() => changePanels({ ...panels, inspectorCollapsed: true })}/> : <p className="bmw-border rounded-2xl bg-zinc-950 p-5">No exact Table evidence selected.</p>;
  const interactiveReady = uiRestored && saveStatus !== "loading" && (!active || projection?.selection.key === active.definitionKey);
  useEffect(() => {
    if (!interactiveReady || !onInteractive) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => onInteractive(performance.now() - mountedAt)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [interactiveReady, onInteractive, mountedAt]);
  const content = <SharedCalibrationShell header={<Header vehicle={vehicle} context={context} evidence={evidence} upload={upload} onNavigate={event => { if (!guardPending()) event.preventDefault(); }}/>} evidence={<SharedEvidenceStrip projection={projection} working={working} reason="The requested Table is unresolved."/>}
    controls={<><CalibrationTerminologyControl mode={mode} onMode={next => { if (guardPending()) setMode(next); }}/>{interaction.reason && <p className="text-xs text-amber-200">{interaction.reason}</p>}</>} panels={panels} onPanels={next => { if (guardPending()) changePanels(next); }}
    navigation={<><EngineeringNavigationControl navigation={navigation} mode={navigationMode} selectedSystem={system} onMode={setNavigationMode} onSystem={setSystem}/>
      <TableEvidenceFilter search={search} onSearch={setSearch} filter={evidenceFilter} onFilter={setEvidenceFilter} referenceAvailable={evidence.referenceAvailable}/>
      {notice && <div role="alert" className="mt-3 rounded border border-amber-400/40 p-3 text-sm"><p>{notice}</p><button type="button" className={`${button} mt-2`} onClick={() => setNotice(null)}>Dismiss / keep workspace</button></div>}</>}
    explorer={<><h2 className="mb-2 shrink-0 text-sm font-semibold">Explorer · {definitions.length} Tables</h2><div ref={explorerList} aria-label="Explorer table list" className="min-h-0 max-h-[65vh] flex-1 space-y-1 overflow-y-auto xl:max-h-none">{definitions.map(({ definition }) => <button type="button" key={definition.key} aria-current={definition.key === active?.definitionKey ? "true" : undefined} className={`block w-full rounded-lg border p-3 text-left text-sm ${definition.key === active?.definitionKey ? "border-blue-400/60 bg-blue-400/10" : changedKeys.has(`${definition.definitionRevision}:${definition.occurrence}`) ? "border-emerald-400/35 bg-emerald-400/10" : "border-zinc-800 hover:border-blue-400"}`} onClick={() => open(definition.key)} title={definition.title}><span className="block">{calibrationTableLabel(mode, definition.title, definition.semantic)}</span>{mode === "standard" && <span className="block text-xs text-zinc-400">{definition.title}</span>}<span className="text-zinc-500">{definition.shape} · occurrence {definition.occurrence} · {definition.available ? "available" : "unavailable"}</span></button>)}</div>{!definitions.length && <p className="text-xs text-zinc-500">{navigationEmpty === "knowledge_empty" ? "Qualified engineering navigation is not yet bound for this scope. All Tables remains available." : "No Tables match these filters."}</p>}</>}
    tabs={<WorkspaceTabs tabs={workspace.tabs} activeId={workspace.activeId} changedKeys={changedKeys} onActivate={id => { if (guardPending()) { setWorkspace(state => activateWorkspaceTab(state, id)); const tab = workspace.tabs.find(item => item.id === id); if (tab) loadTable(tab.definitionKey); } }} onClose={id => close(id)} onCloseOthers={id => close(id, true)}/>}
    table={table} inspector={inspector}
    working={<><WorkingCalibrationPanel durable={Boolean(durable)} referenceAvailable={projection?.slots.reference.state === "available"} mode={displayMode} onMode={next => { if (guardPending()) setDisplayMode(next); }} working={working}
      onCreate={() => { if (canMutate) { setWorking(seed()); setDisplayMode("working"); } }}
      onUndo={() => { if (canMutate && working && guardPending()) setWorking(undoWorkingEdit(working, new Date().toISOString())); }} onRedo={() => { if (canMutate && working && guardPending()) setWorking(redoWorkingEdit(working, new Date().toISOString())); }}
      operation={active?.operation ?? "assign"} onOperation={operation => updateTab({ operation })} operand={active?.operand ?? ""} onOperand={operand => { if (operand.length <= MAX_MATRIX_CHARACTERS) updateTab({ operand }); else setNotice("Matrix exceeds 128 KiB; pending input was preserved."); }} preview={preview}
      onApply={applyToolbar}
      selectedCount={plan?.targets.length ?? targets.length} definitionTitles={Object.fromEntries(workshop.definitions.map(item => [`${item.definitionRevision}:${item.occurrence}`, item.title]))}
      editQualified={Boolean(editQualified)} interactionAllowed={interaction.editing && !saving && !durable?.uncertain && saveStatus !== "loading"} createAllowed={Boolean(canMutate)} onCopy={() => void copyMatrix()} onRevertTable={revertTable} onRevertAll={() => {
        if (!working || !canMutate || !guardPending()) return;
        if (unsaved || workspace.tabs.some(t=>t.operand.trim())) { setNotice("Save existing Working and apply or cancel pending input before reverting the complete Calibration. History must be preserved."); return; }
        if (window.confirm("Create a new zero-change Working from exact Current? All saved revisions remain available; explicitly Save to move the durable head.")) { setWorking(seed()); setDisplayMode("working"); }
      }} blockers={currentDetail?.editCapability.blockers ?? []} warnings={currentDetail?.editCapability.warnings ?? []} saveStatus={visibleSaveStatus} onRetrySave={retryLocalSave}/>
      {durable && <section aria-label="Durable Working revisions" className="bmw-border mt-3 rounded-xl p-4 text-sm">
        <p>Saved revisions are immutable and available on your authenticated devices. Save is explicit. Build, Export and Direct Flash remain locked.</p>
        <button className={button} disabled={!working || saving || !interaction.editing} onClick={() => void saveDurable()}>{saving ? "Saving revision…" : "Save durable revision"}</button>
        {legacyWorking && <button className={button} disabled={saving || Boolean(durable.uncertain)} onClick={() => {
          if (guardPending() && window.confirm("Load the preserved browser Working into this tab? Durable history will remain unchanged until you explicitly save.")) {
            setWorking(legacyWorking); setDisplayMode("working"); setSaveStatus("unsaved");
          }
        }}>Load preserved browser Working</button>}
        <button className={button} disabled={saving} onClick={async () => {
          if (savePending.current || !guardPending() || !window.confirm("Discard unsaved changes in this tab and load the current durable head? Saved history and legacy browser data are preserved.")) return;
          savePending.current = true; setSaving(true);
          try { durable.discardUncertain(); const snapshot = await durable.request({ action: "read" }); if (mounted.current) acceptSnapshot(snapshot); }
          catch (error) { if (mounted.current) setNotice(error instanceof Error ? error.message : "Working restoration failed."); }
          finally { savePending.current = false; if (mounted.current) setSaving(false); }
        }}>Reload durable head</button>
        <ol className="mt-3 max-h-56 overflow-y-auto">{savedHistory.history.map(revision => <li key={revision.id} className="mt-2">
          Revision {revision.sequence} · {revision.created_at} {revision.id === savedHistory.head?.id ? "· Current head" : ""}
          <button className={button} disabled={saving || !interaction.editing || Boolean(durable.uncertain)} onClick={() => {
            if (!unsaved || window.confirm("Discard unsaved edits and restore this saved revision as a new durable revision?")) void saveDurable(revision.id);
          }}>Restore revision {revision.sequence}</button>
        </li>)}</ol>
      </section>}</>}
    limitations={<><p>Current remains immutable. Working and history outlive Table tabs. The 12-tab capacity is a provisional migration limit.</p><p>Source lease and reconstruction owners remain authoritative; this shell does not request reconstruction, Export or Flash.</p>{workshop.limitations.map((item, index) => <p key={index} className="mt-1">{item}</p>)}</>}/>;
  return terminology ? <CalibrationTerminologyScope terminology={terminology}>{content}</CalibrationTerminologyScope> : content;
}
