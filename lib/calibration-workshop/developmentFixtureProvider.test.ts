import assert from "node:assert/strict";
import test from "node:test";
import { assertN54PreviewFixtureDescriptor, clearDevelopmentFixtureCacheForTests, constructN54PreviewFixtureDescriptor, constructWorkshopDiscoveryRegistry, developmentCalibrationWorkshopProvider, selectN54PreviewRom, type N54PreviewRom } from "./developmentFixtureProvider.ts";
import { filterWorkshopDefinitions } from "./viewModel.ts";
import { buildCalibrationSlice, buildCalibrationSurfaceMesh, buildCalibrationVisualizationModel, moveSelectedCell } from "./visualizationModel.ts";

const ROMS = ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const;
const COUNTS: Readonly<Record<N54PreviewRom, number>> = { I8A0S: 721, IJE0S: 739, IKM0S: 707, INA0S: 717 };

test("four governed descriptors bind unique exact fixture chains", () => {
  const descriptors = ROMS.map(constructN54PreviewFixtureDescriptor);
  descriptors.forEach(assertN54PreviewFixtureDescriptor);
  assert.equal(new Set(descriptors.map((item) => item.configuration.fixtureIdentity)).size, 4);
  assert.equal(new Set(descriptors.map((item) => item.layout.layoutId)).size, 4);
  assert.equal(new Set(descriptors.map((item) => item.source.set.revisionId)).size, 4);
  assert.equal(new Set(descriptors.map((item) => item.cacheKey)).size, 4);
  for (const descriptor of descriptors) {
    assert.equal(descriptor.configuration.referenceRole, "stock_candidate");
    assert.equal(descriptor.configuration.modifiedRole, "mapswitch");
    assert.match(descriptor.cacheKey, new RegExp(descriptor.referenceBinary.identity.digest));
    assert.match(descriptor.cacheKey, new RegExp(descriptor.modifiedBinary.identity.digest));
  }
});

test("all current N54 ROMs travel through one provider, complete Explorer and visualization path", async (context) => {
  clearDevelopmentFixtureCacheForTests();
  const timings: Record<string, { cleanMs: number; warmMs: number }> = {};
  for (const rom of ROMS) {
    const started = performance.now();
    const first = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("parity-vehicle", "parity-user", null, rom);
    const cleanMs = Math.round(performance.now() - started);
    const warmStarted = performance.now();
    const second = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("parity-vehicle", "parity-user", null, rom);
    timings[rom] = { cleanMs, warmMs: Math.round(performance.now() - warmStarted) };
    assert.equal(first.source.label, `${rom} Original → ${rom} MapSwitch`);
    assert.equal(first.definitions.length, COUNTS[rom]);
    assert.equal(first.comparison.totalDefinitions, COUNTS[rom]);
    assert.equal(new Set(first.definitions.map((item) => item.key)).size, COUNTS[rom]);
    assert.equal(first.source.romLayoutId, constructN54PreviewFixtureDescriptor(rom).layout.layoutId);
    assert.equal(first.states[0]?.sourceRole, "Stock Candidate");
    assert.equal(first.states[1]?.sourceRole, "MapSwitch");
    assert.ok(first.definitions.some((item) => item.shape === "scalar" && item.available));
    assert.ok(first.definitions.some((item) => item.shape === "1D" && item.available));
    assert.ok(first.definitions.some((item) => item.shape === "2D" && item.available));
    assert.ok(first.definitions.some((item) => !item.available));
    assert.ok(filterWorkshopDefinitions(first.definitions, first.definitions[0]!.title, "all").length > 0);
    assert.ok(filterWorkshopDefinitions(first.definitions, "", "changed").length > 0);
    assert.ok(filterWorkshopDefinitions(first.definitions, "", "unavailable").length > 0);
    const oneD = first.definitions.find((item) => item.shape === "1D" && item.available && item.changedCellCount > 0)!;
    const oneDWorkshop = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("parity-vehicle", "parity-user", oneD.key, rom);
    const lineModel = buildCalibrationVisualizationModel(oneDWorkshop.selectedDefinition);
    assert.equal(lineModel.capabilities.twoDimensional, true);
    assert.ok(buildCalibrationSlice(lineModel, "row", 0).length > 0);
    let surfaceProof: Awaited<ReturnType<typeof developmentCalibrationWorkshopProvider.loadVehicleWorkshop>> | null = null;
    for (const candidate of first.definitions.filter((item) => item.shape === "2D" && item.available && item.changedCellCount > 0)) {
      const candidateWorkshop = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("parity-vehicle", "parity-user", candidate.key, rom);
      if (buildCalibrationSurfaceMesh(buildCalibrationVisualizationModel(candidateWorkshop.selectedDefinition)).available) { surfaceProof = candidateWorkshop; break; }
    }
    assert.ok(surfaceProof, `${rom} requires one genuine surface-capable 2D Table.`);
    const twoDWorkshop = surfaceProof;
    const surfaceModel = buildCalibrationVisualizationModel(twoDWorkshop.selectedDefinition);
    assert.equal(surfaceModel.capabilities.threeDimensional, true);
    assert.equal(buildCalibrationSurfaceMesh(surfaceModel).available, true);
    assert.ok(surfaceModel.surface.some((cell) => cell.changed));
    assert.equal(moveSelectedCell(twoDWorkshop.selectedDefinition, 0, 0, 1), 1);
    assert.equal(twoDWorkshop.selectedDefinition.information.romLayoutId, first.source.romLayoutId);
    assert.equal(twoDWorkshop.selectedDefinition.summary.semantic.outcome, "unavailable");
    assert.deepEqual(second, first);
    assert.ok(Object.isFrozen(first));
  }
  context.diagnostic(`N54_PROVIDER_TIMINGS ${JSON.stringify(timings)}`);
});

