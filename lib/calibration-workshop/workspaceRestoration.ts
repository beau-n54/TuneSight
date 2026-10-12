import { exactWorkspaceDefinition, sharedWorkspaceContextKey, type WorkspaceCatalogue } from "./sharedWorkspaceAdapter.ts";
import type { ProjectionContext } from "./sharedTableProjection.ts";
import { createWorkspaceTab, MAX_OPEN_WORKSPACE_TABS, type WorkspaceTabsState, type WorkspaceTabState } from "./workspaceTabs.ts";
import type { TableDisplayLayer } from "./sharedTablePresentation.ts";
import type { EngineeringNavigationMode } from "./engineeringNavigation.ts";

import { WORKSPACE_UI_VERSION } from "./workspaceUiVersion.ts";
export { WORKSPACE_UI_VERSION } from "./workspaceUiVersion.ts";
export type WorkspaceUiState = Readonly<{ workspace: WorkspaceTabsState; search: string; navigationMode: EngineeringNavigationMode;
  system: string | null; evidenceFilter: string; displayMode: TableDisplayLayer;
  panels: Readonly<{ explorerCollapsed: boolean; inspectorCollapsed: boolean; focusWorkspace: boolean }> }>;
export const workspaceUiKey = (context: ProjectionContext, workshop: Pick<WorkspaceCatalogue, "source">, displayClass: string) =>
  WORKSPACE_UI_VERSION + ":" + displayClass + ":" + sharedWorkspaceContextKey(context, workshop);

export function serializeWorkspaceUi(scope: string, state: WorkspaceUiState): string {
  // No evidence, numeric cells, edit operands, pending input, Working mutations or history in UI storage.
  return JSON.stringify({ version: WORKSPACE_UI_VERSION, scope, ...state,
    workspace: { activeId: state.workspace.activeId, tabs: state.workspace.tabs.map(tab => ({ ...createWorkspaceTab(tab),
      view: tab.view, selectedCells: tab.selectedCells, sliceDirection: tab.sliceDirection, sliceIndex: tab.sliceIndex,
      camera: tab.camera, plotView: tab.plotView, gridZoom: tab.gridZoom })) },
    panels: { ...state.panels, focusWorkspace: false } });
}

