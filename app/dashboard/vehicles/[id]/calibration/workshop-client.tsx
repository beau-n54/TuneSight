"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  filterWorkshopDefinitions,
  materializeWorkshopDefinition,
  workingDefinitionFromWorkshop,
  type WorkshopFilter,
  type WorkshopViewModel,
} from "@/lib/calibration-workshop/viewModel";
import {
  buildCalibrationVisualizationModel,
  capabilitiesForDefinition,
  type SliceDirection,
  type WorkshopViewMode,
} from "@/lib/calibration-workshop/visualizationModel";
import CalibrationPlot2D from "./CalibrationPlot2D";
import CalibrationSurface3D from "./CalibrationSurface3D";
import { deriveWorkshopLayout } from "@/lib/calibration-workshop/workspaceLayout";
import {
  applyWorkingEdit,
  createWorkingCalibration,
  previewWorkingEdit,
  redoWorkingEdit,
  undoWorkingEdit,
  workingCellDelta,
  workingCellValue,
  workingChangedDefinitionKeys,
  type WorkingCalibration,
  type WorkingEditOperation,
} from "@/lib/calibration-workshop/workingCalibration";
import { createBrowserWorkingCalibrationStore } from "@/lib/calibration-workshop/workingCalibrationPersistence";
import WorkingCalibrationPanel, {
  type CalibrationDisplayMode,
} from "./working-calibration-panel";
import DirectGridCell from "./direct-grid-cell";
import { engineeringToRawRepresentation } from "@/lib/calibration-workshop/manualEditorUx";
import {
  activateWorkspaceTab,
  BoundedTableCache,
  closeOtherWorkspaceTabs,
  closeWorkspaceTab,
  createWorkspaceTab,
  openWorkspaceTab,
  updateActiveWorkspaceTab,
  type WorkspaceTabsState,
} from "@/lib/calibration-workshop/workspaceTabs";
import WorkspaceTabs from "./workspace-tabs";
import {
  buildEngineeringNavigationIndex,
  engineeringNavigationEmptyState,
  filterEngineeringNavigation,
  type EngineeringNavigationMode,
} from "@/lib/calibration-workshop/engineeringNavigation";
import {
  buildGridAxisPresentation,
  gridAxisCoordinate,
} from "@/lib/calibration-workshop/gridAxisPresentation";
import CalibrationAxisGrid from "./calibration-axis-grid";
import CalibrationTerminologyControl, {
  CalibrationTerminologyScope,
  useCalibrationTerminologyMode,
  useCalibrationTerminologyScope,
} from "./calibration-terminology-control";
import {
  buildCalibrationTerminology,
  calibrationTableLabel,
  calibrationTermLabel,
  type CalibrationTerminology,
  type CalibrationTerminologyMode,
} from "@/lib/calibration-workshop/calibrationTerminology";
import EngineeringNavigationControl from "./engineering-navigation-control";

const FILTERS: readonly { id: WorkshopFilter; label: string }[] = [
  { id: "all", label: "All Tables" },
  { id: "changed", label: "Changed Tables" },
  { id: "unchanged", label: "Unchanged Tables" },
  { id: "unavailable", label: "Unavailable" },
  { id: "axis_changed", label: "Axis Changed" },
  { id: "value_and_axis_changed", label: "Value + Axis" },
  { id: "conflict", label: "Conflict" },
];
const VIEW_LABELS: Record<WorkshopViewMode, string> = {
  grid: "Grid",
  "2d": "2D",
  "3d": "3D",
};
const pretty = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const number = (value: number) =>
  Number.isInteger(value)
    ? value.toLocaleString()
    : Number(value.toPrecision(7)).toLocaleString();
type WorkshopDefinition = WorkshopViewModel["definitions"][number];
const semanticTitle = (
  definition: WorkshopDefinition,
  mode: CalibrationTerminologyMode,
) => calibrationTableLabel(mode, definition.title, definition.semantic);
function DefinitionName({ definition }: { definition: WorkshopDefinition }) {
  const mode = useCalibrationTerminologyScope()?.mode ?? "standard",
    primary = semanticTitle(definition, mode);
  return (
    <>
      <p className="truncate text-sm font-medium">{primary}</p>
      {primary !== definition.title && (
        <p className="mt-1 truncate text-xs text-zinc-500">
          {definition.title}
        </p>
      )}
    </>
  );
}

