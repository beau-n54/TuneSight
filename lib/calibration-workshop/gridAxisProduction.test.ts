import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { currentOnlyVisualization } from "./currentOnlyViewModel.ts";
import { buildGridAxisPresentation } from "./gridAxisPresentation.ts";
import { loadSubscriberCalibration } from "./subscriberCalibrationProvider.ts";
import { buildCalibrationVisualizationModel, capabilitiesForDefinition } from "./visualizationModel.ts";
import { materializeWorkshopDefinition } from "./viewModel.ts";

const observedAt = "2026-09-17T00:00:00.000Z";
const measure = (iterations: number, work: () => unknown) => { const started = performance.now(); for (let index = 0; index < iterations; index += 1) work(); return performance.now() - started; };

test("production-shaped B58 and N54 selected Tables expose bounded current-axis presentation", { timeout: 180_000 }, async context => {
  const b58Bytes = new Uint8Array(7_864_320), marker = Buffer.from("00003076501103", "hex");
  for (const offset of [262469, 6814977, 7863823]) b58Bytes.set(marker, offset);
  const b58 = await loadSubscriberCalibration({ bytes: b58Bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt });
  assert.equal(b58.status, "workshop_ready");
  if (b58.status !== "workshop_ready" || !("mode" in b58.workshop)) assert.fail("B58 Current-only Workshop required.");
  const b58Table = b58.workshop.definitions.find(item => item.shape === "2D" && item.axes.some(axis => axis.values.length === item.columns) && item.axes.some(axis => axis.values.length === item.rows))!;
  assert.ok(b58Table);
  const b58Before = measure(1_000, () => currentOnlyVisualization(b58Table));
  const b58After = measure(1_000, () => { currentOnlyVisualization(b58Table); buildGridAxisPresentation({ shape: b58Table.shape, rows: b58Table.rows, columns: b58Table.columns, axes: b58Table.axes, semantic: b58Table.semantic, outputUnits: b58Table.units }); });

  const n54Bytes = new Uint8Array(fs.readFileSync("BMW-XDFs-master/N54/IJE0S_MapSwitchBase.bin"));
  const n54 = await loadSubscriberCalibration({ bytes: n54Bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt });
  assert.equal(n54.status, "workshop_ready");
  if (n54.status !== "workshop_ready" || "mode" in n54.workshop) assert.fail("N54 comparison Workshop required.");
  const summary = n54.workshop.definitions.find(item => item.shape === "2D" && item.available)!;
  const n54Table = n54.workshop.selectedDefinition.summary.key === summary.key ? n54.workshop.selectedDefinition : materializeWorkshopDefinition(n54.workshop, summary.key);
  const n54Before = measure(1_000, () => buildCalibrationVisualizationModel(n54Table));
  const n54After = measure(1_000, () => { buildCalibrationVisualizationModel(n54Table); buildGridAxisPresentation({ shape: n54Table.summary.shape, rows: n54Table.rows, columns: n54Table.columns, axes: n54Table.axes, referenceAxes: n54Table.referenceAxes, semantic: n54Table.summary.semantic, outputUnits: n54Table.summary.units }); });

  const one = { ...n54Table, summary: { ...n54Table.summary, shape: "1D" as const }, rows: 1, columns: n54Table.columns, axes: n54Table.axes.slice(0, 1) };
  const scalar = { ...n54Table, summary: { ...n54Table.summary, shape: "scalar" as const }, rows: 1, columns: 1, axes: [] };
  const oneMs = measure(10_000, () => buildGridAxisPresentation({ shape: "1D", rows: one.rows, columns: one.columns, axes: one.axes, semantic: one.summary.semantic, outputUnits: one.summary.units }));
  const scalarMs = measure(10_000, () => buildGridAxisPresentation({ shape: "scalar", rows: 1, columns: 1, axes: [], semantic: scalar.summary.semantic, outputUnits: scalar.summary.units }));
  assert.equal(capabilitiesForDefinition(n54Table).grid, true);
  assert.ok((b58After - b58Before) / 1_000 < 1, "B58 axis presentation overhead exceeded 1 ms per materialization.");
  assert.ok((n54After - n54Before) / 1_000 < 1, "N54 axis presentation overhead exceeded 1 ms per materialization.");
  assert.ok(oneMs / 10_000 < 1 && scalarMs / 10_000 < 1);
  context.diagnostic(`GRID_AXIS_PERFORMANCE ${JSON.stringify({ b58BeforeMs: b58Before, b58AfterMs: b58After, n54BeforeMs: n54Before, n54AfterMs: n54After, oneDimensional10000Ms: oneMs, scalar10000Ms: scalarMs })}`);
});
