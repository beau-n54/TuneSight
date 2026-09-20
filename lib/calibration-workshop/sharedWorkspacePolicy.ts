import { MAX_OPEN_WORKSPACE_TABS, openWorkspaceTab, type WorkspaceTabsState, type WorkspaceTabState } from "./workspaceTabs.ts";
import type { WorkspaceTableProjection } from "./sharedWorkspaceAdapter.ts";
import type { CalibrationVisualizationModel } from "./visualizationModel.ts";

export const pendingTransitionAllowed = (pendingDirectInputs: number) => pendingDirectInputs === 0;
export function recognizedReviewDevice(userAgent: string, platform: string, maxTouchPoints: number) {
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function requestWorkspaceTab(state: WorkspaceTabsState, tab: WorkspaceTabState) {
  if (!state.tabs.some(item => item.id === tab.id) && state.tabs.length >= MAX_OPEN_WORKSPACE_TABS) {
    return { state, capacity: true };
  }
  return { state: openWorkspaceTab(state, tab), capacity: false };
}

export function workspaceInteractionPolicy(width: number, finePointer: boolean, reviewDevice = false) {
  const editing = width >= 900 && finePointer && !reviewDevice;
  return { editing, reason: editing ? null : "This display supports read-only review. EDIT qualification is unchanged; use a desktop or laptop for editing." };
}

/** Gate the existing renderer, never invent or repair its axes. Current-only plots await U3. */
export function existingRendererViews(projection: WorkspaceTableProjection, model: CalibrationVisualizationModel | null) {
  const current = projection.slots.current;
  const grid = current.geometry.grid;
  const compatible = model !== null && current.axes.filter(axis => axis.orientation !== null).every(axis => {
    const rendered = axis.orientation === "X" ? model.columnAxis : model.rowAxis;
    return axis.id === rendered.id && JSON.stringify(axis.values) === JSON.stringify(rendered.values);
  });
  const rendererReason = !model ? "The retained Current-only plot does not supply source-bound line/surface geometry. Grid remains available; renderer consolidation requires U3."
    : !compatible ? "The retained renderer axes do not match the supplied X/Y evidence. Grid remains available." : null;
  return { grid, line: current.geometry.line.supported && !rendererReason && Boolean(model?.capabilities.twoDimensional),
    surface: current.geometry.surface.supported && !rendererReason && Boolean(model?.capabilities.threeDimensional),
    reason2d: current.geometry.line.reason ?? rendererReason,
    reason3d: current.geometry.surface.reason ?? rendererReason };
}