export default function WorkshopClient({
  workshop,
  vehicleId,
  ownerScope,
  subscriberSession,
}: {
  workshop: WorkshopViewModel;
  vehicleId: string;
  ownerScope: string;
  previewRom?: string;
  subscriberSession?: string;
}) {
  const initialTab = useMemo(
    () =>
      createWorkspaceTab({
        definitionKey: workshop.selectedDefinition.summary.key,
        definitionRevision:
          workshop.selectedDefinition.summary.definitionRevision,
        occurrence: workshop.selectedDefinition.summary.occurrence,
        datasetRevision: workshop.source.currentDatasetRevision,
        title: workshop.selectedDefinition.summary.title,
      }),
    [
      workshop.selectedDefinition.summary,
      workshop.source.currentDatasetRevision,
    ],
  );
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState<WorkshopFilter>("all"),
    [navigationMode, setNavigationMode] =
      useState<EngineeringNavigationMode>("all"),
    [selectedSystem, setSelectedSystem] = useState<string | null>(null),
    [workspace, setWorkspace] = useState<WorkspaceTabsState>(() => ({
      tabs: [initialTab],
      activeId: initialTab.id,
    })),
    [explorerCollapsed, setExplorerCollapsed] = useState(false),
    [inspectorCollapsed, setInspectorCollapsed] = useState(false),
    [focus, setFocus] = useState(false),
    [working, setWorking] = useState<WorkingCalibration | null>(null),
    [displayMode, setDisplayMode] = useState<CalibrationDisplayMode>("current"),
    [saveStatus, setSaveStatus] = useState<"loading" | "saved" | "not-created">(
      "loading",
    );
  const [terminologyMode, setTerminologyMode] = useCalibrationTerminologyMode();
  const activeTab =
      workspace.tabs.find((tab) => tab.id === workspace.activeId) ??
      workspace.tabs[0]!,
    view = activeTab.view,
    selectedCells = activeTab.selectedCells,
    sliceDirection = activeTab.sliceDirection,
    sliceIndex = activeTab.sliceIndex,
    operation = activeTab.operation,
    operand = activeTab.operand;
  const setTab = (update: Parameters<typeof updateActiveWorkspaceTab>[1]) =>
      setWorkspace((state) => updateActiveWorkspaceTab(state, update)),
    setView = (next: WorkshopViewMode) => setTab({ view: next }),
    setSelectedCells = (next: readonly number[]) =>
      setTab({ selectedCells: next }),
    setSliceDirection = (next: SliceDirection) =>
      setTab({ sliceDirection: next }),
    setSliceIndex = (next: number) => setTab({ sliceIndex: next }),
    setOperation = (next: WorkingEditOperation) => setTab({ operation: next }),
    setOperand = (next: string) => setTab({ operand: next });
  const detailCache = useRef(
    new BoundedTableCache<WorkshopViewModel["selectedDefinition"]>(),
  );
  const scope = useMemo(
      () => ({
        ownerScope,
        vehicleId,
        currentDatasetId: workshop.source.currentDatasetId,
      }),
      [ownerScope, vehicleId, workshop.source.currentDatasetId],
    ),
    resolveWorkingDefinition = useCallback(
      (definitionRevision: string, occurrence: number) =>
        workingDefinitionFromWorkshop(workshop, definitionRevision, occurrence),
      [workshop],
    ),
    newWorking = useCallback(
      (createdAt = new Date().toISOString()) =>
        createWorkingCalibration({
          ownerScope,
          vehicleId,
          currentDatasetId: workshop.source.currentDatasetId,
          currentDatasetRevision: workshop.source.currentDatasetRevision,
          romLayoutId: workshop.source.romLayoutId,
          relationshipRevision: workshop.source.relationshipRevision,
          definitionSetRevision: workshop.source.definitionSetRevision,
          createdAt,
        }),
      [ownerScope, vehicleId, workshop.source],
    );
  useEffect(() => {
    const seed = newWorking("2000-01-01T00:00:00.000Z"),
      restored = createBrowserWorkingCalibrationStore(window.localStorage).load(
        scope,
        seed,
        resolveWorkingDefinition,
      );
    setWorking(restored);
    setDisplayMode(restored ? "working" : "current");
    setSaveStatus(restored ? "saved" : "not-created");
  }, [scope, newWorking, resolveWorkingDefinition]);
  useEffect(() => {
    if (working) {
      createBrowserWorkingCalibrationStore(window.localStorage).save(working);
      setSaveStatus("saved");
    }
  }, [working]);
  const navigation = useMemo(
      () =>
        buildEngineeringNavigationIndex(
          workshop.definitions.map((definition) => ({
            ...definition,
            available: definition.available,
          })),
        ),
      [workshop.definitions],
    ),
    navigationDefinitions = useMemo(
      () =>
        filterEngineeringNavigation(navigation, {
          mode: navigationMode,
          system: selectedSystem,
          query: search,
        }).map((entry) => entry.definition),
      [navigation, navigationMode, selectedSystem, search],
    ),
    definitions = useMemo(
      () => filterWorkshopDefinitions(navigationDefinitions, "", filter),
      [navigationDefinitions, filter],
    ),
    navigationEmpty = engineeringNavigationEmptyState(
      navigation,
      { mode: navigationMode, system: selectedSystem, query: search },
      definitions.length,
    ),
    baseDetail = useMemo(() => {
      const cached = detailCache.current.get(activeTab.id);
      return (
        cached ??
        detailCache.current.set(
          activeTab.id,
          materializeWorkshopDefinition(workshop, activeTab.definitionKey),
        )
      );
    }, [activeTab.id, activeTab.definitionKey, workshop]),
    activeWorkingDefinition = useMemo(
      () =>
        resolveWorkingDefinition(
          baseDetail.summary.definitionRevision,
          baseDetail.summary.occurrence,
        ),
      [
        resolveWorkingDefinition,
        baseDetail.summary.definitionRevision,
        baseDetail.summary.occurrence,
      ],
    ),
    detail = useMemo(
      () =>
        displayMode !== "working" || !working
          ? baseDetail
          : {
              ...baseDetail,
              cells: baseDetail.cells.map((item) => {
                const address = {
                    definitionRevision: baseDetail.summary.definitionRevision,
                    occurrence: baseDetail.summary.occurrence,
                    index: item.index,
                    row: item.row,
                    column: item.column,
                  },
                  value =
                    workingCellValue(working, address) ?? item.currentValue,
                  delta = workingCellDelta(working, address);
                return {
                  ...item,
                  currentValue: value,
                  changed: Boolean(delta?.delta),
                  signedDelta: delta?.delta ?? 0,
                  percentageDelta: delta?.percentageDelta ?? null,
                };
              }),
            },
      [baseDetail, displayMode, working],
    ),
    visual = useMemo(
      () => buildCalibrationVisualizationModel(detail),
      [detail],
    ),
    capabilities = useMemo(() => capabilitiesForDefinition(detail), [detail]),
    selectedCell = selectedCells[0] ?? 0,
    cell = detail.cells[selectedCell] ?? detail.cells[0] ?? null;
  const selectCell = (index: number, region = false) => {
    if (!region || selectedCells.length === 0) {
      setSelectedCells([index]);
      return;
    }
    const anchor = detail.cells[selectedCells[0]!],
      target = detail.cells[index];
    if (!anchor || !target) return;
    const minRow = Math.min(anchor.row, target.row),
      maxRow = Math.max(anchor.row, target.row),
      minColumn = Math.min(anchor.column, target.column),
      maxColumn = Math.max(anchor.column, target.column);
    setSelectedCells(
      detail.cells
        .filter(
          (item) =>
            item.row >= minRow &&
            item.row <= maxRow &&
            item.column >= minColumn &&
            item.column <= maxColumn,
        )
        .map((item) => item.index),
    );
  };
  const targets = useMemo(
    () =>
      selectedCells.flatMap((index) => {
        const selected = detail.cells[index];
        return selected
          ? [
              {
                definitionRevision: detail.summary.definitionRevision,
                occurrence: detail.summary.occurrence,
                index,
                row: selected.row,
                column: selected.column,
              },
            ]
          : [];
      }),
    [detail, selectedCells],
  );
  const preview = useMemo(
    () =>
      working && operand.trim() && activeWorkingDefinition
        ? previewWorkingEdit(working, {
            operation,
            operand: Number(operand),
            targets,
            definitions: [activeWorkingDefinition],
          })
        : null,
    [working, operation, operand, targets, activeWorkingDefinition],
  );
  const changedDefinitionKeys = useMemo(
    () => new Set(working ? workingChangedDefinitionKeys(working) : []),
    [working],
  );
  const apply = () => {
    if (
      !working ||
      !preview ||
      preview.validation === "BLOCKED" ||
      !activeWorkingDefinition
    )
      return;
    const result = applyWorkingEdit(working, {
      operation,
      operand: Number(operand),
      targets,
      definitions: [activeWorkingDefinition],
      updatedAt: new Date().toISOString(),
    });
    if (result.status === "applied") setWorking(result.calibration);
  };
  const openTable = (definition: WorkshopViewModel["definitions"][number]) => {
    const tab = createWorkspaceTab({
      definitionKey: definition.key,
      definitionRevision: definition.definitionRevision,
      occurrence: definition.occurrence,
      datasetRevision: workshop.source.currentDatasetRevision,
      title: definition.title,
    });
    setWorkspace((state) => openWorkspaceTab(state, tab));
    const url = new URL(window.location.href);
    url.searchParams.set("definition", definition.key);
    window.history.replaceState(null, "", url);
  };
  const navigateCell = (index: number) => {
    const next = Math.max(0, Math.min(detail.cells.length - 1, index));
    setSelectedCells([next]);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(`[data-working-cell="${next}"]`)
        ?.focus(),
    );
  };
  const commitDirect = (index: number, value: number) => {
    const selected = detail.cells[index];
    if (
      !working ||
      displayMode !== "working" ||
      !activeWorkingDefinition ||
      detail.summary.editCapability?.state !== "EDIT_QUALIFIED" ||
      !selected
    )
      return {
        status: "blocked" as const,
        findings: [
          "Direct editing is available only for EDIT-qualified cells in WORKING mode.",
        ],
      };
    const target = {
        definitionRevision: detail.summary.definitionRevision,
        occurrence: detail.summary.occurrence,
        index,
        row: selected.row,
        column: selected.column,
      },
      result = applyWorkingEdit(working, {
        operation: "assign",
        source: "direct",
        operand: value,
        targets: [target],
        definitions: [activeWorkingDefinition],
        updatedAt: new Date().toISOString(),
      });
    if (result.status === "blocked") return result;
    const mutation =
      result.calibration.mutations[result.calibration.cursor - 1]!;
    setWorking(result.calibration);
    return {
      status: "applied" as const,
      validation: mutation.validation,
      findings: mutation.findings,
    };
  };
  const terminology = useMemo(
    () =>
      buildCalibrationTerminology({
        mode: terminologyMode,
        sourceTitle: detail.summary.title,
        shape: detail.summary.shape,
        rows: detail.rows,
        columns: detail.columns,
        axes: detail.axes,
        referenceAxes: detail.referenceAxes,
        semantic: detail.summary.semantic,
        outputUnits: detail.summary.units,
      }),
    [detail, terminologyMode],
  );
  const displayTabs = useMemo(
    () =>
      workspace.tabs.map((tab) => {
        const definition = workshop.definitions.find(
          (item) => item.key === tab.definitionKey,
        );
        return definition
          ? { ...tab, title: semanticTitle(definition, terminologyMode) }
          : tab;
      }),
    [workspace.tabs, workshop.definitions, terminologyMode],
  );
  const { explorerVisible, inspectorVisible, columns } = deriveWorkshopLayout({
    explorerCollapsed,
    inspectorCollapsed,
    focusWorkspace: focus,
  });
  return (
    <CalibrationTerminologyScope terminology={terminology}>
      <section className={`grid gap-4 ${columns}`} data-focus-workspace={focus}>
        {explorerVisible && (
          <div className="min-w-0">
            <Explorer
              workshop={workshop}
              detail={detail}
              definitions={definitions}
              emptyState={navigationEmpty}
              selectedSystem={selectedSystem}
              changedDefinitionKeys={changedDefinitionKeys}
              search={search}
              filter={filter}
              onSearch={setSearch}
              onFilter={setFilter}
              onOpen={openTable}
              onCollapse={() => setExplorerCollapsed(true)}
            />
          </div>
        )}
        <main className="bmw-border min-w-0 rounded-2xl bg-zinc-950 p-4 sm:p-5">
          <EngineeringNavigationControl
            navigation={navigation}
            mode={navigationMode}
            selectedSystem={selectedSystem}
            onMode={setNavigationMode}
            onSystem={setSelectedSystem}
          />
          <WorkspaceTabs
            tabs={displayTabs}
            activeId={workspace.activeId}
            changedKeys={changedDefinitionKeys}
            onActivate={(id) =>
              setWorkspace((state) => activateWorkspaceTab(state, id))
            }
            onClose={(id) =>
              setWorkspace((state) => closeWorkspaceTab(state, id))
            }
            onCloseOthers={(id) =>
              setWorkspace((state) => closeOtherWorkspaceTabs(state, id))
            }
          />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <CalibrationTerminologyControl
              mode={terminologyMode}
              onMode={setTerminologyMode}
            />
            <div className="text-right">
              <p className="font-semibold">
                {terminology.mode === "standard"
                  ? terminology.tableName
                  : terminology.sourceTitle}
              </p>
              {terminology.mode === "engineer" && terminology.sourceSymbol && (
                <p className="font-mono text-xs text-zinc-500">
                  {terminology.sourceSymbol}
                </p>
              )}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-400">
            <span>
              {terminology.x
                ? calibrationTermLabel("X", terminology.x)
                : "No X axis"}
            </span>
            <span>
              {terminology.y
                ? calibrationTermLabel("Y", terminology.y)
                : "No Y axis"}
            </span>
            <span>
              Cells · {terminology.output.label}
              {terminology.output.units ? ` [${terminology.output.units}]` : ""}
            </span>
          </div>
          {terminology.mode === "standard" &&
            (terminology.controls || terminology.whyItMatters) && (
              <div className="mb-4 grid gap-3 rounded-xl border border-zinc-800 bg-black/40 p-3 text-sm sm:grid-cols-2">
                {terminology.controls && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                      What it controls
                    </p>
                    <p className="mt-1 text-zinc-300">{terminology.controls}</p>
                  </div>
                )}
                {terminology.whyItMatters && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                      Why it matters
                    </p>
                    <p className="mt-1 text-zinc-300">
                      {terminology.whyItMatters}
                    </p>
                  </div>
                )}
              </div>
            )}
          <div className="flex flex-col gap-4 border-b border-zinc-800 pb-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.16em] text-blue-300">
                Calibration Workspace
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {terminology.tableName}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {detail.rows} × {detail.columns} ·{" "}
                {detail.summary.units || "units not supplied"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex rounded-lg border border-zinc-700 bg-black p-1"
                aria-label="Calibration view mode"
              >
                {(["grid", "2d", "3d"] as const).map((mode) => {
                  const enabled =
                    mode === "grid"
                      ? capabilities.grid
                      : mode === "2d"
                        ? capabilities.twoDimensional
                        : capabilities.threeDimensional;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={!enabled}
                      title={
                        enabled
                          ? `${VIEW_LABELS[mode]} view`
                          : mode === "2d"
                            ? capabilities.reason2d || "Unavailable"
                            : capabilities.reason3d || "Unavailable"
                      }
                      onClick={() => setView(mode)}
                      className={`rounded-md px-4 py-2 text-xs font-semibold ${view === mode ? "bg-blue-500/20 text-blue-200" : enabled ? "text-zinc-400 hover:text-white" : "cursor-not-allowed text-zinc-700"}`}
                    >
                      {VIEW_LABELS[mode]}
                    </button>
                  );
                })}
              </div>
              {!explorerVisible && !focus && (
                <button
                  type="button"
                  onClick={() => setExplorerCollapsed(false)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs"
                >
                  Show Explorer
                </button>
              )}
              {!inspectorVisible && !focus && (
                <button
                  type="button"
                  onClick={() => setInspectorCollapsed(false)}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs"
                >
                  Show Inspector
                </button>
              )}
              <button
                type="button"
                aria-pressed={focus}
                onClick={() => setFocus((value) => !value)}
                className="rounded-lg border border-blue-400/40 px-3 py-2 text-xs text-blue-200"
              >
                {focus ? "Restore Workspace" : "Focus Workspace"}
              </button>
            </div>
          </div>
          {subscriberSession && (
            <WorkingCalibrationPanel
              mode={displayMode}
              onMode={setDisplayMode}
              working={working}
              onCreate={() => {
                setWorking(newWorking());
                setDisplayMode("working");
              }}
              onUndo={() =>
                working &&
                setWorking(undoWorkingEdit(working, new Date().toISOString()))
              }
              onRedo={() =>
                working &&
                setWorking(redoWorkingEdit(working, new Date().toISOString()))
              }
              operation={operation}
              onOperation={setOperation}
              operand={operand}
              onOperand={setOperand}
              preview={preview}
              onApply={apply}
              selectedCount={selectedCells.length}
              definitionTitles={Object.fromEntries(
                workshop.definitions.map((item) => [
                  `${item.definitionRevision}:${item.occurrence}`,
                  item.title,
                ]),
              )}
              editQualified={
                detail.summary.editCapability?.state === "EDIT_QUALIFIED"
              }
              blockers={
                detail.summary.editCapability?.blockers ?? [
                  "EDIT authority is unavailable.",
                ]
              }
              warnings={detail.summary.editCapability?.warnings ?? []}
              saveStatus={saveStatus}
            />
          )}
          {!detail.summary.available ? (
            <Unavailable detail={detail} />
          ) : (
            <>
              {view === "grid" && (
                <Grid
                  detail={detail}
                  terminology={terminology}
                  currentCells={baseDetail.cells}
                  selected={selectedCells}
                  onSelect={selectCell}
                  rowAxis={visual.rowAxis}
                  columnAxis={visual.columnAxis}
                  canEdit={Boolean(
                    displayMode === "working" &&
                      working &&
                      detail.summary.editCapability?.state === "EDIT_QUALIFIED",
                  )}
                  onNavigate={navigateCell}
                  onCommit={commitDirect}
                />
              )}{" "}
              {view === "2d" && (
                <div className="mt-5">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    {detail.summary.shape === "2D" && (
                      <>
                        <select
                          aria-label="Slice direction"
                          value={sliceDirection}
                          onChange={(event) => {
                            setSliceDirection(
                              event.target.value as SliceDirection,
                            );
                            setSliceIndex(0);
                          }}
                          className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm"
                        >
                          <option value="row">Row slice</option>
                          <option value="column">Column slice</option>
                        </select>
                        <label className="text-xs text-zinc-400">
                          Slice
                          <input
                            type="number"
                            min={0}
                            max={
                              (sliceDirection === "row"
                                ? detail.rows
                                : detail.columns) - 1
                            }
                            value={sliceIndex}
                            onChange={(event) =>
                              setSliceIndex(Number(event.target.value))
                            }
                            className="ml-2 w-20 rounded border border-zinc-700 bg-black px-2 py-1"
                          />
                        </label>
                      </>
                    )}
                    <span className="text-xs text-zinc-500">
                      Reference grey ·{" "}
                      {displayMode === "working" ? "Working" : "Current"} blue ·
                      changed points amber-ringed
                    </span>
                  </div>
                  <CalibrationPlot2D
                    presentation={displayMode === "working" ? "reference-working" : "reference-current"}
                    model={visual}
                    terminology={terminology}
                    direction={
                      detail.summary.shape === "1D" ? "row" : sliceDirection
                    }
                    sliceIndex={detail.summary.shape === "1D" ? 0 : sliceIndex}
                    onSelect={(index) => selectCell(index)}
                  />
                </div>
              )}
              {view === "3d" && (
                <div className="mt-5">
                  <div className="mb-4 items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      Reference remains separate · surface displays{" "}
                      {displayMode === "working" ? "Working" : "Current"} values
                    </span>
                  </div>
                  <CalibrationSurface3D
                    model={visual}
                    detail={detail}
                    state={displayMode === "working" ? "working" : "current"}
                    terminology={terminology}
                    selectedCell={selectedCell}
                    onSelect={(index) => selectCell(index)}
                  />
                </div>
              )}
            </>
          )}
        </main>
        {inspectorVisible && (
          <Inspector
            workshop={workshop}
            cell={cell}
            currentCell={
              baseDetail.cells[selectedCell] ?? baseDetail.cells[0] ?? null
            }
            detail={detail}
            working={displayMode === "working" ? working : null}
            onCollapse={() => setInspectorCollapsed(true)}
          />
        )}
        <details className="bmw-border rounded-2xl bg-zinc-950 p-5 xl:col-span-full">
          <summary className="cursor-pointer font-semibold text-zinc-200">
            How to understand Grid, 2D and 3D
          </summary>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-zinc-400 md:grid-cols-3">
            <p>
              <strong className="text-zinc-200">Grid:</strong> the exact
              numerical calibration matrix. Each position is one qualified cell
              with Reference and Current values.
            </p>
            <p>
              <strong className="text-zinc-200">2D:</strong> a line or selected
              row/column slice of the same Evidence, useful for inspecting
              transitions and shape without flattening a full surface.
            </p>
            <p>
              <strong className="text-zinc-200">3D:</strong> X and Y locate the
              table position; surface height is the calibrated engineering
              value. Rotating changes viewpoint only. Reference/Current changes
              the displayed state.
            </p>
            <p className="md:col-span-3">
              Selected points correspond to exact Grid cells. Amber markers mean
              the cell differs, not that it is dangerous. Surface shape alone
              does not prove calibration quality or safety. Axis values, units
              and source labels are structural Evidence; semantic meanings such
              as RPM or Load appear only when qualified Knowledge supports them.
            </p>
          </div>
        </details>
      </section>
    </CalibrationTerminologyScope>
  );
}

