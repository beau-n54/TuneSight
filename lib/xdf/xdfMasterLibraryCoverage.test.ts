import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assessDefinitionExtractionCapability } from "./calibrationValueExtraction.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";

test("audits every BMW master-library XDF through the generic structural and extraction-readiness contracts", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "BMW-XDFs-master");
  const files: string[] = [];
  const walk = (directory: string) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => { const full = path.join(directory, entry.name); if (entry.isDirectory()) walk(full); else if (entry.name.toLowerCase().endsWith(".xdf")) files.push(full); });
  walk(root); files.sort();
  const report = { discovered: files.length, structurallyReadable: 0, unsupported: 0, invalid: 0, definitions: 0, extractionCapable: 0, blocked: 0, families: new Set<string>(), blockingReasons: new Map<string, number>() };
  for (const file of files) {
    const relative = path.relative(root, file); report.families.add(relative.split(path.sep)[0]);
    const parsed = interpretXdfStructure({ xml: fs.readFileSync(file, "utf8"), filename: path.basename(file), provenance: "BMW master-library coverage audit" });
    if (parsed.outcome === "structurally_interpreted") report.structurallyReadable += 1; else if (parsed.outcome === "unsupported") report.unsupported += 1; else report.invalid += 1;
    report.definitions += parsed.definitions.length;
    for (const definition of parsed.definitions) {
      const capability = assessDefinitionExtractionCapability(definition);
      if (capability.state === "extraction_capable") report.extractionCapable += 1;
      else { report.blocked += 1; for (const reason of capability.reasons) report.blockingReasons.set(reason, (report.blockingReasons.get(reason) ?? 0) + 1); }
    }
  }
  const serializable = { ...report, families: [...report.families].sort(), blockingReasons: [...report.blockingReasons].sort(([left], [right]) => left.localeCompare(right)) };
  console.log(`BMW_MASTER_XDF_COVERAGE ${JSON.stringify(serializable)}`);
  assert.equal(report.discovered, 99);
  assert.ok(report.structurallyReadable > 0);
  assert.ok(report.definitions > 0);
  for (const family of ["N54", "B58gen1", "B58gen2", "F series N55 S55 N13", "s58", "S63"]) assert.ok(report.families.has(family), family);
});
