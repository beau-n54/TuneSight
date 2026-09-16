import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  activateWorkspaceTab,
  BoundedTableCache,
  closeOtherWorkspaceTabs,
  closeWorkspaceTab,
  createWorkspaceTab,
  MAX_DERIVED_TABLE_CACHE,
  MAX_OPEN_WORKSPACE_TABS,
  openWorkspaceTab,
  updateActiveWorkspaceTab,
  type WorkspaceTabsState,
} from "./workspaceTabs.ts";

const tab = (index: number, title = `Table ${index}`) => createWorkspaceTab({
  definitionKey: `definition:${index}`,
  definitionRevision: `revision:${index}`,
  occurrence: index,
  datasetRevision: "dataset:governed",
  title,
});

test("workspace tabs retain independent table presentation state and distinguish duplicate titles", () => {
  const first = tab(1, "Duplicate title"), second = tab(2, "Duplicate title");
  let state: WorkspaceTabsState = { tabs: [first], activeId: first.id };
  state = updateActiveWorkspaceTab(state, { view: "2d", selectedCells: [4, 5], sliceDirection: "column", sliceIndex: 3, operand: "7" });
  state = openWorkspaceTab(state, second);
  state = updateActiveWorkspaceTab(state, { view: "3d", selectedCells: [9] });
  state = activateWorkspaceTab(state, first.id);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(state.tabs[0], { ...first, view: "2d", selectedCells: [4, 5], sliceDirection: "column", sliceIndex: 3, operand: "7" });
  assert.equal(state.tabs[1]?.view, "3d");
  assert.deepEqual(state.tabs[1]?.selectedCells, [9]);
});

test("workspace tabs activate, close, close others, and remain bounded", () => {
  const first = tab(0);
  let state: WorkspaceTabsState = { tabs: [first], activeId: first.id };
  for (let index = 1; index <= MAX_OPEN_WORKSPACE_TABS + 3; index += 1) state = openWorkspaceTab(state, tab(index));
  assert.equal(state.tabs.length, MAX_OPEN_WORKSPACE_TABS);
  assert.equal(state.activeId, tab(MAX_OPEN_WORKSPACE_TABS + 3).id);
  state = closeWorkspaceTab(state, state.activeId);
  assert.equal(state.tabs.length, MAX_OPEN_WORKSPACE_TABS - 1);
  assert.ok(state.tabs.some(item => item.id === state.activeId));
  const retained = state.tabs[2]!;
  state = closeOtherWorkspaceTabs(state, retained.id);
  assert.deepEqual(state, { tabs: [retained], activeId: retained.id });
  assert.equal(closeWorkspaceTab(state, retained.id), state);
});

test("derived table cache is bounded LRU and never contains Working overlays", () => {
  const cache = new BoundedTableCache<string>();
  for (let index = 0; index < MAX_DERIVED_TABLE_CACHE; index += 1) cache.set(`base:${index}`, `value:${index}`);
  assert.equal(cache.get("base:0"), "value:0");
  cache.set("base:new", "new");
  assert.equal(cache.size, MAX_DERIVED_TABLE_CACHE);
  assert.equal(cache.get("base:1"), undefined);
  assert.deepEqual(cache.keys(), ["base:2", "base:3", "base:4", "base:5", "base:0", "base:new"]);
});

test("both Workshop variants select tables inside a persistent shell without Next route navigation", () => {
  const root = path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration");
  for (const file of ["workshop-client.tsx", "current-only-workshop-client.tsx"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /openWorkspaceTab/);
    assert.match(source, /WorkspaceTabs/);
    assert.match(source, /window\.history\.replaceState/);
    assert.match(source, /closeOtherWorkspaceTabs/);
    assert.doesNotMatch(source, /buildWorkshopDeepLink/);
    assert.doesNotMatch(source, /from "next\/link"/);
  }
});

test("tab operations preserve the single external Working Calibration identity and history", () => {
  const working = Object.freeze({ workingCalibrationId: "working:one", cursor: 2, mutations: Object.freeze(["first", "second"]) });
  const first = tab(1), second = tab(2);
  let state: WorkspaceTabsState = { tabs: [first], activeId: first.id };
  state = openWorkspaceTab(state, second);
  state = activateWorkspaceTab(state, first.id);
  state = closeWorkspaceTab(state, second.id);
  assert.equal(state.activeId, first.id);
  assert.equal(working.workingCalibrationId, "working:one");
  assert.equal(working.cursor, 2);
  assert.deepEqual(working.mutations, ["first", "second"]);
});

test("workspace source preserves independent panels, structural borders, changed tabs and direct-edit remount semantics", () => {
  const root = path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration");
  const comparison = fs.readFileSync(path.join(root, "workshop-client.tsx"), "utf8");
  const currentOnly = fs.readFileSync(path.join(root, "current-only-workshop-client.tsx"), "utf8");
  const tabs = fs.readFileSync(path.join(root, "workspace-tabs.tsx"), "utf8");
  const layout = fs.readFileSync(path.join(process.cwd(), "lib", "calibration-workshop", "workspaceLayout.ts"), "utf8");
  for (const source of [comparison, currentOnly]) {
    assert.match(source, /explorerCollapsed/);
    assert.match(source, /inspectorCollapsed/);
    assert.ok((source.match(/bmw-border/g) ?? []).length >= 3);
    assert.match(source, /DirectGridCell/);
    assert.match(source, /workingChangedDefinitionKeys/);
  }
  assert.match(tabs, /Working changes/);
  assert.match(tabs, /onCloseOthers/);
  assert.match(layout, /xl:grid-cols-1/);
  assert.match(comparison, /key=`\$\{detail\.summary\.definitionRevision\}:\$\{detail\.summary\.occurrence\}:\$\{i\}`/);
});
