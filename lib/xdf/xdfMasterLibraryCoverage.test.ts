import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assessDefinitionExtractionCapability } from "./calibrationValueExtraction.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";

function auditMasterLibrary() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "BMW-XDFs-master");
  const files: string[] = [];
  const walk = (directory: string) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => { const full = path.join(directory, entry.name); if (entry.isDirectory()) walk(full); else if (entry.name.toLowerCase().endsWith(".xdf")) files.push(full); });
  walk(root); files.sort();
  const report = { discovered: files.length, structurallyReadable: 0, unsupported: 0, invalid: 0, definitions: 0, extractionCapable: 0, blocked: 0, conflicting: 0, aliases: 0 };
  const families = new Map<string, { files: number; structurallyReadable: number; invalid: number; unsupported: number; definitions: number; extractionCapable: number; blocked: number; conflicting: number; aliases: number }>();
  const versions = new Map<string, { files: number; definitions: number; extractionCapable: number; blocked: number }>();
  const blockingReasons = new Map<string, { count: number; files: Set<string>; families: Set<string> }>();
  for (const file of files) {
    const relative = path.relative(root, file); const family = relative.split(path.sep)[0]; const familyReport = families.get(family) ?? { files: 0, structurallyReadable: 0, invalid: 0, unsupported: 0, definitions: 0, extractionCapable: 0, blocked: 0, conflicting: 0, aliases: 0 }; familyReport.files += 1; families.set(family, familyReport);
    const parsed = interpretXdfStructure({ xml: fs.readFileSync(file, "utf8"), filename: path.basename(file), provenance: "BMW master-library coverage audit" });
    if (parsed.outcome === "structurally_interpreted") { report.structurallyReadable += 1; familyReport.structurallyReadable += 1; } else if (parsed.outcome === "unsupported") { report.unsupported += 1; familyReport.unsupported += 1; } else { report.invalid += 1; familyReport.invalid += 1; }
    const version = parsed.sourceArtifact?.observedVersion ?? "unavailable"; const versionReport = versions.get(version) ?? { files: 0, definitions: 0, extractionCapable: 0, blocked: 0 }; versionReport.files += 1; versions.set(version, versionReport);
    report.definitions += parsed.definitions.length; familyReport.definitions += parsed.definitions.length; versionReport.definitions += parsed.definitions.length;
    const conflicts = parsed.findings.filter((finding) => finding.code === "definition_identity_conflicting").length; const aliases = parsed.findings.filter((finding) => finding.code === "definition_identity_alias").length; report.conflicting += conflicts; report.aliases += aliases; familyReport.conflicting += conflicts; familyReport.aliases += aliases;
    for (const definition of parsed.definitions) {
      const capability = assessDefinitionExtractionCapability(definition);
      if (capability.state === "extraction_capable") { report.extractionCapable += 1; familyReport.extractionCapable += 1; versionReport.extractionCapable += 1; }
      else { report.blocked += 1; familyReport.blocked += 1; versionReport.blocked += 1; for (const reason of capability.reasons) { const blocker = blockingReasons.get(reason) ?? { count: 0, files: new Set<string>(), families: new Set<string>() }; blocker.count += 1; blocker.files.add(relative); blocker.families.add(family); blockingReasons.set(reason, blocker); } }
    }
  }
  return { ...report, families: Object.fromEntries([...families].sort(([left], [right]) => left.localeCompare(right))), versions: Object.fromEntries([...versions].sort(([left], [right]) => left.localeCompare(right))), blockingReasons: Object.fromEntries([...blockingReasons].sort(([left], [right]) => left.localeCompare(right)).map(([reason, value]) => [reason, { count: value.count, affectedFiles: [...value.files].sort(), affectedFamilies: [...value.families].sort() }])) };
}

test("audits every BMW master-library XDF through the generic structural and extraction-readiness contracts", () => {
  const serializable = auditMasterLibrary();
  assert.deepEqual(auditMasterLibrary(), serializable);
  console.log(`BMW_MASTER_XDF_COVERAGE ${JSON.stringify(serializable)}`);
  assert.equal(serializable.discovered, 99);
  assert.equal(serializable.structurallyReadable, 99);
  assert.ok(serializable.definitions > 0);
  for (const family of ["N54", "B58gen1", "B58gen2", "F series N55 S55 N13", "s58", "S63"]) assert.ok(family in serializable.families, family);
});
