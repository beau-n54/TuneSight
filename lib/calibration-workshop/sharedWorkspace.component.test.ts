import { buildCalibrationVisualizationModel } from "./visualizationModel.ts";
import { buildCalibrationTerminology } from "./calibrationTerminology.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as nodeModule from "node:module";
import { gzipSync } from "node:zlib";
import test, { before } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { loadSubscriberCalibration, type SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { comparisonRendererDefinition, buildSharedWorkspacePayload, sharedWorkspaceEvidence, projectWorkspaceTable } from "./sharedWorkspaceAdapter.ts";
import { buildCurrentOnlyWorkshopViewModel } from "./currentOnlyViewModel.ts";
import { projectSharedTable } from "./sharedTableProjection.ts";
import { subscriberProjectionInput } from "./sharedTableProjection.fixtures.ts";

// Test-only TSX loader uses the existing TypeScript/React dependencies. No production loader/config changes.
const root = path.resolve(".");
// Node 24 supplies synchronous hooks; the repository's older Node type package predates them.
type ResolveContext = { parentURL?: string };
type ResolveResult = { url: string };
type LoadContext = Readonly<Record<string, unknown>>;
type LoadResult = { format?: string | null; source?: string | ArrayBufferView | ArrayBuffer | null; shortCircuit?: boolean };
const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: {
  resolve(specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => ResolveResult): ResolveResult;
  load(url: string, context: LoadContext, next: (url: string, context: LoadContext) => LoadResult): LoadResult;
}): unknown };
registerHooks({
  resolve(specifier, context, next) {
    const local = specifier.startsWith("@/") ? path.join(root, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:") ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    if (local && !path.extname(local)) {
      const match = [".ts", ".tsx", ".js"].map(extension => local + extension).find(file => fs.existsSync(file));
      if (match) return next(pathToFileURL(match).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".tsx")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
const { default: Plot2D } = await import("../../app/dashboard/vehicles/[id]/calibration/CalibrationPlot2D.tsx");
const { default: Surface3D } = await import("../../app/dashboard/vehicles/[id]/calibration/CalibrationSurface3D.tsx");
const { default: DirectCell } = await import("../../app/dashboard/vehicles/[id]/calibration/direct-grid-cell.tsx");
const { default: Shell } = await import("../../app/dashboard/vehicles/[id]/calibration/shared-calibration-shell.tsx");
const { SharedEvidenceStrip } = await import("../../app/dashboard/vehicles/[id]/calibration/shared-evidence-strip.tsx");
const { default: ModeControl } = await import("../../app/dashboard/vehicles/[id]/calibration/calibration-terminology-control.tsx");
const { default: WorkingPanel } = await import("../../app/dashboard/vehicles/[id]/calibration/working-calibration-panel.tsx");
const { default: Workspace, EmptySharedWorkspace } = await import("../../app/dashboard/vehicles/[id]/calibration/shared-workspace-client.tsx");
let n54: SubscriberCalibrationSuccess;
before(async () => {
  const result = await loadSubscriberCalibration({ bytes: fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"), fileName: "u1-render-test.bin", mimeType: null, observedAt: "2026-09-21T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready"); if (result.status !== "workshop_ready") throw new Error("Controlled anchor failed"); n54 = result;
});
const context = { ownerId: "u1-test", vehicleId: "u1-test-vehicle", sessionId: "u1-test-session", sourceMode: "subscriber" as const };
const panels = { explorerCollapsed: false, inspectorCollapsed: false, focusWorkspace: false };
function frame(evidence: React.ReactNode, overrides: Partial<Parameters<typeof Shell>[0]> = {}) {
  return React.createElement(Shell, { header: "Exact vehicle identity", evidence, controls: React.createElement(ModeControl, { mode: "standard", onMode: () => {} }),
    navigation: "Engineering navigation", explorer: "Explorer content", tabs: "Exact Table tabs", table: "Exact Table cells", inspector: "Exact raw value", working: "Working history",
    limitations: "Owner limitations", panels, onPanels: () => {}, ...overrides });
}
const landmarks = ["Calibration Workspace identity", "Calibration evidence and capabilities", "Workspace controls", "Table Explorer", "Multi-Table tabs", "Table workspace", "Table presentation", "Working and history", "Cell Inspector and Raw Representation", "Workspace limitations"];
test("U1 C S01-S04: comparison, Current-only and missing Current share every shell landmark and evidence slot", () => {
  const choice = n54.workshop.definitions[0];
  const comparison = projectWorkspaceTable(n54.workshop, sharedWorkspaceEvidence(n54), context, choice.key);
  const workshop = buildCurrentOnlyWorkshopViewModel({ current: n54.material.current, quarantines: [], editCapabilities: n54.editCapabilities });
  const current = projectWorkspaceTable(workshop, { ...sharedWorkspaceEvidence(n54), material: { current: n54.material.current, reference: null, comparison: null } }, context, workshop.selectedDefinition.key);
  const input = subscriberProjectionInput(n54, choice);
  const missing = projectSharedTable({ ...input, current: { state: "missing", findings: ["Owner: Current unavailable"] }, edit: null, comparison: { state: "unavailable", findings: ["No Current comparison"] } });
  for (const projection of [comparison, current, missing, null]) {
    const html = renderToStaticMarkup(frame(React.createElement(SharedEvidenceStrip, { projection })));
    for (const landmark of landmarks) assert.ok(html.includes(`aria-label="${landmark}"`), landmark);
    for (const slot of ["reference", "current", "working", "suggested"]) assert.ok(html.includes(`data-evidence-slot="${slot}"`));
    assert.match(html, /Export: locked/); assert.match(html, /Flash: unavailable/);
  }
  const html = renderToStaticMarkup(React.createElement(SharedEvidenceStrip, { projection: current }));
  assert.ok(html.includes(workshop.states[0].message));
  assert.match(renderToStaticMarkup(React.createElement(SharedEvidenceStrip, { projection: missing })), /Owner: Current unavailable/);
});
test("U1 C S07: mode controls expose one selected mode and retain the same shell/evidence regions", () => {
  for (const mode of ["standard", "engineer"] as const) {
    const html = renderToStaticMarkup(frame("unchanged qualified values", { controls: React.createElement(ModeControl, { mode, onMode: () => {} }) }));
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 3); // Mode and two visible panels.
    assert.match(html, /unchanged qualified values/);
    for (const landmark of landmarks) assert.ok(html.includes(`aria-label="${landmark}"`));
  }
});
test("U1 C S08: collapsed panels leave no narrow placeholder column; Focus restores prior selection", () => {
  for (const explorerCollapsed of [false, true]) for (const inspectorCollapsed of [false, true]) {
    const prior = { explorerCollapsed, inspectorCollapsed, focusWorkspace: false };
    const html = renderToStaticMarkup(frame("evidence", { panels: prior }));
    assert.equal(html.includes('aria-label="Table Explorer"'), !explorerCollapsed);
    assert.equal(html.includes('aria-label="Cell Inspector and Raw Representation"'), !inspectorCollapsed);
    const focused = renderToStaticMarkup(frame("evidence", { panels: { ...prior, focusWorkspace: true } }));
    assert.match(focused, /data-workspace-columns="xl:grid-cols-1"/);
    assert.ok(!focused.includes('aria-label="Table Explorer"'));
    assert.ok(!focused.includes('aria-label="Cell Inspector and Raw Representation"'));
    let restored: typeof panels | null = null;
    const tree = Shell({ ...frame("evidence").props, panels: { ...prior, focusWorkspace: true }, onPanels: next => { restored = next; } });
    const controls = tree.props.children.props.children[2];
    controls.props.children[1].props.onClick();
    assert.deepEqual(restored, prior);
  }
});
test("U1 C S18: read-only display disables creation without granting or changing qualification", () => {
  const noOp = () => {};
  const html = renderToStaticMarkup(React.createElement(WorkingPanel, { mode: "current", onMode: noOp, working: null, onCreate: noOp, onUndo: noOp, onRedo: noOp,
    operation: "assign", onOperation: noOp, operand: "", onOperand: noOp, preview: null, onApply: noOp, selectedCount: 1, definitionTitles: {}, editQualified: true,
    blockers: [], warnings: [], saveStatus: "not-created", interactionAllowed: false }));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Create Working Calibration/);
  assert.match(html, /Export BIN/);
});
test("U1 C S01/S03/S05: real shared controller renders retained grids, missing Current and explicit unresolved selection", () => {
  const vehicle = { id: context.vehicleId, nickname: "Controlled render fixture", year: null, make: null, model: null, engine_code: null };
  const render = renderToStaticMarkup;
  const upload = React.createElement("button", {}, "Open Calibration File");
  const payload = buildSharedWorkspacePayload(n54.workshop, n54, context);
  const workshop = buildCurrentOnlyWorkshopViewModel({ current: n54.material.current, quarantines: [], editCapabilities: n54.editCapabilities });
  const currentResult = { ...n54, workshop, material: { current: n54.material.current, reference: null, comparison: null } };
  for (const props of [{ workshop: n54.workshop, evidence: payload }, { workshop, evidence: buildSharedWorkspacePayload(workshop, currentResult, context) }]) {
    const html = render(React.createElement(Workspace, { ...props, context, vehicle, upload }));
    for (const landmark of landmarks) assert.ok(html.includes(`aria-label="${landmark}"`));
    assert.match(html, /data-working-cell="0"/);
    assert.match(html, /Exact Table selection/);
    assert.match(html, /Raw Representation/);
  }
  const unresolved = render(React.createElement(Workspace, { workshop: n54.workshop, context, vehicle, upload, requestedKey: "unresolved-key", evidence: buildSharedWorkspacePayload(n54.workshop, n54, context, "unresolved-key") }));
  assert.match(unresolved, /exact requested Table is unresolved/);
  assert.ok(!unresolved.includes('data-working-cell="'));
  const empty = render(React.createElement(EmptySharedWorkspace, { vehicle, context, upload, reason: "Owner: Current absent" }));
  assert.match(empty, /Owner: Current absent/);
  assert.ok(!empty.includes('data-working-cell="'));
  for (const landmark of landmarks) assert.ok(empty.includes(`aria-label="${landmark}"`));
});
test("U1 server selected-table projection carries exact U0 cells without all-table duplication, owner material or source lease", t => {
  const start = performance.now(), payload = buildSharedWorkspacePayload(n54.workshop, n54, context), elapsed = performance.now() - start;
  const text = JSON.stringify(payload), bytes = Buffer.byteLength(text);
  assert.ok(payload.projection);
  assert.ok(!("tables" in payload));
  assert.ok(!("material" in payload)); assert.ok(!("sourceLease" in payload));
  assert.ok(!text.includes('"rawEvidence":')); assert.ok(!text.includes('"sourceAxes":'));
  assert.ok(bytes < 1_000_000, "Selected-table overhead must remain below the uncompressed 1 MB gate");
  for (const projected of [payload.projection!]) {
    const original = projectWorkspaceTable(n54.workshop, sharedWorkspaceEvidence(n54), context, projected.selection.key);
    assert.deepEqual(projected.context, context);
    assert.equal(projected.tableIdentity, original.tableIdentity);
    assert.deepEqual(projected.slots.current.cells.map(cell => [cell.index, cell.row, cell.column, cell.value, cell.rawValue, cell.rawOffset, cell.units]),
      original.slots.current.cells.map(cell => [cell.index, cell.row, cell.column, cell.value, cell.rawValue, cell.rawOffset, cell.units]));
  }
  t.diagnostic(JSON.stringify({ tables: 1, legacyBytes: Buffer.byteLength(JSON.stringify(n54.workshop)), projectionBytes: bytes,
    legacyGzipBytes: gzipSync(JSON.stringify(n54.workshop)).length, projectionGzipBytes: gzipSync(text).length, projectionBuildMs: Math.round(elapsed) }));
});

test("U1 shared structural panels retain BMW borders without making evidence slots structural gradients", () => {
  const html = renderToStaticMarkup(frame("evidence"));
  for (const label of ["Table Explorer", "Table workspace", "Workspace limitations"])
    assert.match(html, new RegExp(`aria-label="${label}" class="bmw-border`));
  const projection = buildSharedWorkspacePayload(n54.workshop, n54, context).projection!;
  const strip = renderToStaticMarkup(React.createElement(SharedEvidenceStrip, { projection }));
  assert.ok(!strip.includes("bmw-border")); assert.match(strip, /border-blue-400/);
  const collapsed = renderToStaticMarkup(frame("evidence", { panels: { ...panels, explorerCollapsed: true } }));
  assert.match(collapsed, /class="bmw-border[^"]*"[^>]*>Show Explorer/);
});
test("U1 rendered Explorer retains selected treatment and literal authoritative title", () => {
  const payload = buildSharedWorkspacePayload(n54.workshop, n54, context);
  const html = renderToStaticMarkup(React.createElement(Workspace, { workshop: n54.workshop, evidence: payload, context,
    vehicle: { id: context.vehicleId, nickname: null, year: null, make: null, model: null, engine_code: null }, upload: null }));
  assert.match(html, /aria-current="true" class="[^"]*border-blue-400\/60/);
  assert.ok(html.includes('aria-label="Table workspace" class="bmw-border'));
});
for (const presentation of ["reference-current", "reference-working", "current", "working"] as const) {
  test(`U1 rendered 2D legend and accessibility truth: ${presentation}`, () => {
    const projection = buildSharedWorkspacePayload(n54.workshop, n54, context).projection!;
    const detail = comparisonRendererDefinition(n54.workshop, projection)!;
    const original = JSON.stringify(detail.cells);
    const model = buildCalibrationVisualizationModel(detail);
    const terminology = buildCalibrationTerminology({ mode: "engineer", sourceTitle: detail.summary.title, shape: detail.summary.shape,
      rows: detail.rows, columns: detail.columns, axes: detail.axes, referenceAxes: detail.referenceAxes, semantic: detail.summary.semantic, outputUnits: detail.summary.units });
    const html = renderToStaticMarkup(React.createElement(Plot2D, { model, presentation, direction: "row", sliceIndex: 0, terminology, onSelect: () => {} }));
    const working = presentation.includes("working"), reference = presentation.startsWith("reference");
    assert.ok(html.includes(`aria-label="${reference ? "Reference and " : ""}${working ? "Working" : "Current"}`));
    assert.ok(html.includes(`>${working ? "Working" : "Current"}</text>`));
    assert.equal(html.includes(">Reference</text>"), reference);
    if (working) assert.ok(!html.includes(">Current</text>"));
    assert.equal(JSON.stringify(detail.cells), original);
  });
}
for (const state of ["reference", "current", "working"] as const) {
  test(`U1 rendered 3D state/accessibility truth: ${state}`, () => {
    const projection = buildSharedWorkspacePayload(n54.workshop, n54, context).projection!;
    const detail = comparisonRendererDefinition(n54.workshop, projection)!;
    const terminology = buildCalibrationTerminology({ mode: "engineer", sourceTitle: detail.summary.title, shape: detail.summary.shape,
      rows: detail.rows, columns: detail.columns, axes: detail.axes, semantic: detail.summary.semantic, outputUnits: detail.summary.units });
    const html = renderToStaticMarkup(React.createElement(Surface3D, { model: buildCalibrationVisualizationModel(detail), detail, state,
      terminology, selectedCell: 0, onSelect: () => {} }));
    assert.ok(html.includes(`aria-label="Interactive ${state} Calibration surface`));
  });
}
test("U1 review-only direct cell renders selection but no edit input or edit affordance", () => {
  const html = renderToStaticMarkup(React.createElement(DirectCell, { cellKey: "exact", index: 0, row: 1, column: 1, columnCount: 1,
    value: 12, currentValue: 12, changed: false, selected: true, canEdit: false, onSelect: () => {}, onNavigate: () => {},
    onCommit: () => { throw new Error("Rendering cannot mutate"); }, format: String }));
  assert.ok(!html.includes("<input")); assert.ok(!html.includes("double-click to edit")); assert.match(html, />12</);
});

test("U1 Explorer fills desktop row height with a scrolling flex list and remains bounded when stacked", () => {
  const payload = buildSharedWorkspacePayload(n54.workshop, n54, context);
  const html = renderToStaticMarkup(React.createElement(Workspace, { workshop: n54.workshop, evidence: payload, context,
    vehicle: { id: context.vehicleId, nickname: null, year: null, make: null, model: null, engine_code: null }, upload: null }));
  const panel = html.match(/<aside aria-label="Table Explorer" class="([^"]+)"/)![1];
  for (const token of ["bmw-border", "flex", "flex-col", "min-h-0", "xl:[contain:size]"]) assert.ok(panel.split(" ").includes(token), token);
  assert.match(html, /data-workspace-columns="xl:grid-cols-\[300px_minmax\(0,1fr\)_320px\]"/);
  assert.match(html, /<h2 class="mb-2 shrink-0 text-sm font-semibold">Explorer/);
  const list = html.match(/aria-label="Explorer table list" class="([^"]+)"/)![1];
  for (const token of ["min-h-0", "flex-1", "overflow-y-auto", "max-h-[65vh]", "xl:max-h-none"]) assert.ok(list.split(" ").includes(token), token);
  assert.match(html, /aria-current="true" class="[^"]*border-blue-400\/60 bg-blue-400\/10/);
  const source = fs.readFileSync("app/dashboard/vehicles/[id]/calibration/shared-workspace-client.tsx", "utf8");
  assert.match(source, /list\.querySelector<HTMLElement>\('\[aria-current="true"\]'\)/);
  assert.match(source, /list\.scrollTop \+=/);
  assert.match(source, /resize\.observe\(list\)/);
  assert.ok(!source.includes("scrollIntoView("), "Selection must not scroll the page's ancestors");
});
