import type { WorkingEditOperation } from "./workingCalibration.ts";

export type WorkspaceView = "grid" | "2d" | "3d";
export type WorkspaceTabState = Readonly<{
  id: string;
  definitionKey: string;
  definitionRevision: string;
  occurrence: number;
  datasetRevision: string;
  title: string;
  view: WorkspaceView;
  selectedCells: readonly number[];
  sliceDirection: "row" | "column";
  sliceIndex: number;
  operation: WorkingEditOperation;
  operand: string;
}>;
export type WorkspaceTabsState = Readonly<{ tabs: readonly WorkspaceTabState[]; activeId: string }>;
export const MAX_OPEN_WORKSPACE_TABS = 12;
export const MAX_DERIVED_TABLE_CACHE = 6;

export function workspaceTabId(input: Pick<WorkspaceTabState, "datasetRevision" | "definitionRevision" | "occurrence">): string {
  return [input.datasetRevision, input.definitionRevision, input.occurrence].map(value => encodeURIComponent(String(value))).join("::");
}
export function createWorkspaceTab(input: Pick<WorkspaceTabState, "definitionKey" | "definitionRevision" | "occurrence" | "datasetRevision" | "title">): WorkspaceTabState {
  return Object.freeze({ ...input, id: workspaceTabId(input), view: "grid", selectedCells: Object.freeze([0]), sliceDirection: "row", sliceIndex: 0, operation: "assign", operand: "" });
}
export function openWorkspaceTab(state: WorkspaceTabsState, tab: WorkspaceTabState, maximum = MAX_OPEN_WORKSPACE_TABS): WorkspaceTabsState {
  if (state.tabs.some(item => item.id === tab.id)) return Object.freeze({ tabs: state.tabs, activeId: tab.id });
  const tabs = [...state.tabs, tab];
  if (tabs.length > maximum) { const removable = tabs.findIndex(item => item.id !== state.activeId); if (removable >= 0) tabs.splice(removable, 1); }
  return Object.freeze({ tabs: Object.freeze(tabs), activeId: tab.id });
}
export function updateActiveWorkspaceTab(state: WorkspaceTabsState, update: Partial<Omit<WorkspaceTabState, "id" | "definitionKey" | "definitionRevision" | "occurrence" | "datasetRevision">>): WorkspaceTabsState {
  return Object.freeze({ ...state, tabs: Object.freeze(state.tabs.map(tab => tab.id === state.activeId ? Object.freeze({ ...tab, ...update }) : tab)) });
}
export function closeWorkspaceTab(state: WorkspaceTabsState, id: string): WorkspaceTabsState {
  if (state.tabs.length <= 1 || !state.tabs.some(tab => tab.id === id)) return state;
  const index = state.tabs.findIndex(tab => tab.id === id), tabs = state.tabs.filter(tab => tab.id !== id);
  const activeId = state.activeId === id ? tabs[Math.max(0, index - 1)]!.id : state.activeId;
  return Object.freeze({ tabs: Object.freeze(tabs), activeId });
}
export function closeOtherWorkspaceTabs(state: WorkspaceTabsState, id: string): WorkspaceTabsState {
  const retained = state.tabs.find(tab => tab.id === id); return retained ? Object.freeze({ tabs: Object.freeze([retained]), activeId: id }) : state;
}
export function activateWorkspaceTab(state: WorkspaceTabsState, id: string): WorkspaceTabsState { return state.tabs.some(tab => tab.id === id) ? Object.freeze({ tabs: state.tabs, activeId: id }) : state; }

export class BoundedTableCache<T> {
  readonly #entries = new Map<string, T>();
  readonly maximum: number;
  constructor(maximum = MAX_DERIVED_TABLE_CACHE) { if (!Number.isInteger(maximum) || maximum < 1) throw new Error("Table cache bound must be a positive integer."); this.maximum = maximum; }
  get(key: string): T | undefined { const value = this.#entries.get(key); if (value === undefined) return undefined; this.#entries.delete(key); this.#entries.set(key, value); return value; }
  set(key: string, value: T): T { this.#entries.delete(key); this.#entries.set(key, value); while (this.#entries.size > this.maximum) this.#entries.delete(this.#entries.keys().next().value!); return value; }
  get size(): number { return this.#entries.size; }
  keys(): readonly string[] { return Object.freeze([...this.#entries.keys()]); }
}