test("same-revision occurrences remain distinct for every current N54 ROM", async (context) => {
  const census: Record<string, number> = {};
  for (const rom of ROMS) {
    const workshop = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("occurrence-vehicle", "occurrence-user", null, rom);
    const groups = Map.groupBy(workshop.definitions, (item) => item.definitionRevision);
    const duplicates = [...groups.values()].filter((items) => items.length > 1);
    census[rom] = duplicates.length;
    for (const items of duplicates) {
      assert.equal(new Set(items.map((item) => item.key)).size, items.length);
      assert.deepEqual(items.map((item) => item.occurrence), items.map((_, index) => index));
    }
  }
  context.diagnostic(`N54_DUPLICATE_REVISION_GROUPS ${JSON.stringify(census)}`);
});

test("cache is ROM-isolated and warm loads remain deterministic", async () => {
  const workshops = await Promise.all(ROMS.map((rom) => developmentCalibrationWorkshopProvider.loadVehicleWorkshop("cache-vehicle", "cache-user", null, rom)));
  assert.equal(new Set(workshops.map((item) => item.source.referenceDatasetId)).size, 4);
  assert.equal(new Set(workshops.map((item) => item.source.currentDatasetId)).size, 4);
  assert.equal(new Set(workshops.map((item) => item.source.comparisonId)).size, 4);
  for (let index = 0; index < ROMS.length; index += 1) assert.deepEqual(await developmentCalibrationWorkshopProvider.loadVehicleWorkshop("cache-vehicle", "cache-user", null, ROMS[index]), workshops[index]);
});

test("mismatched descriptor chain fails closed", () => {
  const ije = constructN54PreviewFixtureDescriptor("IJE0S");
  const ina = constructN54PreviewFixtureDescriptor("INA0S");
  assert.throws(() => assertN54PreviewFixtureDescriptor({ ...ije, modifiedBinary: ina.modifiedBinary }), /mismatched binary identity/);
});

test("unknown preview selectors never fall back and absence has one documented default", () => {
  assert.deepEqual(selectN54PreviewRom(undefined), { status: "valid", rom: "IJE0S" });
  assert.deepEqual(selectN54PreviewRom("I8A0S"), { status: "valid", rom: "I8A0S" });
  assert.deepEqual(selectN54PreviewRom("ije0s"), { status: "invalid", requested: "ije0s" });
  assert.deepEqual(selectN54PreviewRom("IJE0S_Legacy"), { status: "invalid", requested: "IJE0S_Legacy" });
  assert.deepEqual(selectN54PreviewRom("unknown"), { status: "invalid", requested: "unknown" });
});

test("development registry remains fail-closed for an inconsistent descriptor universe", () => {
  assert.throws(() => constructWorkshopDiscoveryRegistry([]), /Every active qualified relationship requires its exact ROM Layout Identity descriptor source/);
});
