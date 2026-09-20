"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { comparisonRendererDefinition, currentRendererDefinition, exactWorkspaceDefinition, isCurrentOnly,
  resolveProjectedWorkingDefinition, resolveRetainedWorkingDefinition, type SharedWorkspacePayload, type SharedWorkspaceWorkshop } from "@/lib/calibration-workshop/sharedWorkspaceAdapter";
import { createProjectionCache, projectionRequest, type ProjectionResponse } from "@/lib/calibration-workshop/sharedWorkspaceProjectionRequest";
import { pendingTransitionAllowed, recognizedReviewDevice } from "@/lib/calibration-workshop/sharedWorkspacePolicy";
import type { ProjectionContext } from "@/lib/calibration-workshop/sharedTableProjection";
import { existingRendererViews, requestWorkspaceTab, workspaceInteractionPolicy } from "@/lib/calibration-workshop/sharedWorkspacePolicy";
import { activateWorkspaceTab, closeOtherWorkspaceTabs, closeWorkspaceTab, createWorkspaceTab,
  updateActiveWorkspaceTab, type WorkspaceTabsState } from "@/lib/calibration-workshop/workspaceTabs";
import { applyWorkingEdit, createWorkingCalibration, previewWorkingEdit, redoWorkingEdit, undoWorkingEdit,
  workingCellValue, workingCellDelta, workingChangedDefinitionKeys, type WorkingCalibration } from "@/lib/calibration-workshop/workingCalibration";
import { createBrowserWorkingCalibrationStore } from "@/lib/calibration-workshop/workingCalibrationPersistence";
import { buildEngineeringNavigationIndex, filterEngineeringNavigation, engineeringNavigationEmptyState,
  type EngineeringNavigationMode } from "@/lib/calibration-workshop/engineeringNavigation";
import { buildCalibrationTerminology, calibrationTableLabel } from "@/lib/calibration-workshop/calibrationTerminology";
import { buildCalibrationVisualizationModel } from "@/lib/calibration-workshop/visualizationModel";
import SharedCalibrationShell from "./shared-calibration-shell";
import { SharedEvidenceStrip } from "./shared-evidence-strip";
import { Grid, Inspector } from "./workshop-client";
import { CurrentGrid, CurrentInspector } from "./current-only-workshop-client";
import CalibrationPlot2D from "./CalibrationPlot2D";
import CalibrationSurface3D from "./CalibrationSurface3D";
import CalibrationTerminologyControl, { CalibrationTerminologyScope, useCalibrationTerminologyMode } from "./calibration-terminology-control";
import EngineeringNavigationControl from "./engineering-navigation-control";
import WorkspaceTabs from "./workspace-tabs";
import WorkingCalibrationPanel, { type CalibrationDisplayMode } from "./working-calibration-panel";

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
      <p className="text-sm text-zinc-400">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.engine_code || "Engine unknown"}</p></div>{upload}</div>
    <details className="mt-3 text-xs"><summary className="cursor-pointer">Exact workspace identity</summary><dl className="mt-2 space-y-2 break-all font-mono">
      {Object.entries({ "Owner scope": context.ownerId, Vehicle: context.vehicleId, Session: context.sessionId ?? "No active session", Source: context.sourceMode,
        "Current Dataset": evidence?.projection?.slots.current.dataset?.datasetId ?? "Not established", "Current Dataset revision": evidence?.projection?.slots.current.dataset?.datasetRevision ?? "Not established",
        "ROM/software": evidence?.identity ?? "Not established", Container: evidence?.container ?? "Not established", Bytes: evidence?.byteLength ?? "Not established" }).map(([label, value]) => <div key={label}><dt className="text-zinc-500">{label}</dt><dd>{value}</dd></div>)}
    </dl></details></>;
}

