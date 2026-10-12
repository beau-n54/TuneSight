import "./componentTestLoader.fixtures.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { before } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadSubscriberCalibration, type SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { controlledProjectionFixture, fixtureAxis } from "./sharedTableProjection.fixtures.ts";
import { projectSharedTable } from "./sharedTableProjection.ts";
import { workspaceCatalogue, compactWorkspaceProjection, projectWorkspaceTable, sharedWorkspaceEvidence, resolveProjectedWorkingDefinition } from "./sharedWorkspaceAdapter.ts";
import { buildSharedTablePresentation, exactNumber } from "./sharedTablePresentation.ts";
import { buildCalibrationSlice, buildCalibrationSurfaceMesh } from "./visualizationModel.ts";
import { createWorkingCalibration, applyWorkingEdit, undoWorkingEdit, redoWorkingEdit } from "./workingCalibration.ts";
import { bindDefinitionKnowledge, type QualifiedSemanticField } from "./definitionKnowledgeBinding.ts";
import { restoreWorkspaceUi, serializeWorkspaceUi, workspaceUiKey, type WorkspaceUiState } from "./workspaceRestoration.ts";
import { createWorkspaceTab } from "./workspaceTabs.ts";
import { createBrowserWorkingCalibrationStore, workingRestoreDefinitions } from "./workingCalibrationPersistence.ts";

