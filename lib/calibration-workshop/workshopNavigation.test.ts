import assert from "node:assert/strict";
import test from "node:test";
import { bindDefinitionKnowledge } from "./definitionKnowledgeBinding.ts";
import { buildWorkshopDeepLink } from "./workshopNavigation.ts";
import { filterWorkshopDefinitions, selectWorkshopDefinitionKey, type WorkshopDefinitionSummary, type WorkshopFilter } from "./viewModel.ts";

const ROMS = ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const;
const FILTERS: readonly WorkshopFilter[] = ["all", "changed", "unchanged", "unavailable", "axis_changed", "value_and_axis_changed", "conflict"];

function definition(rom: string, outcome: WorkshopDefinitionSummary["outcome"], available = true): WorkshopDefinitionSummary {
  const identity = { key: `${rom}:${outcome}`, occurrence: 0, definitionIdentity: `${rom}:identity:${outcome}`, definitionRevision: `${rom}:revision:${outcome}`, title: `${rom} ${outcome} searchable`, description: null, shape: available ? "1D" as const : "unavailable" as const, units: null, outcome, changedCellCount: outcome === "changed" ? 1 : 0, available };
  return Object.freeze({ ...identity, semantic: bindDefinitionKnowledge(identity, []) });
}

test("every Explorer filter and literal-search result preserves each explicit ROM", () => {
  for (const rom of ROMS) {
    const definitions = [definition(rom, "changed"), definition(rom, "unchanged"), definition(rom, "comparison_unavailable", false), definition(rom, "axis_changed"), definition(rom, "value_and_axis_changed"), definition(rom, "representation_conflict")];
    for (const filter of FILTERS) {
      const results = filterWorkshopDefinitions(definitions, "", filter);
      if (filter !== "conflict" || results.length > 0) assert.ok(results.length > 0, `${rom}/${filter}`);
      for (const result of results) {
        const url = new URL(buildWorkshopDeepLink({ vehicleId: "vehicle 1", previewRom: rom, definition: result.key }), "http://localhost");
        assert.equal(url.searchParams.get("previewRom"), rom);
        assert.equal(url.searchParams.get("definition"), result.key);
      }
    }
    const searchResult = filterWorkshopDefinitions(definitions, `${rom} unchanged searchable`, "all");
    assert.equal(searchResult.length, 1);
    const searchUrl = new URL(buildWorkshopDeepLink({ vehicleId: "vehicle 1", previewRom: rom, definition: searchResult[0]!.key }), "http://localhost");
    assert.equal(searchUrl.searchParams.get("previewRom"), rom);
    assert.equal(searchUrl.searchParams.get("definition"), searchResult[0]!.key);
  }
});

test("deep-link generation is deterministic and deliberate ROM switching drops the old Definition", () => {
  const first = buildWorkshopDeepLink({ vehicleId: "vehicle/1", previewRom: "I8A0S", definition: "instance:1" });
  assert.equal(first, buildWorkshopDeepLink({ vehicleId: "vehicle/1", previewRom: "I8A0S", definition: "instance:1" }));
  const switched = new URL(buildWorkshopDeepLink({ vehicleId: "vehicle/1", previewRom: "IKM0S" }), "http://localhost");
  assert.equal(switched.searchParams.get("previewRom"), "IKM0S");
  assert.equal(switched.searchParams.has("definition"), false);
  assert.throws(() => buildWorkshopDeepLink({ vehicleId: "", previewRom: "I8A0S" }), /vehicle identity/);
  assert.throws(() => buildWorkshopDeepLink({ vehicleId: "vehicle", previewRom: "" }), /preview ROM/);
});

test("a Definition selector from another ROM resolves to the selected-ROM default", () => {
  for (const rom of ROMS) {
    const definitions = [definition(rom, "changed"), definition(rom, "unchanged")];
    const selected = selectWorkshopDefinitionKey(definitions, "OTHER-ROM:changed");
    assert.equal(selected, definitions[0]!.key);
    assert.match(selected, new RegExp(`^${rom}:`));
  }
});