export function EmptySharedWorkspace({ vehicle, context, reason, upload }: { vehicle: WorkspaceVehicle; context: ProjectionContext; reason: string; upload: ReactNode }) {
  const [panels, setPanels] = useState({ explorerCollapsed: false, inspectorCollapsed: false, focusWorkspace: false });
  const [mode, setMode] = useCalibrationTerminologyMode();
  return <SharedCalibrationShell header={<Header vehicle={vehicle} context={context} upload={upload}/>} evidence={<SharedEvidenceStrip projection={null} reason={reason}/>}
    controls={<CalibrationTerminologyControl mode={mode} onMode={setMode}/>} panels={panels} onPanels={setPanels}
    navigation={<EngineeringNavigationControl navigation={buildEngineeringNavigationIndex([])} mode="all" selectedSystem={null} onMode={() => {}} onSystem={() => {}}/>}
    explorer={<p className="text-sm text-zinc-400">No authorised Tables available.</p>} tabs={<p className="text-xs text-zinc-500">No open Tables</p>}
    table={<><h2>No Current Calibration loaded</h2><p role="status" className="mt-2 text-sm text-zinc-400">{reason}</p><div className="mt-3 flex gap-2">{["Grid", "2D", "3D"].map(view => <button key={view} type="button" disabled className={button}>{view}</button>)}</div></>}
    inspector={<p className="bmw-border rounded-2xl bg-zinc-950 p-5 text-sm text-zinc-400">Cell Inspector · Raw Representation unavailable.</p>}
    working={<p className="text-sm text-zinc-400">Working Calibration and history require an exact authorised Current Dataset.</p>}
    limitations="No evidence or numeric values have been substituted. Open Calibration File to begin."/>;
}

