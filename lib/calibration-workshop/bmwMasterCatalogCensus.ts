import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assessDefinitionExtractionCapability } from "../xdf/calibrationValueExtraction.ts";
import { defineDefinitionSetRevision } from "../xdf/definitionRomApplicability.ts";
import { parseXdfEquation } from "../xdf/engineeringValueConversion.ts";
import { interpretXdfStructure } from "../xdf/interpretXdfStructure.ts";
import { RepositoryDefinitionCatalog } from "./repositoryDefinitionCatalog.ts";
import { BMW_BULK_VIEW_ADMISSION_MANIFEST } from "./bulkViewAdmissionCatalog.ts";

export const BMW_MASTER_CATALOG_CENSUS_CONTRACT = "tunesight.bmw-master-catalog-census.v1" as const;
export type CalibrationCapability = "CATALOGED" | "VIEW_QUALIFIED" | "EDIT_QUALIFIED" | "EXPORT_QUALIFIED" | "FLASH_QUALIFIED";
export type CatalogCohort = "VIEW_QUALIFIED_EXACT" | "VIEW_QUALIFIED_WITH_QUARANTINE" | "MISSING_EXACT_ROM_BINDING" | "MISSING_BINARY_MEMBERSHIP_EVIDENCE" | "EXACT_OR_CANDIDATE_ROM_MAPPING_REQUIRED" | "AMBIGUOUS_PLATFORM_OR_ROM" | "UNRESOLVED_CONFLICT" | "LEGACY_SUPERSEDED_OR_DUPLICATE";

export type BmwMasterCatalogRow = Readonly<{
  relativePath: string; family: string; candidateRomIdentities: readonly string[];
  sourceArtifactId: string | null; definitionSetId: string | null; definitionSetRevision: string | null;
  structuralOutcome: "structurally_interpreted" | "unsupported" | "invalid";
  definitionCount: number; extractionCapableCount: number; conversionCount: number; identityNoOpCount: number;
  quarantineCount: number; conflictCount: number; binaryCount: number; duplicateOf: string | null;
  lifecycleState: "current" | "legacy" | "content_alias";
  cohort: CatalogCohort; capabilities: readonly CalibrationCapability[]; viewQualified: boolean;
  blockers: readonly string[];
}>;

export type BmwMasterCatalogCensus = Readonly<{
  contractVersion: typeof BMW_MASTER_CATALOG_CENSUS_CONTRACT; rows: readonly BmwMasterCatalogRow[];
  totals: Readonly<{ cataloged: number; viewQualified: number; viewWithQuarantine: number; exactRomBindingMissing: number; binaryMembershipEvidenceMissing: number; ambiguous: number; conflicted: number; duplicateLegacySuperseded: number }>;
  familyBreakdown: Readonly<Record<string, Readonly<{ cataloged: number; viewQualified: number; definitions: number }>>>;
}>;

const cache = new Map<string, BmwMasterCatalogCensus>();
const normalize = (value: string) => value.replaceAll("\\", "/");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function files(root: string): string[] {
  const result: string[] = [];
  const walk = (directory: string) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full); else if (entry.name.toLowerCase().endsWith(".xdf")) result.push(full);
  });
  walk(root); return result.sort((a, b) => normalize(path.relative(root, a)).localeCompare(normalize(path.relative(root, b)), "en"));
}

