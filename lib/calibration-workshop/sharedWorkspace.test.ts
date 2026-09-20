import { loadSubscriberTableProjection, type ProjectionBoundaryOwners } from "./sharedWorkspaceProjectionLoader.ts";
import { createProjectionCache, projectionRequest, projectionRequestKey, type ProjectionResponse } from "./sharedWorkspaceProjectionRequest.ts";
import { buildSharedWorkspacePayload } from "./sharedWorkspaceAdapter.ts";
import { directDraftPolicy, discardRevokedDraft, submitDirectDraft, plotPresentationLabels } from "./sharedWorkspacePresentationState.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { before } from "node:test";
import { loadSubscriberCalibration, type SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import { buildCurrentOnlyWorkshopViewModel } from "./currentOnlyViewModel.ts";
import { comparisonRendererDefinition, currentRendererDefinition, exactWorkspaceDefinition, projectWorkspaceTable,
  resolveSharedWorkingDefinition, sharedWorkspaceContextKey, sharedWorkspaceEvidence } from "./sharedWorkspaceAdapter.ts";
import { dispatchWorkspace, resolveWorkspacePresentation, maskRetainedWorkspace } from "./sharedWorkspaceDispatch.ts";
import { pendingTransitionAllowed, recognizedReviewDevice, existingRendererViews, requestWorkspaceTab, workspaceInteractionPolicy } from "./sharedWorkspacePolicy.ts";
import { activateWorkspaceTab, closeOtherWorkspaceTabs, closeWorkspaceTab, createWorkspaceTab, updateActiveWorkspaceTab, type WorkspaceTabsState } from "./workspaceTabs.ts";
import { applyWorkingEdit, createWorkingCalibration, redoWorkingEdit, undoWorkingEdit, workingCellValue } from "./workingCalibration.ts";
import { createBrowserWorkingCalibrationStore } from "./workingCalibrationPersistence.ts";
import { deriveWorkshopLayout } from "./workspaceLayout.ts";
import { buildCalibrationVisualizationModel } from "./visualizationModel.ts";
import type { TableQuarantineRecord } from "../xdf/tableQuarantine.ts";

let n54: SubscriberCalibrationSuccess;
const context = { ownerId: "u1-controlled-owner", vehicleId: "u1-controlled-vehicle", sessionId: "u1-controlled-session", sourceMode: "subscriber" as const };
before(async () => {
  const result = await loadSubscriberCalibration({ bytes: fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"), fileName: "u1-controlled.bin", mimeType: null, observedAt: "2026-09-21T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") throw new Error("N54 controlled anchor unavailable");
  n54 = result;
});
const evidence = () => sharedWorkspaceEvidence(n54);
const selected = () => n54.workshop.definitions.find(item => item.editCapability?.state === "EDIT_QUALIFIED" && ("available" in item ? item.available : item.availability === "current_available"))!;
const currentOnly = () => buildCurrentOnlyWorkshopViewModel({ current: n54.material.current, quarantines: n54.quarantines, editCapabilities: n54.editCapabilities });
const withoutReference = () => ({ ...evidence(), material: { current: n54.material.current, reference: null, comparison: null } });
const projection = () => projectWorkspaceTable(n54.workshop, evidence(), context, selected().key);
function tab(index: number) { return createWorkspaceTab({ definitionKey: `native:${index}`, definitionRevision: "repeated-revision", occurrence: index, datasetRevision: "dataset:revision", title: "Repeated title" }); }

test("U1 S01/S04: production adapter preserves every N54 native occurrence and qualified Current value", () => {
  for (const definition of n54.workshop.definitions) {
    const projected = projectWorkspaceTable(n54.workshop, evidence(), context, definition.key);
    const current = currentRendererDefinition(n54.workshop, projected);
    assert.equal(projected.contractVersion, "tunesight.shared-table-projection.v1");
    assert.equal(current.key, definition.key);
    assert.equal(current.occurrence, definition.occurrence);
    assert.deepEqual(current.cells.map(cell => cell.currentValue), projected.slots.current.cells.map(cell => cell.value));
    assert.deepEqual(projected.capabilities.edit, n54.editCapabilities.find(item => item.definitionRevision === definition.definitionRevision && item.occurrence === definition.occurrence) ?? null);
  }
});
test("U1 S02: absent Reference preserves Current and the exact owner reason", () => {
  const workshop = currentOnly(), definition = workshop.selectedDefinition;
  const result = projectWorkspaceTable(workshop, withoutReference(), context, definition.key);
  assert.equal(result.slots.reference.state, "missing");
  assert.deepEqual(result.slots.reference.findings, [workshop.states[0].message]);
  assert.deepEqual(currentRendererDefinition(workshop, result).cells, definition.cells);
  assert.equal(comparisonRendererDefinition(workshop, result), null);
  assert.equal(existingRendererViews(result, null).line, false);
  assert.equal(existingRendererViews(result, null).surface, false);
});
test("U1 S02: unresolved Reference occurrence cannot hide Current or select a comparison renderer", () => {
  assert.ok(n54.material.reference);
  const supplied = evidence();
  const modified = { ...supplied, material: { current: n54.material.current, reference: { ...n54.material.reference!, definitions: [] }, comparison: n54.material.comparison! } };
  const result = projectWorkspaceTable(n54.workshop, modified, context, selected().key);
  assert.equal(result.slots.reference.state, "unresolved");
  assert.deepEqual(result.slots.current, projection().slots.current);
  assert.equal(comparisonRendererDefinition(n54.workshop, result), null);
  assert.ok(currentRendererDefinition(n54.workshop, result).cells.length > 0);
});
test("U1 S03: quarantine suppresses renderer values, raw cells and mutation restoration for the exact occurrence", () => {
  const chosen = selected(), dataset = n54.material.current;
  const source = dataset.definitions.filter(item => item.definitionRevisionId === chosen.definitionRevision)[chosen.occurrence];
  const quarantine: TableQuarantineRecord = { contractVersion: "tunesight.calibration-table-quarantine.v1", quarantineId: "u1-test-quarantine", quarantineRevision: "u1-test-quarantine:v1",
    relationship: { romSoftwareIdentity: n54.identity, sourceArtifactId: dataset.sourceArtifactId, definitionSetRevision: dataset.definitionSetRevisionId },
    occurrence: { definitionIdentity: source.definitionIdentity!, definitionRevisionId: chosen.definitionRevision, sourceBindingDigest: source.sourceBindingDigest, occurrence: chosen.occurrence },
    affectedBinary: { digest: dataset.exactBinaryIdentity.digest, role: "synthetic-test", validationRevision: "u1-test:v1" }, failureClass: "other_governed_non_usable",
    failureEvidence: { rawOffsets: [], rawBytes: [], rawValues: [], equation: null, outcome: "test_block", finding: "Synthetic owner quarantine" }, safetyAssessmentRevision: "u1-test-safety",
    provenance: ["Test only"], limitations: ["Test only"], authority: { reviewerId: "test", authorityRevision: "test:v1" }, quarantinedAt: "2026-09-21T00:00:00.000Z",
    state: "unavailable_quarantined", permissions: { engineeringValueValid: false, editable: false, suggestedCalibrationEligible: false, reconstructionMutationEligible: false, flashingEligible: false } };
  const supplied = { ...evidence(), quarantines: [quarantine] };
  const result = projectWorkspaceTable(n54.workshop, supplied, context, chosen.key);
  assert.equal(result.slots.current.state, "quarantined");
  assert.deepEqual(currentRendererDefinition(n54.workshop, result).cells, []);
  assert.deepEqual(currentRendererDefinition(n54.workshop, result).axes, []);
  assert.equal(comparisonRendererDefinition(n54.workshop, result), null);
  assert.equal(resolveSharedWorkingDefinition(n54.workshop, supplied, context, chosen.definitionRevision, chosen.occurrence)?.availability, "quarantined");
  const legacy = maskRetainedWorkspace(n54.workshop, { ...n54, quarantines: [quarantine] });
  assert.ok("tableMaterials" in legacy);
  if ("tableMaterials" in legacy) assert.deepEqual(legacy.tableMaterials.find(item => item.key === chosen.key)?.cells, []);
  assert.notEqual(legacy, n54.workshop);
  const currentWorkshop = currentOnly();
  const currentLegacy = maskRetainedWorkspace(currentWorkshop, { material: withoutReference().material, quarantines: [quarantine] });
  if ("mode" in currentLegacy) assert.deepEqual(currentLegacy.definitions.find(item => item.definitionRevision === chosen.definitionRevision && item.occurrence === chosen.occurrence)?.cells, []);
});
test("U1 S05: explicit unknown keys never fall back to a selected Table or repeated title", () => {
  assert.equal(exactWorkspaceDefinition(n54.workshop, "missing-native-key"), null);
  assert.equal(exactWorkspaceDefinition(n54.workshop, selected().title), null);
  assert.throws(() => projectWorkspaceTable(n54.workshop, evidence(), context, "missing-native-key"), /no fallback/);
  assert.notEqual(tab(0).id, tab(1).id);
});
test("U1 S05: owner, vehicle, session and Dataset context changes cannot share a mounted workspace", () => {
  const key = sharedWorkspaceContextKey(context, n54.workshop);
  for (const field of ["ownerId", "vehicleId", "sessionId"] as const) assert.notEqual(sharedWorkspaceContextKey({ ...context, [field]: "another" }, n54.workshop), key);
  const other = currentOnly();
  assert.notEqual(sharedWorkspaceContextKey(context, { ...other, source: { ...other.source, currentDatasetRevision: "other" } }), key);
});
test("U1 S06: the thirteenth request cannot evict any tab, including pending toolbar state", () => {
  let state: WorkspaceTabsState = { tabs: [], activeId: "" };
  for (let index = 0; index < 12; index++) state = requestWorkspaceTab(state, tab(index)).state;
  state = updateActiveWorkspaceTab(state, { operand: "42", selectedCells: [2], view: "3d" });
  const result = requestWorkspaceTab(state, tab(12));
  assert.equal(result.capacity, true); assert.equal(result.state, state); assert.equal(state.tabs.length, 12);
  const activation = requestWorkspaceTab(state, tab(0));
  assert.equal(activation.capacity, false); assert.equal(activation.state.tabs.length, 12);
  assert.equal(activation.state.tabs.at(-1)?.operand, "42");
  const closed = closeWorkspaceTab(state, tab(0).id);
  assert.equal(requestWorkspaceTab(closed, tab(12)).state.tabs.length, 12);
});
test("U1 S06/S07: tab activation and close-others retain exact per-tab selection, view and input", () => {
  let state = requestWorkspaceTab({ tabs: [tab(0)], activeId: tab(0).id }, tab(1)).state;
  state = updateActiveWorkspaceTab(state, { selectedCells: [7], view: "2d", sliceDirection: "column", sliceIndex: 3, operand: "25" });
  state = activateWorkspaceTab(state, tab(0).id);
  state = activateWorkspaceTab(state, tab(1).id);
  assert.deepEqual(state.tabs[1].selectedCells, [7]); assert.equal(state.tabs[1].sliceIndex, 3);
  const retained = closeOtherWorkspaceTabs(state, tab(1).id);
  assert.equal(retained.tabs[0], state.tabs[1]);
});
test("U1 S06/S07: edits, undo/redo and browser restoration survive closing and reopening their tab", () => {
  const chosen = selected(), source = n54.workshop.source;
  const seed = createWorkingCalibration({ ownerScope: context.ownerId, vehicleId: context.vehicleId, ...source, createdAt: "2026-09-21T00:00:00.000Z" });
  const definition = resolveSharedWorkingDefinition(n54.workshop, evidence(), context, chosen.definitionRevision, chosen.occurrence)!;
  const target = definition.cells[0];
  const scale = definition.capability.inverse!.scale;
  const value = target.currentValue + scale;
  const result = applyWorkingEdit(seed, { operation: "assign", operand: value, targets: [target], definitions: [definition], updatedAt: "2026-09-21T00:00:01.000Z" });
  assert.equal(result.status, "applied"); if (result.status !== "applied") return;
  const edited = result.calibration;
  closeWorkspaceTab({ tabs: [tab(0), tab(1)], activeId: tab(0).id }, tab(0).id);
  assert.equal(workingCellValue(edited, target, target.currentValue), value);
  assert.equal(workingCellValue(undoWorkingEdit(edited, "2026-09-21T00:00:02.000Z"), target, target.currentValue), target.currentValue);
  assert.equal(redoWorkingEdit(undoWorkingEdit(edited, "2026-09-21T00:00:02.000Z"), "2026-09-21T00:00:03.000Z").workingCalibrationRevision, edited.workingCalibrationRevision);
  const memory = new Map<string, string>();
  const store = createBrowserWorkingCalibrationStore({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: key => { memory.delete(key); } });
  store.save(edited);
  const restored = store.load(seed, seed, (revision, occurrence) => resolveSharedWorkingDefinition(n54.workshop, evidence(), context, revision, occurrence));
  assert.equal(restored?.workingCalibrationRevision, edited.workingCalibrationRevision);
  assert.equal(store.load({ ...seed, ownerScope: "other-owner" }, seed), null);
  assert.equal(projectWorkspaceTable(n54.workshop, evidence(), context, chosen.key, edited).slots.working?.workingCalibrationId, edited.workingCalibrationId);
});
for (const explorerCollapsed of [false, true]) for (const inspectorCollapsed of [false, true]) {
  test(`U1 S08: Focus restores panel state ${explorerCollapsed}/${inspectorCollapsed}`, () => {
    const prior = { explorerCollapsed, inspectorCollapsed, focusWorkspace: false };
    const focused = { ...prior, focusWorkspace: true };
    assert.equal(deriveWorkshopLayout(focused).columns, "xl:grid-cols-1");
    assert.deepEqual(deriveWorkshopLayout({ ...focused, focusWorkspace: false }), deriveWorkshopLayout(prior));
  });
}
for (const [label, width, fine, expected] of [["desktop", 1440, true, true], ["laptop", 1024, true, true], ["tablet", 1024, false, false], ["small tablet", 820, true, false], ["phone", 390, false, false]] as const) {
  test(`U1 S18: ${label} display policy restricts interaction, never EDIT authority`, () => {
    const before = projection(), result = workspaceInteractionPolicy(width, fine);
    assert.equal(result.editing, expected);
    assert.deepEqual(projection().capabilities, before.capabilities);
  });
}
test("U1 renderer adapter never accepts mismatched axes or unlocks Export", () => {
  const projected = projection(), detail = comparisonRendererDefinition(n54.workshop, projected)!;
  const model = buildCalibrationVisualizationModel(detail);
  const mismatched = { ...model, columnAxis: { ...model.columnAxis, id: "fabricated-axis" }, rowAxis: { ...model.rowAxis, id: "fabricated-axis" } };
  assert.equal(existingRendererViews(projected, mismatched).surface, false);
  assert.equal(projected.capabilities.export, null); assert.equal(projected.capabilities.flash, null);
});

test("U1 S18: a recognised tablet remains review-only with a fine pointer attached", () => {
  assert.equal(workspaceInteractionPolicy(1366, true, true).editing, false);
});

const admittedContext = { ...context, sessionId: "0123456789abcdefghijklmnopqrstuv" };
function requestFor(key = selected().key) {
  return projectionRequest(admittedContext, n54.workshop, n54.workshop.definitions.find(item => item.key === key)!);
}
function boundary(overrides: Partial<ProjectionBoundaryOwners> = {}): ProjectionBoundaryOwners {
  return { authenticate: async () => ({ id: "private-owner", scope: admittedContext.ownerId }),
    ownsVehicle: async (owner, vehicle) => owner === "private-owner" && vehicle === admittedContext.vehicleId,
    readSession: async (session, owner, vehicle) => session === admittedContext.sessionId && owner === "private-owner" && vehicle === admittedContext.vehicleId ? n54 : null,
    ...overrides };
}
test("U1 rectification: only the selected projection is serialized, with identity, semantics, comparison and provenance", () => {
  const initial = buildSharedWorkspacePayload(n54.workshop, n54, admittedContext, selected().key);
  assert.ok(!("tables" in initial)); assert.ok(initial.projection);
  const exact = projectWorkspaceTable(n54.workshop, evidence(), admittedContext, selected().key);
  assert.equal(initial.projection.identity, exact.identity); assert.deepEqual(initial.projection.semantic, exact.semantic);
  assert.deepEqual(initial.projection.capabilities, exact.capabilities);
  assert.deepEqual(initial.projection.slots.current.provenance, exact.slots.current.provenance);
  assert.deepEqual(initial.projection.slots.current.cells, exact.slots.current.cells);
  assert.equal(initial.projection.comparison.state, exact.comparison.state);
  assert.ok(Buffer.byteLength(JSON.stringify(initial)) < 1_000_000);
  assert.equal(buildSharedWorkspacePayload(n54.workshop, n54, admittedContext, "unknown").projection, null);
});
test("U1 projection boundary: authenticated exact session/Definition returns only requested evidence", async () => {
  let calls = 0;
  const result = await loadSubscriberTableProjection(requestFor(), boundary({ project: (...args) => { calls++; return projectWorkspaceTable(...args); } }));
  assert.equal(calls, 1); assert.equal(result.status, "ready");
  if (result.status === "ready") { assert.equal(result.projection.selection.key, selected().key); assert.equal(result.projection.capabilities.export, null); }
});
for (const [label, owners, expected] of [
  ["signed out", { authenticate: async () => null }, "AUTH_REQUIRED"],
  ["wrong owner", { authenticate: async () => ({ id: "other", scope: "other" }) }, "OWNER_MISMATCH"],
  ["wrong vehicle", { ownsVehicle: async () => false }, "VEHICLE_UNAVAILABLE"],
  ["missing/expired session", { readSession: async () => null }, "SESSION_UNAVAILABLE"],
  ["adapter failure", { project: () => { throw new Error("private server diagnostic"); } }, "MATERIALIZATION_FAILED"],
] as const) {
  test(`U1 projection boundary fails closed: ${label}`, async () => {
    const result = await loadSubscriberTableProjection(requestFor(), boundary(owners));
    assert.equal(result.status, "unavailable"); if (result.status === "unavailable") assert.equal(result.code, expected);
    assert.ok(!JSON.stringify(result).includes("private server diagnostic")); assert.ok(!("projection" in result));
  });
}
for (const field of ["currentDatasetId", "currentDatasetRevision", "romLayoutId", "relationshipRevision", "definitionSetRevision"] as const) {
  test(`U1 projection boundary independently rejects ${field} mismatch`, async () => {
    const result = await loadSubscriberTableProjection({ ...requestFor(), [field]: "wrong" }, boundary());
    assert.equal(result.status, "unavailable"); if (result.status === "unavailable") assert.equal(result.code, "DATASET_MISMATCH");
  });
}
test("U1 projection boundary rejects vehicle/session substitution and unknown/ambiguous occurrence without title fallback", async () => {
  for (const changed of [{ vehicleId: "another" }, { sessionId: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }]) {
    const request = requestFor(); assert.equal((await loadSubscriberTableProjection({ ...request, context: { ...request.context, ...changed } }, boundary())).status, "unavailable");
  }
  for (const changed of [{ key: selected().title }, { definitionRevision: "unknown" }, { occurrence: 9000 }, { occurrence: -1 }]) {
    const request = requestFor(); assert.equal((await loadSubscriberTableProjection({ ...request, selection: { ...request.selection, ...changed } }, boundary())).status, "unavailable");
  }
  const duplicate = { ...n54, workshop: { ...n54.workshop, definitions: [...n54.workshop.definitions, selected()] } } as SubscriberCalibrationSuccess;
  assert.equal((await loadSubscriberTableProjection(requestFor(), boundary({ readSession: async () => duplicate }))).status, "unavailable");
});
test("U1 projection boundary rejects unavailable evidence instead of supplying retained cells", async () => {
  const revision = selected().definitionRevision;
  const material = { ...n54.material, current: { ...n54.material.current, definitions: n54.material.current.definitions.map(item => item.definitionRevisionId === revision ? { ...item, engineeringEvidence: null } : item) } };
  const result = await loadSubscriberTableProjection(requestFor(), boundary({ readSession: async () => ({ ...n54, material }) as SubscriberCalibrationSuccess }));
  assert.equal(result.status, "unavailable"); assert.ok(!("projection" in result));
});
test("U1 projection cache: explicit requests deduplicate, cache exact identity, and reject stale completion", async () => {
  let calls = 0, finish!: (value: ProjectionResponse) => void;
  const cache = createProjectionCache(async () => { calls++; return await new Promise<ProjectionResponse>(resolve => { finish = resolve; }); });
  assert.equal(calls, 0);
  const request = requestFor(), first = cache.request(request), duplicate = cache.request(request);
  assert.equal(first, duplicate); await Promise.resolve(); assert.equal(calls, 1);
  const projection = projectWorkspaceTable(n54.workshop, evidence(), admittedContext, selected().key);
  finish({ status: "ready", projection }); assert.equal((await first).status, "ready");
  assert.equal((await cache.request(request)).status, "ready"); assert.equal(calls, 1);
  for (const changed of [{ ...request, currentDatasetRevision: "changed" }, { ...request, context: { ...admittedContext, sessionId: "changed" } }]) assert.equal(cache.get(changed), undefined);
  cache.clear(); const stale = cache.request(request); await Promise.resolve(); cache.clear(); finish({ status: "ready", projection });
  const rejected = await stale; assert.equal(rejected.status, "unavailable"); assert.equal(cache.get(request), undefined);
  assert.notEqual(projectionRequestKey(request), projectionRequestKey({ ...request, selection: { ...request.selection, occurrence: 1 } }));
});
test("U1 cache cannot admit a response for a different exact table or context", async () => {
  const projection = projectWorkspaceTable(n54.workshop, evidence(), { ...admittedContext, vehicleId: "other" }, selected().key);
  const cache = createProjectionCache(async () => ({ status: "ready", projection }));
  const result = await cache.request(requestFor()); assert.equal(result.status, "unavailable"); assert.equal(cache.get(requestFor()), undefined);
});
test("U1 server dispatch defaults shared, explicitly rolls back and never invokes failing U0 on legacy", () => {
  assert.equal(resolveWorkspacePresentation(undefined), "shared"); assert.equal(resolveWorkspacePresentation("shared"), "shared");
  for (const value of ["legacy", "", "invalid", "SHARED"]) assert.equal(resolveWorkspacePresentation(value), "legacy");
  let called = 0;
  const failing = () => { called++; throw new Error("deliberate U0 failure"); };
  assert.equal(dispatchWorkspace("legacy", () => "retained client", failing), "retained client"); assert.equal(called, 0);
  assert.throws(() => dispatchWorkspace("shared", () => "retained client", failing), /deliberate/); assert.equal(called, 1);
});
for (const [label, width, fine, device] of [["fine to coarse", 1440, false, false], ["tablet attached pointer", 1366, true, true], ["phone", 390, false, true], ["width below threshold", 899, true, false]] as const) {
  test(`U1 active draft cancellation policy: ${label}`, () => {
    const before = directDraftPolicy(true, workspaceInteractionPolicy(1440, true).editing);
    assert.equal(before.showInput, true);
    const after = directDraftPolicy(true, workspaceInteractionPolicy(width, fine, device).editing);
    assert.equal(after.cancel, true); assert.equal(after.showInput, false); assert.equal(after.canSubmit, false);
    assert.equal(directDraftPolicy(false, false).cancel, false);
  });
}
test("U1 pending draft rejects destructive presentation/navigation transitions; toolbar state stays per tab", () => {
  for (const transition of ["table", "close", "view", "display", "terminology", "focus", "back-to-vehicle"]) {
    assert.equal(pendingTransitionAllowed(1), false, transition); assert.equal(pendingTransitionAllowed(0), true, transition);
  }
  const state = updateActiveWorkspaceTab({ tabs: [tab(0), tab(1)], activeId: tab(0).id }, { operand: "77" });
  const next = activateWorkspaceTab(state, tab(1).id);
  assert.equal(next.tabs.find(item => item.id === next.activeId)?.operand, ""); assert.equal(next.tabs[0].operand, "77");
});
for (const [state, expected] of [["reference-current", "Reference and Current"], ["reference-working", "Reference and Working"], ["current", "Current"], ["working", "Working"]] as const) {
  test(`U1 typed plot evidence label: ${state}`, () => { assert.equal(plotPresentationLabels(state).description, expected); });
}

test("U1 revocation discards draft, reports editing false then notice, and rejects a late commit without mutation", () => {
  let draft = "123", mutations = 0; const events: string[] = [];
  discardRevokedDraft(true, false, () => { draft = ""; events.push("discard"); }, editing => events.push(String(editing)), () => events.push("notice"));
  assert.equal(draft, ""); assert.deepEqual(events, ["discard", "false", "notice"]);
  assert.equal(submitDirectDraft(true, false, 123, () => { mutations++; return "applied"; }), null);
  assert.equal(submitDirectDraft(false, true, 123, () => { mutations++; return "applied"; }), null);
  assert.equal(mutations, 0);
});
test("U1 on-demand quarantine response cannot contain numeric projection evidence", async () => {
  const result = await loadSubscriberTableProjection(requestFor(), boundary({ project: (...args) => {
    const projection = projectWorkspaceTable(...args);
    const current = projection.slots.current;
    if (current.state !== "available") throw new Error("Expected an available controlled Table");
    return { ...projection, slots: { ...projection.slots, current: { ...current, state: "quarantined" as const } } };
  } }));
  assert.equal(result.status, "unavailable"); assert.ok(!("projection" in result));
});

test("U1 device classification treats Android/iOS and touch-enabled MacIntel as review devices", () => {
  for (const [agent, platform, touch] of [["Mozilla Android", "Linux", 1], ["Mozilla iPhone", "iPhone", 1], ["Mozilla iPad", "iPad", 5], ["Mozilla Macintosh", "MacIntel", 5]] as const)
    assert.equal(recognizedReviewDevice(agent, platform, touch), true);
  assert.equal(recognizedReviewDevice("Mozilla Windows", "Win32", 1), false);
  assert.equal(recognizedReviewDevice("Mozilla Macintosh", "MacIntel", 0), false);
});
test("U1 imports keep tests/fixtures out of new production paths and the environment selector server-only", () => {
  const paths = ["app/api/calibration-workshop/projection/route.ts", ...[
    "sharedWorkspaceAdapter.ts", "sharedWorkspaceDispatch.ts", "sharedWorkspacePolicy.ts", "sharedWorkspacePresentation.server.ts",
    "sharedWorkspacePresentationState.ts", "sharedWorkspaceProjectionLoader.ts", "sharedWorkspaceProjectionRequest.ts",
  ].map(name => `lib/calibration-workshop/${name}`), ...["shared-calibration-shell.tsx", "shared-evidence-strip.tsx", "shared-workspace-client.tsx"].map(name => `app/dashboard/vehicles/[id]/calibration/${name}`)];
  for (const path of paths) {
    const source = fs.readFileSync(path, "utf8");
    const imports = source.match(/(?:from|import)\s*["'][^"']+["']/g) ?? [];
    for (const imported of imports) assert.doesNotMatch(imported, /\.(?:test|fixtures)(?:\.|["'])/, path);
    if (!path.endsWith("sharedWorkspacePresentation.server.ts")) assert.ok(!source.includes("process.env.TUNESIGHT_CALIBRATION_PRESENTATION"), path);
  }
  assert.match(fs.readFileSync("lib/calibration-workshop/sharedWorkspacePresentation.server.ts", "utf8"), /import "server-only"/);
});