const { Grid, Inspector, TableGuidance } = await import("../../app/dashboard/vehicles/[id]/calibration/workshop-client.tsx");
const { default: Plot } = await import("../../app/dashboard/vehicles/[id]/calibration/CalibrationPlot2D.tsx");
const context = { ownerId: "r02-controlled", vehicleId: "r02-vehicle", sessionId: "r02-session", sourceMode: "subscriber" as const };
let anchor: SubscriberCalibrationSuccess;
before(async () => {
  const result = await loadSubscriberCalibration({ bytes: fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"), fileName: "r02-controlled.bin", mimeType: null, observedAt: "2026-10-12T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready"); if (result.status !== "workshop_ready") throw Error("Controlled anchor failed"); anchor = result;
});
function fixture(shape: "scalar" | "array_1d" | "table_2d" = "table_2d", rows = 2, columns = 3, axes = [fixtureAxis("X", [1000, 1500, 3000], "rpm"), fixtureAxis("Y", [20, 40], "%")]) {
  const input = controlledProjectionFixture(anchor.material.current, { shape, rows, columns, axes });
  return compactWorkspaceProjection(projectSharedTable(input));
}
function native(withAxes = false) {
  const selected = anchor.workshop.definitions.find(item => item.editCapability?.state === "EDIT_QUALIFIED" && (!withAxes || item.shape === "2D") && ("available" in item ? item.available : item.availability === "current_available"))!;
  return compactWorkspaceProjection(projectWorkspaceTable(anchor.workshop, sharedWorkspaceEvidence(anchor), context, selected.key));
}
const html = (model: ReturnType<typeof buildSharedTablePresentation>) => renderToStaticMarkup(React.createElement(Inspector, { model, selected: 0, definitions: [], onOpen() {}, onCollapse() {} }));

for (const mode of ["standard", "engineer"] as const) for (const [shape, rows, columns, axes, line, surface] of [
  ["scalar", 1, 1, [], false, false], ["array_1d", 1, 3, [fixtureAxis("x", [1, 7, 20])], true, false],
  ["array_1d", 3, 1, [fixtureAxis("y", [1, 7, 20])], true, false],
  ["table_2d", 2, 3, [fixtureAxis("x", [1, 7, 20]), fixtureAxis("y", [40, 70])], true, true],
] as const) test(`R02 shared ${shape} ${rows}x${columns} without Reference in ${mode}`, () => {
  const projection = fixture(shape, rows, columns, [...axes]);
  const before = JSON.stringify(projection), model = buildSharedTablePresentation(projection, null, "current", mode);
  assert.equal(model.views.grid, true); assert.equal(model.views.line, line); assert.equal(model.views.surface, surface);
  assert.deepEqual(model.cells.map(cell => cell.value), projection.slots.current.cells.map(cell => cell.value));
  assert.ok(model.cells.every(cell => cell.reference === null && cell.referenceDelta === null && cell.workingValue === null));
  assert.equal(JSON.stringify(projection), before);
  const grid = renderToStaticMarkup(React.createElement(Grid, { model, selected: [0], canEdit: false, onSelect() {}, onNavigate() {}, onCommit() { throw Error("Render cannot mutate"); } }));
  assert.equal((grid.match(/data-working-cell=/g) ?? []).length, rows * columns);
  assert.match(html(model), /Cell Inspector/); assert.match(html(model), /Unavailable/); assert.match(html(model), /Related Tables/);
  if (line) assert.equal(buildCalibrationSlice(model.visual, columns === 1 ? "column" : "row", 0).length, Math.max(rows, columns));
});

test("R02 same-size axes retain explicit orientation, missing or duplicate bindings never match by length", () => {
  const swapped = fixture("table_2d", 2, 2, [fixtureAxis("Y", [10, 20]), fixtureAxis("X", [100, 300])]);
  const model = buildSharedTablePresentation(swapped, null, "current", "standard");
  assert.deepEqual(model.visual.columnAxis.values, [100, 300]); assert.deepEqual(model.visual.rowAxis.values, [10, 20]);
  for (const axes of [[fixtureAxis("unknown", [1, 2]), fixtureAxis("y", [3, 4])], [fixtureAxis("x", [1, 2]), fixtureAxis("X", [4, 5]), fixtureAxis("y", [3, 4])]]) {
    const unresolved = buildSharedTablePresentation(fixture("table_2d", 2, 2, axes), null, "current", "standard");
    assert.equal(unresolved.views.line, false); assert.equal(unresolved.views.surface, false);
    assert.equal(unresolved.terminology.grid.x?.usedStructuralFallback, true);
    assert.match(unresolved.terminology.x!.label, /Structural column index/);
  }
});
test("R02 categorical and non-monotonic source axes never manufacture a surface", () => {
  for (const axis of [fixtureAxis("x", ["cold", "warm", "hot"]), fixtureAxis("x", [1, 3, 2]), fixtureAxis("x", [1, 1, 3])]) {
    const model = buildSharedTablePresentation(fixture("table_2d", 2, 3, [axis, fixtureAxis("y", [1, 2])]), null, "current", "engineer");
    assert.equal(model.views.line, true); assert.equal(model.views.surface, false);
    assert.deepEqual(buildCalibrationSlice(model.visual, "row", 0).map(point => point.axisValue), axis.outcome === "static_literal" ? axis.literalValues : axis.engineeringValues);
  }
});
test("R02 mesh, slice, Grid and Inspector share exact cells and immutable acquisition values", () => {
  const model = buildSharedTablePresentation(fixture(), null, "current", "engineer");
  const mesh = buildCalibrationSurfaceMesh(model.visual);
  assert.equal(mesh.available, true); assert.equal(mesh.triangles.length, 4);
  for (const triangle of mesh.triangles) for (const point of triangle.points) assert.equal(point.currentValue, model.cells[point.cellIndex].value);
  const rendered = renderToStaticMarkup(React.createElement(Plot, { model: model.visual, terminology: model.terminology, presentation: "current", direction: "row", sliceIndex: 1, selectedCell: 0, onSelect() {} }));
  assert.match(rendered, /outside this slice/); assert.doesNotMatch(rendered, /Reference and/); assert.match(rendered, /3000/);
  assert.equal(exactNumber(-0), "-0"); assert.equal(exactNumber(0.12345678912345), "0.12345678912345");
});
test("R02 absent, quarantined and unavailable selected layers never render cached or fabricated values", () => {
  const source = fixture();
  for (const state of ["unavailable", "quarantined", "read_failure"] as const) {
    const projection = { ...source, slots: { ...source.slots, current: { ...source.slots.current, state } } };
    const model = buildSharedTablePresentation(projection, null, "current", "standard");
    assert.equal(model.views.grid, false); assert.deepEqual(model.cells, []); assert.match(html(model), /No qualified cell/);
  }
  assert.deepEqual(buildSharedTablePresentation(source, null, "working", "standard").cells, []);
  assert.deepEqual(buildSharedTablePresentation(source, null, "reference", "standard").cells, []);
});
test("R02 Reference axes disagree: disable overlay/delta and retain separately inspectable Reference", () => {
  const source = native(true); assert.equal(source.slots.reference.state, "available");
  const projection = { ...source, slots: { ...source.slots, reference: { ...source.slots.reference, axes: source.slots.reference.axes.map(axis => ({ ...axis, values: axis.values.every(value => typeof value === "number") ? axis.values.map(value => Number(value) + 1) : axis.values.map(String) })) } } };
  const current = buildSharedTablePresentation(projection, null, "current", "standard"), reference = buildSharedTablePresentation(projection, null, "reference", "standard");
  assert.equal(current.comparison, false); assert.match(current.comparisonReason!, /axes differ/); assert.ok(current.cells.every(cell => cell.referenceDelta === null));
  assert.deepEqual(reference.cells.map(cell => cell.value), projection.slots.reference.cells.map(cell => cell.value));
  assert.equal(reference.terminology.grid.displayedAxisState, "reference");
});
test("R02 Working values remain distinct in Current view, mutations/undo/redo use the accepted engine", () => {
  const projection = native(), definition = resolveProjectedWorkingDefinition(anchor.workshop, projection);
  const seed = createWorkingCalibration({ ownerScope: context.ownerId, vehicleId: context.vehicleId, ...anchor.workshop.source, createdAt: "2026-10-12T00:00:00.000Z" });
  const target = definition.cells[0], value = target.currentValue + definition.capability.inverse!.scale;
  const edit = applyWorkingEdit(seed, { operation: "assign", operand: value, targets: [target], definitions: [definition], updatedAt: "2026-10-12T00:00:01.000Z" });
  assert.equal(edit.status, "applied"); if (edit.status !== "applied") return;
  const current = buildSharedTablePresentation(projection, edit.calibration, "current", "standard"), working = buildSharedTablePresentation(projection, edit.calibration, "working", "engineer");
  assert.equal(current.cells[0].value, target.currentValue); assert.equal(current.cells[0].workingValue, value); assert.equal(working.cells[0].value, value);
  assert.equal(buildSharedTablePresentation(projection, { ...edit.calibration, vehicleId: "other" }, "working", "standard").available, false);
  const undo = undoWorkingEdit(edit.calibration, "2026-10-12T00:00:02.000Z");
  assert.equal(buildSharedTablePresentation(projection, undo, "working", "standard").cells[0].value, target.currentValue);
  assert.equal(redoWorkingEdit(undo, "2026-10-12T00:00:03.000Z").workingCalibrationRevision, edit.calibration.workingCalibrationRevision);
});

const field = <T>(value: T): QualifiedSemanticField<T> => ({ value, assertionId: "r02-controlled-assertion", assertionRevision: "v1", authority: "test producer", provenance: ["controlled test evidence"], limitations: ["Not production Knowledge"] });
test("R02 rendered H1/H2/H3 guidance consumes qualified fields, exact target choices and explicit absence", () => {
  const source = fixture(), empty = bindDefinitionKnowledge({ definitionIdentity: null, definitionRevision: "test" }, []);
  const qualified = { ...empty, outcome: "exact" as const, knowledgeId: "source-knowledge", knowledgeRevision: "v1", unavailableReason: null,
    controls: [field("Governed controls")], whyItMatters: [field("Governed purpose")], howToRead: [field("Governed reading")],
    operatingContexts: [field("Governed context")], engineeringConsiderations: [field("Governed consideration")],
    telemetryRelationships: [field({ channelId: "governed-channel", meaning: "Supplied relationship" })],
    relatedCalibrations: [field({ targetKnowledgeId: "target-knowledge", relationship: "Qualified edge" })], provenance: ["assertion provenance"] };
  for (const outcome of ["exact", "partial", "ambiguous", "conflict", "unavailable"] as const) {
    const model = buildSharedTablePresentation({ ...source, semantic: { ...qualified, outcome, unavailableReason: outcome === "exact" ? null : "Owner absence: " + outcome } }, null, "current", "standard");
    const targets = [0, 1].map(occurrence => ({ key: "target:" + occurrence, definitionRevision: "target-revision", occurrence, title: "Literal (Map 3)", semantic: { ...qualified, knowledgeId: "target-knowledge" } }));
    const output = renderToStaticMarkup(React.createElement(TableGuidance, { model, definitions: targets, onOpen() {} }));
    for (const label of ["Understand", "Engineering Detail", "What this Table does", "Why it matters", "How to read it", "When it is used", "Telemetry to inspect", "Important consideration"]) assert.ok(output.includes(label));
    if (outcome === "exact") { assert.match(output, /Governed controls/); assert.match(output, /assertion provenance/); assert.match(output, /Multiple exact occurrences/); assert.match(output, /Literal \(Map 3\)/); }
    else { assert.match(output, new RegExp("Owner absence: " + outcome)); assert.doesNotMatch(output, /Governed controls|Qualified edge/); }
  }
});

function savedUi(): { state: WorkspaceUiState; scope: string } {
  const definition = anchor.workshop.definitions.find(item => item.editCapability?.state === "EDIT_QUALIFIED")!;
  const tab = createWorkspaceTab({ ...definition, definitionKey: definition.key, datasetRevision: anchor.workshop.source.currentDatasetRevision });
  return { scope: workspaceUiKey(context, anchor.workshop, "adaptive"), state: { workspace: { tabs: [{ ...tab, operand: "123" }], activeId: tab.id }, search: "Map", navigationMode: "all", system: null,
    evidenceFilter: "working", displayMode: "current", panels: { explorerCollapsed: true, inspectorCollapsed: false, focusWorkspace: true } } };
}
test("R02 versioned UI restoration retains exact tabs without evidence, drafts or forced fresh-session Focus", () => {
  const { scope, state } = savedUi(), serialized = serializeWorkspaceUi(scope, state);
  const restored = restoreWorkspaceUi(serialized, scope, workspaceCatalogue(anchor.workshop), undefined, false, true);
  assert.equal(restored.finding, null); assert.equal(restored.state?.workspace.activeId, state.workspace.activeId);
  assert.equal(restored.state?.workspace.tabs[0].operand, ""); assert.equal(restored.state?.panels.focusWorkspace, false);
  assert.equal(restored.state?.panels.explorerCollapsed, true); assert.doesNotMatch(serialized, /engineeringValues|rawValues|mutations|semantic|editCapability/);
});
test("R02 restoration rejects identity, occurrence, revision, duplicate, cell and capacity corruption", () => {
  const { scope, state } = savedUi();
  const original = JSON.parse(serializeWorkspaceUi(scope, state));
  const changes = [
    (saved: typeof original) => { saved.scope = "other"; }, (saved: typeof original) => { saved.version = "old"; },
    (saved: typeof original) => { saved.workspace.tabs[0].occurrence++; }, (saved: typeof original) => { saved.workspace.tabs[0].datasetRevision = "other"; },
    (saved: typeof original) => { saved.workspace.tabs[0].selectedCells = [-1]; }, (saved: typeof original) => { saved.workspace.tabs.push(saved.workspace.tabs[0]); },
    (saved: typeof original) => { saved.workspace.tabs = Array(13).fill(saved.workspace.tabs[0]); },
  ];
  for (const change of changes) { const saved = structuredClone(original); change(saved); const restored = restoreWorkspaceUi(JSON.stringify(saved), scope, workspaceCatalogue(anchor.workshop), undefined, false, true); assert.equal(restored.state, null); assert.match(restored.finding!, /incompatible/); }
  for (const field of ["ownerId", "vehicleId", "sessionId"] as const) assert.notEqual(workspaceUiKey({ ...context, [field]: "other" }, anchor.workshop, "adaptive"), scope);
});
test("R02 explicit URL selection outranks saved tab; unresolved URLs never use saved selection", () => {
  const { scope, state } = savedUi(), raw = serializeWorkspaceUi(scope, state), explicit = anchor.workshop.definitions.find(item => item.key !== state.workspace.tabs[0].definitionKey)!;
  const restored = restoreWorkspaceUi(raw, scope, workspaceCatalogue(anchor.workshop), explicit.key, false, true);
  assert.equal(restored.state?.workspace.tabs.find(tab => tab.id === restored.state!.workspace.activeId)?.definitionKey, explicit.key);
  assert.deepEqual(restoreWorkspaceUi(raw, scope, workspaceCatalogue(anchor.workshop), "unknown", false, true).state?.workspace.tabs, []);
});
test("R02 no silent cross-window Working overwrite, storage schema and replay remain intact", () => {
  const memory = new Map<string, string>(), store = createBrowserWorkingCalibrationStore({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: key => { memory.delete(key); } });
  const seed = createWorkingCalibration({ ownerScope: context.ownerId, vehicleId: context.vehicleId, ...anchor.workshop.source, createdAt: "2026-10-12T00:00:00.000Z" });
  store.save(seed, null); const preserved = [...memory.values()][0];
  assert.throws(() => store.save({ ...seed, workingCalibrationRevision: "other-window" }, "unseen-revision"), /another window/);
  assert.equal([...memory.values()][0], preserved); assert.equal(store.load(seed, seed)?.workingCalibrationRevision, seed.workingCalibrationRevision);
  assert.deepEqual(workingRestoreDefinitions({ getItem: key => memory.get(key) ?? null }, seed), []);
});

test("R02 history replay obtains only explicitly referenced exact Definition seeds, with identity checked before loading", () => {
  const projection = native(), definition = resolveProjectedWorkingDefinition(anchor.workshop, projection);
  const seed = createWorkingCalibration({ ownerScope: context.ownerId, vehicleId: context.vehicleId, ...anchor.workshop.source, createdAt: "2026-10-12T00:00:00.000Z" });
  const target = definition.cells[0];
  const edited = applyWorkingEdit(seed, { operation: "assign", source: "direct", operand: target.currentValue, targets: [target], definitions: [definition], updatedAt: "2026-10-12T00:00:01.000Z" });
  assert.equal(edited.status, "applied"); if (edited.status !== "applied") return;
  const memory = new Map<string, string>(), storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
  const store = createBrowserWorkingCalibrationStore(storage, true); store.save(edited.calibration);
  assert.deepEqual(workingRestoreDefinitions(storage, seed), [{ definitionRevision: definition.definitionRevision, occurrence: definition.occurrence }]);
  let resolved = 0;
  const restored = store.load(seed, seed, (revision, occurrence) => { resolved++; return revision === definition.definitionRevision && occurrence === definition.occurrence ? definition : undefined; });
  assert.equal(restored?.workingCalibrationRevision, edited.calibration.workingCalibrationRevision); assert.equal(resolved, 1);
  assert.throws(() => workingRestoreDefinitions(storage, { ...seed, currentDatasetRevision: "changed" }), /exact Current Dataset/);
});


test("R02 full tab capacity preserves the snapshot when an explicit new Table takes precedence", () => {
  const { scope, state } = savedUi();
  const tabs = anchor.workshop.definitions.filter(d => d.editCapability?.state === "EDIT_QUALIFIED").slice(0, 12).map(d => createWorkspaceTab({ ...d, definitionKey: d.key, datasetRevision: anchor.workshop.source.currentDatasetRevision }));
  assert.equal(tabs.length, 12);
  const explicit = anchor.workshop.definitions.find(d => !tabs.some(t => t.definitionKey === d.key))!;
  const raw = serializeWorkspaceUi(scope, { ...state, workspace: { tabs, activeId: tabs[0].id } });
  const restored = restoreWorkspaceUi(raw, scope, workspaceCatalogue(anchor.workshop), explicit.key, false, true);
  assert.equal(restored.state, null); assert.equal(restored.preserveSaved, true); assert.match(restored.finding!, /capacity/);
  assert.equal(restoreWorkspaceUi(raw, scope, workspaceCatalogue(anchor.workshop), undefined, false, true).state?.workspace.tabs.length, 12);
});

test("R02 persisted views retain bounded camera and zoom, reject corrupted preference metadata", () => {
  const { scope, state } = savedUi(), tab = state.workspace.tabs[0];
  const raw = serializeWorkspaceUi(scope, { ...state, workspace: { ...state.workspace, tabs: [{ ...tab, camera: { rotation: .3, tilt: .5, zoom: 1.2 }, plotView: { zoom: 2, pan: 70 }, gridZoom: 1.25 }] } });
  const restored = restoreWorkspaceUi(raw, scope, workspaceCatalogue(anchor.workshop), undefined, false, true);
  assert.deepEqual(restored.state?.workspace.tabs[0].camera, { rotation: .3, tilt: .5, zoom: 1.2 });
  assert.equal(restored.state?.workspace.tabs[0].gridZoom, 1.25);
  const corrupted = JSON.parse(raw); corrupted.workspace.tabs[0].camera.zoom = 999;
  assert.equal(restoreWorkspaceUi(JSON.stringify(corrupted), scope, workspaceCatalogue(anchor.workshop), undefined, false, true).preserveSaved, true);
  corrupted.workspace.tabs[0].camera.zoom = 1; corrupted.search = { forged: true };
  assert.equal(restoreWorkspaceUi(JSON.stringify(corrupted), scope, workspaceCatalogue(anchor.workshop), "unknown", false, true).state, null);
});


test("R02 flat plot values occupy their labelled value rather than a mismatched axis endpoint", () => {
  const projection = fixture("array_1d", 1, 3, [fixtureAxis("X", [1, 2, 4])]);
  const model = buildSharedTablePresentation(projection, null, "current", "engineer");
  const visual = { ...model.visual, surface: model.visual.surface.map(point => ({ ...point, currentValue: 10 })) };
  const html = renderToStaticMarkup(React.createElement(Plot, { model: visual, presentation: "current", direction: "row", sliceIndex: 0, terminology: model.terminology, onSelect() {} }));
  assert.match(html, />11<\/text>/); assert.match(html, />10<\/text>/); assert.match(html, />9<\/text>/);
  assert.match(html, /cy="196"/);
});