export default function SharedWorkspaceClient({ workshop, evidence, context, vehicle, requestedKey, upload }: {
  workshop: SharedWorkspaceWorkshop; evidence: SharedWorkspacePayload; context: ProjectionContext; vehicle: WorkspaceVehicle; requestedKey?: string; upload: ReactNode;
}) {
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
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cache.clear(); }; }, [cache]);
  const [loaded, setLoaded] = useState<Record<string, ProjectionResponse | { status: "loading" }>>(() => evidence.projection
    ? { [evidence.projection.selection.key]: { status: "ready", projection: evidence.projection } } : {});
  function loadTable(key: string) {
    const selected = exactWorkspaceDefinition(workshop, key);
    if (!selected) return;
    const request = projectionRequest(context, workshop, selected), cached = cache.get(request);
    if (cached) { setLoaded(previous => ({ ...previous, [key]: { status: "ready", projection: cached } })); return; }
    setLoaded(previous => ({ ...previous, [key]: { status: "loading" } }));
    void cache.request(request).then(result => {
      if (mounted.current && !(result.status === "unavailable" && result.code === "STALE_RESPONSE"))
        setLoaded(previous => key in previous ? { ...previous, [key]: result } : previous);
    });
  }
  const [panels, setPanels] = useState({ explorerCollapsed: false, inspectorCollapsed: false, focusWorkspace: false });
  const [mode, setMode] = useCalibrationTerminologyMode();
  const [search, setSearch] = useState(""), [navigationMode, setNavigationMode] = useState<EngineeringNavigationMode>("all");
  const [system, setSystem] = useState<string | null>(null), [evidenceFilter, setEvidenceFilter] = useState("all");
  const [working, setWorking] = useState<WorkingCalibration | null>(null), [displayMode, setDisplayMode] = useState<CalibrationDisplayMode>("current");
  const [saveStatus, setSaveStatus] = useState<"loading" | "saved" | "not-created">("loading");
  const [pendingCells, setPendingCells] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const displayEditing = useSyncExternalStore(subscribeDisplay, () => window.matchMedia(editingMedia).matches && !recognizedReviewDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), () => false);
  const interaction = workspaceInteractionPolicy(displayEditing ? 1024 : 0, displayEditing);
  const active = workspace.tabs.find(tab => tab.id === workspace.activeId) ?? null;
  const updateTab = (update: Parameters<typeof updateActiveWorkspaceTab>[1]) => setWorkspace(state => updateActiveWorkspaceTab(state, update));
  const source = workshop.source;
  const seed = useCallback(() => createWorkingCalibration({ ownerScope: context.ownerId, vehicleId: context.vehicleId,
    currentDatasetId: source.currentDatasetId, currentDatasetRevision: source.currentDatasetRevision, romLayoutId: source.romLayoutId,
    relationshipRevision: source.relationshipRevision, definitionSetRevision: source.definitionSetRevision, createdAt: new Date().toISOString() }), [context, source]);
  const savedRevision = useRef<string | null>(null);
  const resolveDefinition = useCallback((revision: string, occurrence: number) =>
    resolveRetainedWorkingDefinition(workshop, revision, occurrence), [workshop]);
  useEffect(() => {
    const current = seed(), restored = createBrowserWorkingCalibrationStore(window.localStorage).load(current, current, resolveDefinition);
    savedRevision.current = restored?.workingCalibrationRevision ?? null;
    queueMicrotask(() => { setWorking(restored); setDisplayMode(restored ? "working" : "current"); setSaveStatus(restored ? "saved" : "not-created"); });
  }, [seed, resolveDefinition]);
  useEffect(() => {
    if (!working || savedRevision.current === working.workingCalibrationRevision) return;
    try { createBrowserWorkingCalibrationStore(window.localStorage).save(working); savedRevision.current = working.workingCalibrationRevision; queueMicrotask(() => setSaveStatus("saved")); }
    catch { queueMicrotask(() => setNotice("Working changes could not be saved in this browser. Keep this workspace open.")); }
  }, [working]);
  useEffect(() => {
    if (!pendingCells.size && !workspace.tabs.some(tab => tab.operand.trim())) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [pendingCells, workspace.tabs]);
  const activeKey = active?.definitionKey;
  const activeEvidence = activeKey ? loaded[activeKey] : undefined;
  const projection = activeEvidence?.status === "ready" ? activeEvidence.projection : null;
  const currentDetail = useMemo(() => projection ? currentRendererDefinition(workshop, projection) : null, [workshop, projection]);
  const comparisonDetail = useMemo(() => projection ? comparisonRendererDefinition(workshop, projection) : null, [workshop, projection]);
  const displayedComparison = useMemo(() => !comparisonDetail || displayMode !== "working" || !working ? comparisonDetail : {
    ...comparisonDetail, cells: comparisonDetail.cells.map(cell => {
      const address = { ...cell, definitionRevision: comparisonDetail.summary.definitionRevision, occurrence: comparisonDetail.summary.occurrence };
      const delta = workingCellDelta(working, address, cell.currentValue);
      return { ...cell, currentValue: workingCellValue(working, address, cell.currentValue) ?? cell.currentValue,
        changed: Boolean(delta?.delta), signedDelta: delta?.delta ?? 0, percentageDelta: delta?.percentageDelta ?? null };
    }) }, [comparisonDetail, displayMode, working]);
  const visual = useMemo(() => displayedComparison ? buildCalibrationVisualizationModel(displayedComparison) : null, [displayedComparison]);
  const views = projection ? existingRendererViews(projection, visual) : null;
  const terminology = useMemo(() => currentDetail ? buildCalibrationTerminology({ mode, sourceTitle: currentDetail.title, shape: currentDetail.shape,
    rows: currentDetail.rows, columns: currentDetail.columns, axes: currentDetail.axes, referenceAxes: comparisonDetail?.referenceAxes,
    semantic: currentDetail.semantic, outputUnits: currentDetail.units }) : null, [currentDetail, comparisonDetail, mode]);
  const navigation = useMemo(() => buildEngineeringNavigationIndex(workshop.definitions.map(definition => ({ ...definition,
    available: "available" in definition ? definition.available : definition.availability === "current_available" }))), [workshop]);
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
    else { setWorkspace(result.state); setNotice(null); loadTable(key); }
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
    if (!active || !currentDetail?.cells[index]) return;
    const first = currentDetail.cells[active.selectedCells[0]], last = currentDetail.cells[index];
    updateTab({ selectedCells: region && first ? currentDetail.cells.filter(cell => cell.row >= Math.min(first.row, last.row) && cell.row <= Math.max(first.row, last.row)
      && cell.column >= Math.min(first.column, last.column) && cell.column <= Math.max(first.column, last.column)).map(cell => cell.index) : [index] });
  }
  const activeSeed = useMemo(() => projection ? resolveProjectedWorkingDefinition(workshop, projection) : undefined, [workshop, projection]);
  const targets = active && currentDetail ? active.selectedCells.flatMap(index => currentDetail.cells[index] ? [{ definitionRevision: active.definitionRevision, occurrence: active.occurrence,
    index, row: currentDetail.cells[index].row, column: currentDetail.cells[index].column }] : []) : [];
  const editQualified = projection?.slots.current.state === "available" && projection.capabilities.edit?.state === "EDIT_QUALIFIED";
  const canMutate = interaction.editing && editQualified && saveStatus !== "loading";
  const preview = working && active?.operand.trim() && activeSeed ? previewWorkingEdit(working, { operation: active.operation, operand: Number(active.operand), targets, definitions: [activeSeed] }) : null;
  function commitCell(index: number, value: number) {
    if (!canMutate || !working || !activeSeed || !active || displayMode !== "working" || !currentDetail?.cells[index]) return { status: "blocked" as const, findings: ["Editing is unavailable in this context."] };
    const cell = currentDetail.cells[index];
    const result = applyWorkingEdit(working, { operation: "assign", source: "direct", operand: value, targets: [{ definitionRevision: active.definitionRevision, occurrence: active.occurrence, index, row: cell.row, column: cell.column }], definitions: [activeSeed], updatedAt: new Date().toISOString() });
    if (result.status === "blocked") return result;
    setWorking(result.calibration);
    return { status: "applied" as const, validation: result.calibration.validation, findings: result.calibration.mutations.at(-1)?.findings ?? [] };
  }
  const selectedCell = active?.selectedCells[0] ?? 0;
  const editingChanged = (index: number, editing: boolean) => setPendingCells(previous => { const next = new Set(previous); if (editing) next.add(index); else next.delete(index); return next; });
  const table = currentDetail && active && terminology ? <>
    <h2 className="text-lg font-semibold">{terminology.tableName}</h2><details className="my-2 text-xs"><summary>Exact Table selection</summary><p className="break-all font-mono">{active.definitionKey}</p><p className="break-all font-mono">{active.definitionRevision} · occurrence {active.occurrence}</p></details>
    <div className="mb-3 flex flex-wrap gap-2" aria-label="Table presentation controls">{(["grid", "2d", "3d"] as const).map(view => <button key={view} type="button" className={button} aria-pressed={active.view === view}
      disabled={view === "grid" ? !views?.grid : view === "2d" ? !views?.line : !views?.surface} onClick={() => { if (guardPending()) updateTab({ view }); }}>{view === "grid" ? "Grid" : view.toUpperCase()}</button>)}</div>
    {!views?.line && <p className="my-1 text-xs text-zinc-500">2D: {views?.reason2d}</p>}{!views?.surface && <p className="my-1 text-xs text-zinc-500">3D: {views?.reason3d}</p>}
    {projection?.slots.current.state !== "available" ? <p role="status">Current values unavailable: {projection?.slots.current.state}. {currentDetail.findings.join(" ")}</p>
      : active.view === "2d" && views?.line && visual ? <><label className="text-xs">Slice <select id="u1-slice-direction" name="sliceDirection" value={active.sliceDirection} onChange={event => updateTab({ sliceDirection: event.target.value as "row" | "column", sliceIndex: 0 })} className="bg-black"><option value="row">Row</option><option value="column">Column</option></select></label><input id="u1-slice-index" name="sliceIndex" aria-label="Slice index" type="number" min={0} max={(active.sliceDirection === "row" ? currentDetail.rows : currentDetail.columns) - 1} value={active.sliceIndex} onChange={event => updateTab({ sliceIndex: Number(event.target.value) })} className="w-20 bg-black"/><CalibrationPlot2D model={visual} presentation={displayMode === "working" ? "reference-working" : "reference-current"} direction={active.sliceDirection} sliceIndex={active.sliceIndex} terminology={terminology} onSelect={select}/></>
      : active.view === "3d" && views?.surface && visual && displayedComparison ? <CalibrationSurface3D model={visual} detail={displayedComparison} state={displayMode === "working" ? "working" : "current"} terminology={terminology} selectedCell={selectedCell} onSelect={select}/>
      : displayedComparison && comparisonDetail && visual ? <Grid detail={displayedComparison} terminology={terminology} currentCells={comparisonDetail.cells} selected={active.selectedCells} onSelect={select} canEdit={Boolean(canMutate && working && displayMode === "working")} rowAxis={visual.rowAxis} columnAxis={visual.columnAxis} onNavigate={select} onCommit={commitCell} onEditingChange={editingChanged} onDraftCancelled={() => setNotice("The uncommitted cell draft was cancelled because editing is unavailable in this workspace.")}/>
      : <CurrentGrid detail={currentDetail} terminologyMode={mode} working={working} displayMode={displayMode} selected={active.selectedCells} onSelect={select} onNavigate={select} onCommit={commitCell} interactionAllowed={Boolean(canMutate)} onEditingChange={editingChanged} onDraftCancelled={() => setNotice("The uncommitted cell draft was cancelled because editing is unavailable in this workspace.")}/>}
  </> : <p role="status">{activeEvidence?.status === "loading" ? "Loading exact Table evidence…" : activeEvidence?.status === "unavailable"
    ? activeEvidence.finding : evidence.finding ?? "Exact Table evidence is unavailable; select the Table in Explorer to load it."}</p>;
  const inspector = currentDetail ? <>
    {comparisonDetail && displayedComparison && !isCurrentOnly(workshop) ? <Inspector workshop={workshop} detail={displayedComparison} cell={displayedComparison.cells[selectedCell] ?? null} currentCell={comparisonDetail.cells[selectedCell] ?? null} working={working} onCollapse={() => setPanels(state => ({ ...state, inspectorCollapsed: true }))}/>
      : <CurrentInspector detail={currentDetail} terminologyMode={mode} cell={currentDetail.cells[selectedCell] ?? null} working={working} displayMode={displayMode} onCollapse={() => setPanels(state => ({ ...state, inspectorCollapsed: true }))}/>}
    {currentDetail.cells[selectedCell] && <details className="mt-3 break-all rounded-xl border border-zinc-800 p-3 text-xs"><summary>Exact Current value and Raw Representation</summary><p>{String(currentDetail.cells[selectedCell].currentValue)}</p><p>Raw {String(currentDetail.cells[selectedCell].currentRawValue)} · offset {currentDetail.cells[selectedCell].currentRawOffset}</p></details>}
  </> : <p className="bmw-border rounded-2xl bg-zinc-950 p-5">No exact Table evidence selected.</p>;
  const content = <SharedCalibrationShell header={<Header vehicle={vehicle} context={context} evidence={evidence} upload={upload} onNavigate={event => { if (!guardPending()) event.preventDefault(); }}/>} evidence={<SharedEvidenceStrip projection={projection} working={working} reason="The requested Table is unresolved."/>}
    controls={<><CalibrationTerminologyControl mode={mode} onMode={next => { if (guardPending()) setMode(next); }}/>{interaction.reason && <p className="text-xs text-amber-200">{interaction.reason}</p>}</>} panels={panels} onPanels={next => { if (guardPending()) setPanels(next); }}
    navigation={<><EngineeringNavigationControl navigation={navigation} mode={navigationMode} selectedSystem={system} onMode={setNavigationMode} onSystem={setSystem}/>
      <div className="flex flex-wrap gap-3"><input id="u1-table-search" name="tableSearch" aria-label="Search Tables" placeholder="Search Tables" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"/>
        <select id="u1-evidence-filter" name="evidenceFilter" aria-label="Table evidence filter" value={evidenceFilter} onChange={event => setEvidenceFilter(event.target.value)} className="rounded border border-zinc-700 bg-zinc-950 p-2 text-xs"><option value="all">All evidence states</option><option value="working">Working changes</option><option value="reference" disabled={!evidence.referenceAvailable}>Reference differences{!evidence.referenceAvailable ? " — unavailable" : ""}</option><option value="unavailable">Unavailable Tables</option></select></div>
      {notice && <div role="alert" className="mt-3 rounded border border-amber-400/40 p-3 text-sm"><p>{notice}</p><button type="button" className={`${button} mt-2`} onClick={() => setNotice(null)}>Dismiss / keep workspace</button></div>}</>}
    explorer={<><h2 className="mb-2 shrink-0 text-sm font-semibold">Explorer · {definitions.length} Tables</h2><div ref={explorerList} aria-label="Explorer table list" className="min-h-0 max-h-[65vh] flex-1 space-y-1 overflow-y-auto xl:max-h-none">{definitions.map(({ definition }) => <button type="button" key={definition.key} aria-current={definition.key === active?.definitionKey ? "true" : undefined} className={`block w-full rounded-lg border p-3 text-left text-sm ${definition.key === active?.definitionKey ? "border-blue-400/60 bg-blue-400/10" : changedKeys.has(`${definition.definitionRevision}:${definition.occurrence}`) ? "border-emerald-400/35 bg-emerald-400/10" : "border-zinc-800 hover:border-blue-400"}`} onClick={() => open(definition.key)} title={definition.title}><span className="block">{calibrationTableLabel(mode, definition.title, definition.semantic)}</span>{mode === "standard" && <span className="block text-xs text-zinc-400">{definition.title}</span>}<span className="text-zinc-500">{definition.shape} · occurrence {definition.occurrence} · {definition.available ? "available" : "unavailable"}</span></button>)}</div>{!definitions.length && <p className="text-xs text-zinc-500">{navigationEmpty === "knowledge_empty" ? "Qualified engineering navigation is not yet bound for this scope. All Tables remains available." : "No Tables match these filters."}</p>}</>}
    tabs={<WorkspaceTabs tabs={workspace.tabs} activeId={workspace.activeId} changedKeys={changedKeys} onActivate={id => { if (guardPending()) { setWorkspace(state => activateWorkspaceTab(state, id)); const tab = workspace.tabs.find(item => item.id === id); if (tab) loadTable(tab.definitionKey); } }} onClose={id => close(id)} onCloseOthers={id => close(id, true)}/>}
    table={table} inspector={inspector}
    working={<WorkingCalibrationPanel mode={displayMode} onMode={next => { if (guardPending()) setDisplayMode(next); }} working={working}
      onCreate={() => { if (canMutate) { setWorking(seed()); setDisplayMode("working"); } }}
      onUndo={() => { if (interaction.editing && working && guardPending()) setWorking(undoWorkingEdit(working, new Date().toISOString())); }} onRedo={() => { if (interaction.editing && working && guardPending()) setWorking(redoWorkingEdit(working, new Date().toISOString())); }}
      operation={active?.operation ?? "assign"} onOperation={operation => updateTab({ operation })} operand={active?.operand ?? ""} onOperand={operand => updateTab({ operand })} preview={preview}
      onApply={() => { if (!canMutate || !working || !active || !activeSeed || displayMode !== "working" || !guardPending()) return; const result = applyWorkingEdit(working, { operation: active.operation, source: "toolbar", operand: Number(active.operand), targets, definitions: [activeSeed], updatedAt: new Date().toISOString() }); if (result.status === "applied") { setWorking(result.calibration); updateTab({ operand: "" }); } else setNotice(result.findings.join(" ")); }}
      selectedCount={targets.length} definitionTitles={Object.fromEntries(workshop.definitions.map(item => [`${item.definitionRevision}:${item.occurrence}`, item.title]))}
      editQualified={Boolean(editQualified)} interactionAllowed={interaction.editing && saveStatus !== "loading"} createAllowed={Boolean(canMutate)} blockers={currentDetail?.editCapability.blockers ?? []} warnings={currentDetail?.editCapability.warnings ?? []} saveStatus={saveStatus}/>}
    limitations={<><p>Current remains immutable. Working and history outlive Table tabs. The 12-tab capacity is a provisional migration limit.</p><p>Source lease and reconstruction owners remain authoritative; this shell does not request reconstruction, Export or Flash.</p>{workshop.limitations.map((item, index) => <p key={index} className="mt-1">{item}</p>)}</>}/>;
  return terminology ? <CalibrationTerminologyScope terminology={terminology}>{content}</CalibrationTerminologyScope> : content;
}