export function restoreWorkspaceUi(raw: string | null, scope: string, workshop: WorkspaceCatalogue,
  requestedKey: string | undefined, workingAvailable: boolean, referenceAvailable: boolean): { state: WorkspaceUiState | null; finding: string | null; preserveSaved?: boolean } {
  if (!raw) return { state: null, finding: null };
  try {
    if (raw.length > 96_000) throw Error();
    const saved = JSON.parse(raw) as WorkspaceUiState & { version: string; scope: string };
    if (saved.version !== WORKSPACE_UI_VERSION || saved.scope !== scope || !Array.isArray(saved.workspace?.tabs) || saved.workspace.tabs.length > MAX_OPEN_WORKSPACE_TABS) throw Error();
    if (typeof saved.search !== "string" || saved.search.length > 500 || !["all", "essentials", "systems", "evidence"].includes(saved.navigationMode) ||
      !(saved.system === null || typeof saved.system === "string" && saved.system.length <= 500) || !["all", "working", "reference", "unavailable"].includes(saved.evidenceFilter) ||
      !["reference", "current", "working"].includes(saved.displayMode) || typeof saved.panels?.explorerCollapsed !== "boolean" || typeof saved.panels.inspectorCollapsed !== "boolean") throw Error();
    const preferences = { search: saved.search, navigationMode: saved.navigationMode, system: saved.system, evidenceFilter: saved.evidenceFilter,
      displayMode: saved.displayMode, panels: { explorerCollapsed: saved.panels.explorerCollapsed, inspectorCollapsed: saved.panels.inspectorCollapsed, focusWorkspace: false } };
    const seen = new Set<string>();
    const tabs: WorkspaceTabState[] = saved.workspace.tabs.map((tab: WorkspaceTabState) => {
      const definition = exactWorkspaceDefinition(workshop, tab.definitionKey);
      if (!definition || definition.definitionRevision !== tab.definitionRevision || definition.occurrence !== tab.occurrence || tab.datasetRevision !== workshop.source.currentDatasetRevision) throw Error();
      const seed = workshop.definitions.find(item => item.key === definition.key)!;
      const cellCount = seed.available ? seed.rows * seed.columns : 0;
      const admitted = createWorkspaceTab({ ...definition, definitionKey: definition.key, datasetRevision: workshop.source.currentDatasetRevision });
      if (tab.id !== admitted.id || seen.has(tab.id)) throw Error();
      seen.add(tab.id);
      if (!Array.isArray(tab.selectedCells) || tab.selectedCells.length > Math.max(1, cellCount) || tab.selectedCells.some(index => !Number.isSafeInteger(index) || (cellCount ? index < 0 || index >= cellCount : index !== 0))) throw Error();
      if (!["grid", "2d", "3d"].includes(tab.view) || !["row", "column"].includes(tab.sliceDirection) || !Number.isSafeInteger(tab.sliceIndex) || tab.sliceIndex < 0 || tab.sliceIndex >= Math.max(1, tab.sliceDirection === "row" ? seed?.rows ?? 0 : seed?.columns ?? 0)) throw Error();
      const bounded = (value: number, low: number, high: number) => Number.isFinite(value) && value >= low && value <= high;
      if (tab.camera && (!bounded(tab.camera.rotation, -1000, 1000) || !bounded(tab.camera.tilt, .25, 1.25) || !bounded(tab.camera.zoom, .65, 1.8))) throw Error();
      if (tab.plotView && (!bounded(tab.plotView.zoom, 1, 3) || !bounded(tab.plotView.pan, 0, 900))) throw Error();
      if (tab.gridZoom !== undefined && !bounded(tab.gridZoom, .75, 1.5)) throw Error();
      return { ...admitted, view: tab.view, selectedCells: [...new Set(tab.selectedCells)], sliceDirection: tab.sliceDirection, sliceIndex: tab.sliceIndex,
        camera: tab.camera, plotView: tab.plotView, gridZoom: tab.gridZoom };
    });
    let activeId = saved.workspace.activeId;
    if (requestedKey !== undefined) {
      const explicit = exactWorkspaceDefinition(workshop, requestedKey);
      if (!explicit) return { preserveSaved: true, state: { ...preferences, workspace: { tabs: [], activeId: "" } }, finding: "The explicit Table is unresolved; saved selection was not substituted." };
      const tab = createWorkspaceTab({ ...explicit, definitionKey: explicit.key, datasetRevision: workshop.source.currentDatasetRevision });
      if (!tabs.some(item => item.id === tab.id)) {
        if (tabs.length === MAX_OPEN_WORKSPACE_TABS) return { state: null, preserveSaved: true, finding: "Saved tabs are at capacity. The explicit Table takes precedence; saved tabs were not overwritten." };
        tabs.push(tab);
      }
      activeId = tab.id;
    }
    if (tabs.length ? !tabs.some(tab => tab.id === activeId) : activeId !== "") throw Error();
    if (typeof saved.search !== "string" || saved.search.length > 500 || !["all", "essentials", "systems", "evidence"].includes(saved.navigationMode) ||
      !(saved.system === null || typeof saved.system === "string") || !["all", "working", "reference", "unavailable"].includes(saved.evidenceFilter) ||
      !["reference", "current", "working"].includes(saved.displayMode) || typeof saved.panels?.explorerCollapsed !== "boolean" || typeof saved.panels.inspectorCollapsed !== "boolean") throw Error();
    const unavailable = saved.displayMode === "working" && !workingAvailable || saved.displayMode === "reference" && !referenceAvailable;
    return { state: { workspace: { tabs, activeId }, search: saved.search, navigationMode: saved.navigationMode, system: saved.system,
      evidenceFilter: saved.evidenceFilter === "reference" && !referenceAvailable ? "all" : saved.evidenceFilter,
      displayMode: unavailable ? "current" : saved.displayMode, panels: { ...saved.panels, focusWorkspace: false } },
      finding: unavailable ? "Saved layer is unavailable. Immutable Current is shown; no Working history or Reference was substituted." : null };
  } catch { return { state: null, preserveSaved: true, finding: "Saved workspace selection is incompatible or unreadable. Select an exact Table in Explorer; no saved values were restored." }; }
}
