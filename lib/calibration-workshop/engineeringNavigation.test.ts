import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { bindDefinitionKnowledge, type QualifiedSemanticField, type WorkshopKnowledgeRecord } from "./definitionKnowledgeBinding.ts";
import { buildEngineeringNavigationIndex, engineeringNavigationEmptyState, filterEngineeringNavigation } from "./engineeringNavigation.ts";
import { TUNING_ESSENTIAL_SYSTEMS } from "./tuningEssentials.ts";
import { buildBmwEngineeringNavigationCensus } from "./engineeringNavigationCensus.ts";

const field = <T>(value: T, id: string): QualifiedSemanticField<T> => ({ value, assertionId: id, assertionRevision: "1", authority: "engineering", provenance: ["governed"], limitations: [] });
const record = (verification: WorkshopKnowledgeRecord["verification"], revision: string, system = "Boost & Air Control"): WorkshopKnowledgeRecord => ({ knowledgeId: `knowledge:${revision}`, knowledgeRevision: "1", lifecycle: "active", verification, conflict: false, exactWorkshopInstanceIdentities: [], exactDefinitionIdentities: [], exactDefinitionRevisions: [revision], applicability: [], aliases: [field("Boost Target", `alias:${revision}`)], engineeringSystem: field(system, `system:${revision}`), controls: [field("Controls qualified charge-pressure demand.", `control:${revision}`)], whyItMatters: [], howToRead: [], directionalEffects: [], operatingContexts: [], engineeringConsiderations: [], axisMeanings: [], relatedCalibrations: [], telemetryRelationships: [], limitations: [] });
const definition = (revision: string, title: string, records: readonly WorkshopKnowledgeRecord[], available = true) => ({ key: revision, title, available, semantic: bindDefinitionKnowledge({ definitionIdentity: null, definitionRevision: revision }, records) });

test("classification separates authoritative, candidate and unclassified evidence without title inference", () => {
  const records = [record("verified", "qualified"), record("candidate", "candidate")];
  const index = buildEngineeringNavigationIndex([definition("qualified", "Unrelated source title", records), definition("candidate", "Another source title", records), definition("unknown", "Boost Lambda WGDC Timing", records)]);
  assert.deepEqual(index.counts, { ENGINEERING_QUALIFIED: 1, SOURCE_DERIVED_CANDIDATE: 1, UNCLASSIFIED: 1, essentials: 1, duplicateSystemMemberships: 0 });
  assert.equal(index.entries[2]?.classification, "UNCLASSIFIED");
  assert.equal(index.entries[2]?.essential, false);
});

test("All Tables stays complete while Systems and Essentials are exact-ROM scoped and capability-independent", () => {
  const records = [record("verified", "boost"), record("verified", "fuel", "Fueling / Lambda")];
  const boost = definition("boost", "Source boost", records), fuelUnavailable = definition("fuel", "Source fuel", records, false), other = definition("other", "Source other", records);
  const index = buildEngineeringNavigationIndex([boost, fuelUnavailable, other]);
  assert.equal(filterEngineeringNavigation(index, { mode: "all" }).length, 3);
  assert.deepEqual(filterEngineeringNavigation(index, { mode: "systems", system: "Boost & Air Control" }).map(entry => entry.definition.key), ["boost"]);
  assert.deepEqual(filterEngineeringNavigation(index, { mode: "essentials" }).map(entry => entry.definition.key), ["boost"]);
  assert.equal(index.entries.find(entry => entry.definition.key === "fuel")?.classification, "ENGINEERING_QUALIFIED");
  assert.equal(index.entries.find(entry => entry.definition.key === "fuel")?.essential, false);
  assert.deepEqual(index.systems.map(system => system.label).slice(0, 7), TUNING_ESSENTIAL_SYSTEMS);
  assert.equal(engineeringNavigationEmptyState(index, { mode: "systems", system: "Ignition / Timing" }, 0), "knowledge_empty");
  assert.equal(engineeringNavigationEmptyState(index, { mode: "all", query: "no-result" }, 0), "filter_zero");
});