function Explorer({
  workshop,
  detail,
  definitions,
  emptyState,
  selectedSystem,
  changedDefinitionKeys,
  search,
  filter,
  onSearch,
  onFilter,
  onOpen,
  onCollapse,
}: {
  workshop: WorkshopViewModel;
  detail: WorkshopViewModel["selectedDefinition"];
  definitions: WorkshopViewModel["definitions"];
  emptyState: "knowledge_empty" | "filter_zero" | null;
  selectedSystem: string | null;
  changedDefinitionKeys: ReadonlySet<string>;
  search: string;
  filter: WorkshopFilter;
  onSearch: (v: string) => void;
  onFilter: (v: WorkshopFilter) => void;
  onOpen: (definition: WorkshopViewModel["definitions"][number]) => void;
  onCollapse: () => void;
}) {
  return (
    <aside className="bmw-border rounded-2xl bg-zinc-950 p-4 xl:max-h-[940px]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-blue-300">
            Calibration Explorer
          </p>
          <h2 className="mt-1 text-xl font-semibold">All Tables</h2>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse Calibration Explorer"
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs"
        >
          Collapse
        </button>
      </div>
      <label
        className="mt-4 block text-xs text-zinc-500"
        htmlFor="definition-search"
      >
        Search Tables
      </label>
      <input
        id="definition-search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Title, identity, revision, units…"
        className="mt-2 w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-blue-400"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilter(item.id)}
            className={`rounded-full border px-2.5 py-1 text-xs ${filter === item.id ? "border-blue-400 bg-blue-400/15 text-blue-200" : "border-zinc-800 text-zinc-400"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {definitions.length}/{workshop.definitions.length}
      </p>
      <div className="mt-3 max-h-[690px] space-y-2 overflow-y-auto">
        {definitions.map((definition) => {
          const changed = changedDefinitionKeys.has(
            `${definition.definitionRevision}:${definition.occurrence}`,
          );
          return (
            <button
              type="button"
              key={definition.key}
              onClick={() => onOpen(definition)}
              className={`block w-full rounded-xl border p-3 text-left ${definition.key === detail.summary.key ? "border-blue-400/60 bg-blue-400/10" : changed ? "border-emerald-400/30 bg-emerald-400/5" : "border-zinc-800 bg-zinc-900"}`}
            >
              <DefinitionName definition={definition} />
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-400">
                <span>{definition.shape}</span>
                <span>{pretty(definition.outcome)}</span>
                {definition.changedCellCount > 0 && (
                  <span className="text-blue-300">
                    {definition.changedCellCount} Current changes
                  </span>
                )}
                {changed && (
                  <span className="text-emerald-300">Working changes</span>
                )}
                {definition.editCapability?.state !== "EDIT_QUALIFIED" && (
                  <span className="text-amber-300">Non-editable</span>
                )}
              </div>
            </button>
          );
        })}
        {!definitions.length && (
          <p className="p-4 text-sm text-zinc-500">
            {emptyState === "knowledge_empty"
              ? `No qualified ${selectedSystem ?? "Tuning"} Essentials Tables are available for this calibration yet.`
              : "No Tables match the current search or filter."}
          </p>
        )}
      </div>
    </aside>
  );
}
function Unavailable({
  detail,
}: {
  detail: WorkshopViewModel["selectedDefinition"];
}) {
  return (
    <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-5">
      <p className="font-semibold text-amber-200">
        Calibration Table unavailable
      </p>
      <p className="mt-2 text-sm">
        Stage: {detail.unavailableStage || "Unspecified"}
      </p>
      {detail.findings.map((finding) => (
        <p key={finding} className="mt-2 text-sm text-zinc-400">
          {finding}
        </p>
      ))}
    </div>
  );
}
export function Grid({
  detail,
  terminology,
  currentCells,
  selected,
  onSelect,
  canEdit,
  onNavigate,
  onCommit,
  onEditingChange,
  onDraftCancelled,
}: {
  detail: WorkshopViewModel["selectedDefinition"];
  terminology: CalibrationTerminology;
  currentCells: WorkshopViewModel["selectedDefinition"]["cells"];
  selected: readonly number[];
  onSelect: (index: number, region?: boolean) => void;
  rowAxis: ReturnType<typeof buildCalibrationVisualizationModel>["rowAxis"];
  columnAxis: ReturnType<
    typeof buildCalibrationVisualizationModel
  >["columnAxis"];
  canEdit: boolean;
  onEditingChange?: (index: number, editing: boolean) => void;
  onDraftCancelled?: () => void;
  onNavigate: (index: number) => void;
  onCommit: (
    index: number,
    value: number,
  ) => ReturnType<Parameters<typeof DirectGridCell>[0]["onCommit"]>;
}) {
  const presentation = useMemo(
    () =>
      buildGridAxisPresentation({
        shape: detail.summary.shape,
        rows: detail.rows,
        columns: detail.columns,
        axes: detail.axes,
        referenceAxes: detail.referenceAxes,
        semantic: detail.summary.semantic,
        outputUnits: detail.summary.units,
      }),
    [detail],
  );
  return (
    <CalibrationAxisGrid
      presentation={presentation}
      terminology={terminology}
      rows={detail.rows}
      columns={detail.columns}
      renderCell={(r, c) => {
        const i = r * detail.columns + c,
          item = detail.cells[i],
          key = `${detail.summary.definitionRevision}:${detail.summary.occurrence}:${i}`;
        return item ? (
          <td key={key}>
            <DirectGridCell
              cellKey={key}
              index={i}
              row={r}
              column={c}
              columnCount={detail.columns}
              value={item.currentValue}
              currentValue={currentCells[i]?.currentValue ?? item.currentValue}
              referenceValue={item.referenceValue}
              changed={item.changed}
              selected={selected.includes(i)}
              canEdit={canEdit}
              onEditingChange={editing => onEditingChange?.(item.index, editing)}
              onDraftCancelled={onDraftCancelled}
              onSelect={onSelect}
              onNavigate={onNavigate}
              onCommit={(value) => onCommit(i, value)}
              format={number}
            />
          </td>
        ) : (
          <td key={key}>—</td>
        );
      }}
      footer={
        <p className="mt-2 text-xs text-zinc-500">
          Drag or Shift-click selects a rectangular region. Arrow keys navigate
          governed coordinates. In WORKING mode, double-click or press Enter on
          an editable cell; Enter applies, Escape cancels, and Tab moves between
          cells.
        </p>
      }
    />
  );
}
export function Inspector({
  workshop,
  cell,
  currentCell,
  detail,
  working,
  onCollapse,
}: {
  workshop: WorkshopViewModel;
  cell: WorkshopViewModel["selectedDefinition"]["cells"][number] | null;
  currentCell: WorkshopViewModel["selectedDefinition"]["cells"][number] | null;
  detail: WorkshopViewModel["selectedDefinition"];
  working: WorkingCalibration | null;
  onCollapse: () => void;
}) {
  const terminology = useCalibrationTerminologyScope();
  const info = detail.information,
    semantic = detail.summary.semantic,
    presentation = useMemo(
      () =>
        buildGridAxisPresentation({
          shape: detail.summary.shape,
          rows: detail.rows,
          columns: detail.columns,
          axes: detail.axes,
          referenceAxes: detail.referenceAxes,
          semantic,
          outputUnits: detail.summary.units,
        }),
      [detail, semantic],
    ),
    coordinate = cell
      ? gridAxisCoordinate(presentation, cell.row, cell.column)
      : null,
    delta =
      cell && currentCell ? cell.currentValue - currentCell.currentValue : 0,
    percentage =
      currentCell?.currentValue === 0
        ? null
        : currentCell
          ? (delta / currentCell.currentValue) * 100
          : null,
    workingRaw =
      cell && working
        ? engineeringToRawRepresentation(
            cell.currentValue,
            detail.summary.editCapability?.inverse ?? null,
          )
        : null;
  return (
    <aside className="bmw-border space-y-5 rounded-2xl bg-zinc-950 p-5">
      <div className="flex justify-between">
        <p className="text-xs uppercase tracking-[.16em] text-blue-300">
          Cell Inspector
        </p>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse Cell Inspector"
          className="rounded border border-zinc-700 px-2 py-1 text-xs"
        >
          Collapse
        </button>
      </div>
      {cell ? (
        <dl
          className="grid grid-cols-2 gap-3 text-sm"
          data-selection={`${detail.summary.definitionRevision}:${detail.summary.occurrence}:${cell.index}`}
        >
          <dt className="text-zinc-500">Row / column</dt>
          <dd>
            R{cell.row + 1} / C{cell.column + 1}
          </dd>
          {coordinate?.x && (
            <>
              <dt className="text-zinc-500">{terminology?.x?.label ?? "X"}</dt>
              <dd>
                {String(coordinate.x.value)} {terminology?.x?.units}
              </dd>
            </>
          )}
          {coordinate?.y && (
            <>
              <dt className="text-zinc-500">{terminology?.y?.label ?? "Y"}</dt>
              <dd>
                {String(coordinate.y.value)} {terminology?.y?.units}
              </dd>
            </>
          )}
          <dt className="text-zinc-500">Reference</dt>
          <dd>{number(cell.referenceValue)}</dd>
          <dt className="text-zinc-500">Current</dt>
          <dd>{number(currentCell?.currentValue ?? cell.currentValue)}</dd>
          <dt className="text-zinc-500">Working</dt>
          <dd>{working ? number(cell.currentValue) : "Not created"}</dd>
          <dt className="text-zinc-500">Delta</dt>
          <dd>{working ? number(delta) : "Unavailable"}</dd>
          <dt className="text-zinc-500">Percentage delta</dt>
          <dd>
            {working
              ? percentage === null
                ? "Undefined from zero"
                : `${number(percentage)}%`
              : "Unavailable"}
          </dd>
          <dt className="text-zinc-500">Raw representation</dt>
          <dd>
            {number(
              workingRaw ??
                currentCell?.currentRawValue ??
                cell.currentRawValue,
            )}
          </dd>
          <dt className="text-zinc-500">Raw state</dt>
          <dd>{workingRaw === null ? "CURRENT" : "WORKING"}</dd>
          <dt className="text-zinc-500">EDIT capability</dt>
          <dd>{detail.summary.editCapability?.state ?? "VIEW_ONLY"}</dd>
          <dt className="text-zinc-500">Units</dt>
          <dd>{cell.units || "Not supplied"}</dd>
        </dl>
      ) : (
        <p>No qualified cell.</p>
      )}
      <section className="border-t border-zinc-800 pt-4">
        <p className="text-xs uppercase tracking-[.16em] text-blue-300">
          Table Information
        </p>
        <h3 className="mt-2 font-semibold">{detail.summary.title}</h3>
        <p className="mt-2 text-sm text-zinc-400">
          {info.sourceDescription || "No source description supplied."}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <dt className="text-zinc-500">Structure</dt>
          <dd>
            {info.shape} · {info.dimensions.rows} × {info.dimensions.columns}
          </dd>
          <dt className="text-zinc-500">Comparison</dt>
          <dd>{pretty(info.comparisonOutcome)}</dd>
          <dt className="text-zinc-500">Current changed cells</dt>
          <dd>{info.changedCellCount}</dd>
          <dt className="text-zinc-500">Axis state</dt>
          <dd>{pretty(info.axisChangeState)} · Current axes displayed</dd>
        </dl>
      </section>
      <section className="border-t border-zinc-800 pt-4">
        <p className="text-xs uppercase tracking-[.16em] text-blue-300">
          Original engineering language
        </p>
        <p className="mt-2 text-sm">{detail.summary.title}</p>
        <p className="mt-2 text-xs text-zinc-400">
          {info.sourceDescription || "No source description supplied."}
        </p>
        {[
          ...(detail.summary.editCapability?.warnings ?? []),
          ...(detail.summary.editCapability?.blockers ?? []),
        ].map((value) => (
          <p key={value} className="mt-2 text-xs text-amber-200">
            {value}
          </p>
        ))}
      </section>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Engineering Detail
        </summary>
        <div className="mt-3 space-y-2 break-all text-xs text-zinc-400">
          <p>Workshop instance: {info.workshopInstanceIdentity}</p>
          <p>Definition: {info.definitionIdentity || "Unavailable"}</p>
          <p>Revision: {info.definitionRevision}</p>
          <p>Definition Set: {info.definitionSetRevision}</p>
          <p>ROM Layout: {info.romLayoutId}</p>
          <p>Source artifact: {info.sourceArtifactDigest}</p>
          {semantic.knowledgeId && (
            <p>
              Knowledge: {semantic.knowledgeId} · {semantic.knowledgeRevision}
            </p>
          )}
          {workshop.provenance.map((value) => (
            <p key={value}>{value}</p>
          ))}
        </div>
      </details>
    </aside>
  );
}
