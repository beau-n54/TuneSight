import { MAX_OPEN_WORKSPACE_TABS, openWorkspaceTab, type WorkspaceTabsState, type WorkspaceTabState } from "./workspaceTabs.ts";

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