test("literal search remains complete while engineering-intent search requires qualified Knowledge", () => {
  const records = [record("verified", "qualified")];
  const index = buildEngineeringNavigationIndex([definition("qualified", "BMW Quelldruck", records), definition("plain", "Literal Lambda Table", records)]);
  assert.deepEqual(filterEngineeringNavigation(index, { mode: "all", query: "Quelldruck" }).map(entry => entry.definition.key), ["qualified"]);
  assert.deepEqual(filterEngineeringNavigation(index, { mode: "all", query: "Boost Target" }).map(entry => entry.definition.key), ["qualified"]);
  assert.deepEqual(filterEngineeringNavigation(index, { mode: "all", query: "Lambda" }).map(entry => entry.definition.key), ["plain"]);
  const candidate = buildEngineeringNavigationIndex([definition("candidate", "Opaque source", [record("candidate", "candidate")])]);
  assert.equal(filterEngineeringNavigation(candidate, { mode: "all", query: "boost target" }).length, 0);
});

test("qualified related systems preserve deterministic multi-system membership", () => {
  const primary = record("verified", "multi"), records = [{ ...primary, relatedEngineeringSystems: [field("Load & Torque", "system:related")] }];
  const index = buildEngineeringNavigationIndex([definition("multi", "Source multi", records)]);
  assert.deepEqual(index.entries[0]?.systems, ["Boost & Air Control", "Load & Torque"]);
  assert.equal(index.counts.duplicateSystemMemberships, 1);
  assert.equal(filterEngineeringNavigation(index, { mode: "systems", system: "Load & Torque" }).length, 1);
});

test("BMW-wide census leaves every Table unclassified until runtime Knowledge is published", { timeout: 180_000 }, () => {
  const census = buildBmwEngineeringNavigationCensus();
  assert.equal(census.relationships, 68);
  assert.equal(census.tables, 74_220);
  assert.equal(census.ENGINEERING_QUALIFIED, 0);
  assert.equal(census.SOURCE_DERIVED_CANDIDATE, 0);
  assert.equal(census.UNCLASSIFIED, 74_220);
  assert.equal(census.essentials, 0);
  assert.equal(census.families.reduce((sum, family) => sum + family.tables, 0), census.tables);
});

test("both subscriber Workshop variants integrate navigation without replacing persistent tabs or navigating routes", () => {
  const root = path.join(process.cwd(), "app", "dashboard", "vehicles", "[id]", "calibration");
  const shared = fs.readFileSync(path.join(root, "engineering-navigation-control.tsx"), "utf8");
  for (const label of ["All Tables", "Tuning Essentials", "Systems", "Changed / Evidence"]) assert.match(shared, new RegExp(label));
  assert.match(shared, /Calibration Workspace engineering navigation/);
  for (const file of ["workshop-client.tsx", "current-only-workshop-client.tsx"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /import EngineeringNavigationControl/);
    assert.equal(source.match(/<EngineeringNavigationControl(?=\s|\/?>)/g)?.length, 1);
    assert.doesNotMatch(source, /Table Explorer navigation/);
    assert.match(source, /WorkspaceTabs/);
    assert.match(source, /openWorkspaceTab/);
    assert.match(source, /knowledge_empty/);
    assert.match(source, /No qualified/);
    assert.doesNotMatch(source, /buildWorkshopDeepLink|from "next\/link"/);
  }
});

test("production-shaped 1,175-Table index and search remain bounded", () => {
  const definitions = Array.from({ length: 1_175 }, (_, index) => definition(`plain:${index}`, `Source Table ${index}`, []));
  const started = performance.now(), navigation = buildEngineeringNavigationIndex(definitions), indexedMs = performance.now() - started;
  const searchStarted = performance.now(), results = filterEngineeringNavigation(navigation, { mode: "all", query: "Table 1174" }), searchMs = performance.now() - searchStarted;
  assert.equal(navigation.entries.length, 1_175);
  assert.deepEqual(results.map(entry => entry.definition.key), ["plain:1174"]);
  assert.ok(indexedMs < 100, `index exceeded bounded budget: ${indexedMs}ms`);
  assert.ok(searchMs < 50, `search exceeded bounded budget: ${searchMs}ms`);
});
