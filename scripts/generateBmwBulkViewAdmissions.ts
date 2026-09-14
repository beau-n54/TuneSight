import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveBinaryContainer } from "../lib/tunes/binaryContainer.ts";
import { validateCompleteDefinitionSet } from "../lib/xdf/bmwMasterFullValidation.ts";
import { defineDefinitionSetRevision } from "../lib/xdf/definitionRomApplicability.ts";
import { interpretXdfStructure } from "../lib/xdf/interpretXdfStructure.ts";
import { extractRawCalibrationValues } from "../lib/xdf/calibrationValueExtraction.ts";
import { evaluateParsedXdfEquation, parseXdfEquation } from "../lib/xdf/engineeringValueConversion.ts";
import { auditTableQuarantineSafety, constructTableQuarantineRecord } from "../lib/xdf/tableQuarantine.ts";
import census from "../engineering/calibration/bmw-master-99-xdf-census.json" with { type: "json" };
import existingManifest from "../engineering/calibration/bmw-master-bulk-view-admissions.json" with { type: "json" };

const root = path.resolve("BMW-XDFs-master"), sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const offsets = (bytes: Uint8Array, needle: Uint8Array): number[] => { const result: number[] = []; const buffer = Buffer.from(bytes); let at = buffer.indexOf(needle); while (at >= 0) { result.push(at); at = buffer.indexOf(needle, at + 1); } return result; };
const priorPublications = new Set(["N54/I8A0S.xdf", "N54/IJE0S.xdf", "N54/IKM0S.xdf", "N54/INA0S.xdf", "B58gen1/00003076501103.xdf"]);
const expansionPaths = new Set(["B58gen1/00003076501D02.xdf", "B58gen1/00003081501102.xdf", "B58gen1/00003081501D04.xdf"]), expansionOnly = process.argv.includes("--b58-gen1-expansion");
const candidates = census.rows.filter((row) => row.lifecycleState === "current" && !priorPublications.has(row.relativePath) && row.family !== "F series N55 S55 N13" && row.conflictCount === 0 && (!expansionOnly || expansionPaths.has(row.relativePath)));
const admitted: unknown[] = expansionOnly ? existingManifest.admitted.filter((item) => !expansionPaths.has(item.relativePath)) : [], rejected: unknown[] = expansionOnly ? existingManifest.rejected.filter((item) => !expansionPaths.has(item.relativePath)) : [];