export function buildBmwMasterCatalogCensus(root: string): BmwMasterCatalogCensus {
  const cacheKey = path.resolve(root);
  const cached = cache.get(cacheKey); if (cached) return cached;
  const admitted = RepositoryDefinitionCatalog.listEntries();
  const rejected = new Map(BMW_BULK_VIEW_ADMISSION_MANIFEST.rejected.map((item) => [item.relativePath, item.reason]));
  const seen = new Map<string, string>();
  const rows = files(root).map((full): BmwMasterCatalogRow => {
    const relativePath = normalize(path.relative(root, full)), family = relativePath.split("/")[0]!, name = path.basename(full, ".xdf");
    const bytes = fs.readFileSync(full), parsed = interpretXdfStructure({ xml: bytes.toString("utf8"), filename: path.basename(full), provenance: "BMW Master governed catalog census" });
    const sourceDigest = parsed.sourceArtifact?.sourceDigest ?? `sha256:${sha(bytes)}`;
    const duplicateOf = seen.get(sourceDigest) ?? null; if (!duplicateOf) seen.set(sourceDigest, relativePath);
    const set = parsed.sourceArtifact && parsed.definitions.length ? defineDefinitionSetRevision({ sourceArtifact: parsed.sourceArtifact, definitions: parsed.definitions }) : null;
    const binaryNames = fs.readdirSync(path.dirname(full)).filter((item) => item.toLowerCase().endsWith(".bin") && path.basename(item, ".bin").toLowerCase().startsWith(name.toLowerCase())).sort();
    let extractionCapableCount = 0, conversionCount = 0, identityNoOpCount = 0, validationConflictCount = 0;
    for (const definition of parsed.definitions) {
      const extraction = assessDefinitionExtractionCapability(definition);
      if (extraction.state !== "extraction_capable") { validationConflictCount += 1; continue; }
      extractionCapableCount += 1;
      const axis = definition.axes.find((item) => item.axisId.toLowerCase() === "z") ?? definition.axes.at(-1);
      if (!axis?.equationSource) { validationConflictCount += 1; continue; }
      const equation = parseXdfEquation(axis.equationSource);
      if (equation.outcome === "identity") identityNoOpCount += 1;
      else if (equation.outcome === "parsed") conversionCount += 1;
      else validationConflictCount += 1;
    }
    const representationConflicts = parsed.definitions.filter((item) => item.identity.status === "conflicting").length;
    const isLegacy = /legacy/i.test(relativePath), admission = admitted.find((entry) => entry.identity.family === family && entry.identity.romSoftwareIdentity === name.toUpperCase());
    const isPublished = !isLegacy && admission !== undefined, hasQuarantine = (admission?.quarantines.length ?? 0) > 0;
    const blockers: string[] = [];
    let cohort: CatalogCohort;
    if (isPublished) cohort = hasQuarantine ? "VIEW_QUALIFIED_WITH_QUARANTINE" : "VIEW_QUALIFIED_EXACT";
    else if (isLegacy || duplicateOf) { cohort = "LEGACY_SUPERSEDED_OR_DUPLICATE"; blockers.push(isLegacy ? "Legacy source is outside current relationship scope." : `Content aliases ${duplicateOf}.`); }
    else if (family === "F series N55 S55 N13") { cohort = "AMBIGUOUS_PLATFORM_OR_ROM"; blockers.push("Folder and filename identity do not establish an exact platform/ROM relationship."); if (representationConflicts || validationConflictCount) blockers.push("Technical failures must also be resolved before qualification."); }
    else if (rejected.get(relativePath) === "MISSING_BINARY_MEMBERSHIP_EVIDENCE") { cohort = "MISSING_BINARY_MEMBERSHIP_EVIDENCE"; blockers.push("No responsible repository binary is available to prove exact membership."); }
    else if (rejected.get(relativePath) === "VIEW_TECHNICAL_OR_MEMBERSHIP_GATE_FAILED") { cohort = "UNRESOLVED_CONFLICT"; blockers.push("Exhaustive Current VIEW technical or exact-marker membership validation failed."); }
    else if (representationConflicts || validationConflictCount) { cohort = "UNRESOLVED_CONFLICT"; blockers.push("One or more representation, extraction, or conversion failures lack an accepted dependency-safe quarantine."); }
    else { cohort = "MISSING_EXACT_ROM_BINDING"; blockers.push("Exact canonical ROM/software binding is not established."); }
    const viewQualified = isPublished;
    const capabilities: readonly CalibrationCapability[] = viewQualified ? ["CATALOGED", "VIEW_QUALIFIED"] : ["CATALOGED"];
    return Object.freeze({ relativePath, family, candidateRomIdentities: Object.freeze([name.toUpperCase()]), sourceArtifactId: parsed.sourceArtifact?.artifactId ?? null, definitionSetId: set?.definitionSetId ?? null, definitionSetRevision: set?.revisionId ?? null, structuralOutcome: parsed.outcome, definitionCount: parsed.definitions.length, extractionCapableCount, conversionCount, identityNoOpCount, quarantineCount: hasQuarantine ? 1 : 0, conflictCount: representationConflicts + validationConflictCount, binaryCount: binaryNames.length, duplicateOf, lifecycleState: isLegacy ? "legacy" : duplicateOf ? "content_alias" : "current", cohort, capabilities: Object.freeze(capabilities), viewQualified, blockers: Object.freeze(blockers) });
  });
  const count = (cohort: CatalogCohort) => rows.filter((row) => row.cohort === cohort).length;
  const families = [...new Set(rows.map((row) => row.family))].sort();
  const familyBreakdown = Object.fromEntries(families.map((family) => { const selected = rows.filter((row) => row.family === family); return [family, Object.freeze({ cataloged: selected.length, viewQualified: selected.filter((row) => row.viewQualified).length, definitions: selected.reduce((sum, row) => sum + row.definitionCount, 0) })]; }));
  const census: BmwMasterCatalogCensus = Object.freeze({ contractVersion: BMW_MASTER_CATALOG_CENSUS_CONTRACT, rows: Object.freeze(rows), totals: Object.freeze({ cataloged: rows.length, viewQualified: rows.filter((row) => row.viewQualified).length, viewWithQuarantine: count("VIEW_QUALIFIED_WITH_QUARANTINE"), exactRomBindingMissing: count("MISSING_EXACT_ROM_BINDING") + count("EXACT_OR_CANDIDATE_ROM_MAPPING_REQUIRED"), binaryMembershipEvidenceMissing: count("MISSING_BINARY_MEMBERSHIP_EVIDENCE"), ambiguous: count("AMBIGUOUS_PLATFORM_OR_ROM"), conflicted: count("UNRESOLVED_CONFLICT"), duplicateLegacySuperseded: count("LEGACY_SUPERSEDED_OR_DUPLICATE") }), familyBreakdown: Object.freeze(familyBreakdown) });
  cache.set(cacheKey, census); return census;
}
