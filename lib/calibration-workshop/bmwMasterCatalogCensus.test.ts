import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { buildBmwMasterCatalogCensus } from "./bmwMasterCatalogCensus.ts";

const root = path.resolve("BMW-XDFs-master");

test("all 99 repository XDFs enter one deterministic governed capability census", { timeout: 3_600_000 }, () => {
  const first = buildBmwMasterCatalogCensus(root), second = buildBmwMasterCatalogCensus(root);
  assert.deepEqual(second, first); assert.equal(first.rows.length, 99); assert.equal(first.totals.cataloged, 99);
  assert.equal(new Set(first.rows.map((row) => row.relativePath)).size, 99);
  assert.ok(first.rows.every((row) => row.sourceArtifactId && row.definitionSetRevision && row.capabilities.includes("CATALOGED")));
  assert.ok(first.rows.every((row) => !row.capabilities.includes("EDIT_QUALIFIED") && !row.capabilities.includes("EXPORT_QUALIFIED") && !row.capabilities.includes("FLASH_QUALIFIED")));
});

test("VIEW remains exact, quarantine-aware, and fail-closed for ambiguity or conflict", { timeout: 3_600_000 }, () => {
  const census = buildBmwMasterCatalogCensus(root), viewed = census.rows.filter((row) => row.viewQualified);
  assert.equal(viewed.length, 68);
  for (const existing of ["B58gen1/00003076501103.xdf", "N54/I8A0S.xdf", "N54/IJE0S.xdf", "N54/IKM0S.xdf", "N54/INA0S.xdf"]) assert.ok(viewed.some((row) => row.relativePath === existing));
  assert.equal(census.rows.find((row) => row.relativePath === "B58gen1/00003076501103.xdf")?.cohort, "VIEW_QUALIFIED_WITH_QUARANTINE");
  for (const identity of ["00003076501D02", "00003081501102", "00003081501D04"]) assert.equal(census.rows.find((row) => row.relativePath === `B58gen1/${identity}.xdf`)?.cohort, "VIEW_QUALIFIED_WITH_QUARANTINE");
  assert.ok(census.rows.filter((row) => row.cohort === "AMBIGUOUS_PLATFORM_OR_ROM" || row.cohort === "UNRESOLVED_CONFLICT").every((row) => !row.viewQualified));
});

test("the observed 00005D553C8C05 relationship receives only generic Current VIEW authority", { timeout: 3_600_000 }, () => {
  const row = buildBmwMasterCatalogCensus(root).rows.find((item) => item.relativePath === "B58gen2/00005D553C8C05/00005D553C8C05.xdf");
  assert.ok(row); assert.equal(row.structuralOutcome, "structurally_interpreted"); assert.equal(row.definitionCount, 1242);
  assert.equal(row.extractionCapableCount, 1242); assert.equal(row.conversionCount + row.identityNoOpCount, 1242); assert.equal(row.conflictCount, 0);
  assert.equal(row.viewQualified, true); assert.equal(row.cohort, "VIEW_QUALIFIED_EXACT");
  assert.deepEqual(row.capabilities, ["CATALOGED", "VIEW_QUALIFIED"]);
});