for (const row of candidates) {
  const full = path.join(root, ...row.relativePath.split("/")), rom = row.candidateRomIdentities[0]!;
  const parsed = interpretXdfStructure({ xml: fs.readFileSync(full, "utf8"), filename: path.basename(full), provenance: "Founder-authorized BMW bulk Current VIEW admission" });
  if (!parsed.sourceArtifact || parsed.outcome !== "structurally_interpreted") { rejected.push({ relativePath: row.relativePath, reason: "STRUCTURAL_PARSE_FAILED" }); continue; }
  const set = defineDefinitionSetRevision({ sourceArtifact: parsed.sourceArtifact, definitions: parsed.definitions });
  const names = fs.readdirSync(path.dirname(full)).filter((name) => name.toLowerCase().endsWith(".bin") && path.basename(name, ".bin").toLowerCase().startsWith(path.basename(full, ".xdf").toLowerCase())).sort();
  if (!names.length) { rejected.push({ relativePath: row.relativePath, reason: "MISSING_BINARY_MEMBERSHIP_EVIDENCE" }); continue; }
  const binaries = [], quarantines = []; let clean = true; let markerDetector: "bounded_ascii_exact" | "bounded_hex_encoded_exact" | null = null; let markerOffsets: number[] = [];
  for (const name of names) {
    const resolved = resolveBinaryContainer({ bytes: fs.readFileSync(path.join(path.dirname(full), name)), fileName: name });
    if (resolved.status !== "resolved") { clean = false; break; }
    const binary = resolved.engineeringBinary, ascii = offsets(binary.bytes, Buffer.from(rom, "ascii")), hex = /^[0-9A-F]+$/.test(rom) && rom.length % 2 === 0 ? offsets(binary.bytes, Buffer.from(rom, "hex")) : [];
    const observed = ascii.length ? ascii : hex; if (!observed.length) { clean = false; break; }
    if (!markerDetector) { markerDetector = ascii.length ? "bounded_ascii_exact" : "bounded_hex_encoded_exact"; markerOffsets = observed; }
    if ((ascii.length ? "bounded_ascii_exact" : "bounded_hex_encoded_exact") !== markerDetector || JSON.stringify(observed) !== JSON.stringify(markerOffsets)) { clean = false; break; }
    const validation = validateCompleteDefinitionSet({ sourceDigest: parsed.sourceArtifact.sourceDigest, definitionSetRevision: set.revisionId, binary, binaryDigest: sha(binary.bytes), definitions: parsed.definitions });
    if (validation.blocked || validation.representationConflicts || validation.malformed || validation.unavailable) clean = false;
    binaries.push({ digest: validation.binaryDigest, byteLength: binary.byteLength, containerType: binary.source.containerType, sourceRole: /mapswitch/i.test(name) ? "mapswitch" : "stock_original", validationRevision: validation.validationRevision });
    if (validation.invalidNumeric) for (const definition of parsed.definitions) {
      const raw = extractRawCalibrationValues(binary, definition), axis = definition.axes.find((item) => item.axisId.toLowerCase() === "z") ?? definition.axes.at(-1);
      if (raw.outcome !== "extracted" || raw.shape?.values[0] === undefined || !axis?.equationSource) continue;
      const equation = parseXdfEquation(axis.equationSource); if (equation.outcome === "unsupported_expression" || equation.outcome === "malformed_equation" || evaluateParsedXdfEquation(equation, raw.shape.values[0]).outcome !== "invalid_numeric_result") continue;
      const occurrence = parsed.definitions.filter((item) => item.revisionId === definition.revisionId).indexOf(definition), safety = auditTableQuarantineSafety({ definitions: parsed.definitions, engineeringBinary: binary, definitionRevisionId: definition.revisionId, occurrence, expectedFailureClass: "invalid_engineering_conversion" });
      if (safety.outcome !== "dependency_safe_for_quarantine") { clean = false; continue; }
      const width = Math.max(1, (raw.widthBits ?? 8) / 8), rawOffset = raw.offsets[0]!;
      quarantines.push(constructTableQuarantineRecord({ relationship: { romSoftwareIdentity: rom, sourceArtifactId: parsed.sourceArtifact.artifactId, definitionSetRevision: set.revisionId }, occurrence: { definitionIdentity: definition.identity.stableId!, definitionRevisionId: definition.revisionId, sourceBindingDigest: definition.sourceBindingDigest, occurrence }, affectedBinary: { digest: validation.binaryDigest, role: /mapswitch/i.test(name) ? "mapswitch" : "stock_original", validationRevision: validation.validationRevision }, failureClass: "invalid_engineering_conversion", failureEvidence: { rawOffsets: [rawOffset], rawBytes: [...binary.bytes.slice(rawOffset, rawOffset + width)], rawValues: [raw.shape.values[0]], equation: axis.equationSource, outcome: "invalid_numeric_result", finding: "Division by zero." }, safetyAssessment: safety, safetyAssessmentRevision: safety.assessmentRevision, provenance: ["Repository-controlled exact binary validation."], limitations: ["Quarantine does not qualify, correct, recommend or authorize mutation of this Definition."], authority: { reviewerId: "tunesight-governed-engineering-review", authorityRevision: "table-quarantine-review-authority-revision:2026-09-15-bmw-current-view-expansion" }, quarantinedAt: "2026-09-15T00:00:00.000Z" }));
    }
  }
  if (!clean || !markerDetector || !markerOffsets.length) { rejected.push({ relativePath: row.relativePath, reason: "VIEW_TECHNICAL_OR_MEMBERSHIP_GATE_FAILED" }); continue; }
  if (new Set(binaries.map((item) => item.containerType)).size !== 1) { rejected.push({ relativePath: row.relativePath, reason: "AMBIGUOUS_BINARY_TOPOLOGY" }); continue; }
  const binaryByteLength = Math.min(...binaries.map((item) => item.byteLength)), layoutBinaries = binaries.filter((item) => item.byteLength === binaryByteLength), layoutQuarantines = quarantines.filter((item) => item.affectedBinary.digest === layoutBinaries.find((binary) => binary.digest === item.affectedBinary.digest)?.digest);
  const addresses = parsed.definitions.map((item) => item.primaryAddress).filter((item): item is number => item !== null), region = parsed.definitions[0]?.addressSpace.regions[0];
  if (!region || !addresses.length) { rejected.push({ relativePath: row.relativePath, reason: "MISSING_LAYOUT_EVIDENCE" }); continue; }
  admitted.push({ relativePath: row.relativePath, family: row.family, romSoftwareIdentity: rom, sourceArtifactId: parsed.sourceArtifact.artifactId, sourceArtifactDigest: parsed.sourceArtifact.sourceDigest, definitionSetId: set.definitionSetId, definitionSetRevision: set.revisionId, definitionCount: parsed.definitions.length, binaryByteLength, containerType: layoutBinaries[0]!.containerType, marker: { normalizedForm: rom, detector: markerDetector, offsets: markerOffsets }, calibrationAddressSpace: [{ startAddress: region.startAddress, size: region.size }], definitionCompatibleAddressRange: { minimum: Math.min(...addresses), maximum: Math.max(...addresses) }, supportingExactBinaries: layoutBinaries, ...(layoutQuarantines.length ? { quarantines: layoutQuarantines } : {}) });
}

const material = { contractVersion: "tunesight.bmw-bulk-current-view-admission.v1", authorizedAt: "2026-09-15T00:00:00.000Z", authority: "Founder Beau and Bob bulk Current VIEW admission and quarantine-aware B58 Gen1 expansion; no direct EDIT, EXPORT, FLASH, Stock, or Reference authority.", admitted, rejected };
const revision = `bmw-bulk-current-view-admission-revision:${sha(Buffer.from(JSON.stringify(material)))}`;
const output = { ...material, revision };
fs.writeFileSync(path.resolve("engineering/calibration/bmw-master-bulk-view-admissions.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ admitted: admitted.length, rejected: rejected.length, rejectedReasons: rejected }));
