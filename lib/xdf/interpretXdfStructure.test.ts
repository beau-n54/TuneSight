import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { interpretXdfStructure, XDF_STRUCTURAL_LIMITS } from "./interpretXdfStructure.ts";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture = (relative: string) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");

const table = (title: string, address: string, equation = "X*2") => `
  <XDFTABLE>
    <title>${title}</title>
    <description>Structural fixture</description>
    <XDFAXIS id="x"><EMBEDDEDDATA/><indexcount>2</indexcount><units>rpm</units></XDFAXIS>
    <XDFAXIS id="z"><EMBEDDEDDATA mmedaddress="${address}" mmedelementsizebits="16" mmedrowcount="1" mmedcolcount="2" mmedmajorstridebits="0" mmedminorstridebits="0"/><indexcount>2</indexcount><datatype>0</datatype><units>hPa</units><MATH equation="${equation}"><VAR id="X"/></MATH></XDFAXIS>
  </XDFTABLE>`;
const document = (tables: string, version = "1.60") => `<?xml version="1.0"?><XDFFORMAT version="${version}"><XDFHEADER><DEFAULTS lsbfirst="0"/></XDFHEADER>${tables}</XDFFORMAT>`;

test("deterministically interprets real N54 and B58 XDF structure", () => {
  for (const relative of ["BMW-XDFs-master/N54/IJE0S.xdf", "BMW-XDFs-master/B58gen1/00003076501103.xdf"]) {
    const xml = fixture(relative);
    const first = interpretXdfStructure({ xml, filename: path.basename(relative), provenance: "bundled repository fixture" });
    const repeated = interpretXdfStructure({ xml, filename: path.basename(relative), provenance: "bundled repository fixture" });
    assert.equal(first.outcome, "structurally_interpreted", relative);
    assert.ok(first.definitions.length > 1, relative);
    assert.deepEqual(first, repeated, relative);
    assert.ok(first.definitions.some((definition) => definition.primaryAddress !== null), relative);
    assert.ok(first.definitions.some((definition) => definition.axes.some((axis) => axis.units !== null)), relative);
    assert.ok(first.definitions.some((definition) => definition.axes.some((axis) => axis.equationSource !== null)), relative);
    assert.equal(first.definitions[0].byteOrderMetadata.source, "0", relative);
    assert.ok(first.findings.some((finding) => finding.code === "unsupported_construct"), relative);
  }
});

test("discovers multiple tables and preserves structural fields without executing equations", () => {
  globalThis.__xdfEquationExecuted = false;
  const equation = "globalThis.__xdfEquationExecuted=true";
  const result = interpretXdfStructure({ xml: document(table("First", "0x100", equation) + table("Second", "0x200")), provenance: "synthetic fixture" });
  assert.equal(result.outcome, "structurally_interpreted");
  assert.equal(result.definitions.length, 2);
  assert.equal(result.definitions[0].primaryAddress, 0x100);
  assert.equal(result.definitions[0].axes[1].embeddedData.elementSizeBits, 16);
  assert.equal(result.definitions[0].axes[1].embeddedData.columnCount, 2);
  assert.equal(result.definitions[0].axes[1].units, "hPa");
  assert.deepEqual(result.definitions[0].axes[1].dataTypeMetadata, { kind: "integer", resolution: "explicit", sourceValue: "0" });
  assert.deepEqual(result.definitions[0].byteOrderMetadata, { lsbFirst: false, source: "0" });
  assert.equal(result.definitions[0].axes[1].equationSource, equation);
  assert.equal(globalThis.__xdfEquationExecuted, false);
  delete globalThis.__xdfEquationExecuted;
});

test("stable identity survives unrelated table insertion and reordering", () => {
  const target = table("Target", "0x1234");
  const first = interpretXdfStructure({ xml: document(table("Earlier", "0x50") + target), provenance: "synthetic fixture" });
  const reordered = interpretXdfStructure({ xml: document(target + table("Inserted", "0x60") + table("Earlier", "0x50")), provenance: "synthetic fixture" });
  const targetFirst = first.definitions.find((definition) => definition.title === "Target")!;
  const targetReordered = reordered.definitions.find((definition) => definition.title === "Target")!;
  assert.equal(targetFirst.identity.stableId, targetReordered.identity.stableId);
  assert.equal(targetFirst.structuralDigest, targetReordered.structuralDigest);
});

test("exact structural duplicates are aliases while representation disagreements remain conflicts", () => {
  const result = interpretXdfStructure({ xml: document(table("One", "0x100") + table("Two", "0x100")), provenance: "synthetic fixture" });
  assert.equal(result.outcome, "structurally_interpreted");
  assert.ok(result.definitions.every((definition) => definition.identity.status === "derived"));
  assert.equal(result.definitions[0].identity.stableId, result.definitions[1].identity.stableId);
  assert.equal(result.findings.filter((finding) => finding.code === "definition_identity_alias").length, 2);
  const conflict = interpretXdfStructure({ xml: document(table("One", "0x100", "X*2") + table("Two", "0x100", "X*3")), provenance: "synthetic fixture" });
  assert.ok(conflict.definitions.every((definition) => definition.identity.status === "conflicting"));
});

test("different storage layouts sharing a primary address receive distinct stable identities", () => {
  const first = table("Eight bit", "0x100").replace('mmedelementsizebits="16"', 'mmedelementsizebits="8"');
  const result = interpretXdfStructure({ xml: document(first + table("Sixteen bit", "0x100")), provenance: "synthetic shared storage" });
  assert.ok(result.definitions.every((definition) => definition.identity.status === "derived"));
  assert.notEqual(result.definitions[0].identity.stableId, result.definitions[1].identity.stableId);
});

test("inherits integer datatype from explicit header defaults and preserves provenance", () => {
  const xml = `<?xml version="1.0"?><XDFFORMAT version="1.70"><XDFHEADER><DEFAULTS datasizeinbits="16" signed="0" lsbfirst="1" float="0" outputtype="1"/></XDFHEADER><XDFTABLE><XDFAXIS id="z"><EMBEDDEDDATA mmedaddress="100a" mmedelementsizebits="16"/><MATH equation="X"><VAR id="X"/></MATH></XDFAXIS></XDFTABLE></XDFFORMAT>`;
  const result = interpretXdfStructure({ xml, provenance: "synthetic inherited datatype" });
  assert.equal(result.outcome, "structurally_interpreted");
  assert.equal(result.definitions[0].primaryAddress, 0x100a);
  assert.deepEqual(result.definitions[0].axes[0].dataTypeMetadata, { kind: "integer", resolution: "header_default", sourceValue: "DEFAULTS float=0" });
});

test("preserves genuinely absent datatype semantics as unresolved", () => {
  const xml = `<?xml version="1.0"?><XDFFORMAT version="1.70"><XDFHEADER><DEFAULTS signed="0" lsbfirst="1"/></XDFHEADER><XDFTABLE><XDFAXIS id="z"><EMBEDDEDDATA mmedaddress="0x100" mmedelementsizebits="16"/></XDFAXIS></XDFTABLE></XDFFORMAT>`;
  const result = interpretXdfStructure({ xml, provenance: "synthetic unresolved datatype" });
  assert.deepEqual(result.definitions[0].axes[0].dataTypeMetadata, { kind: "unresolved", resolution: "unresolved", sourceValue: null });
});

test("classifies static literal axes without representing them as binary-backed", () => {
  const xml = `<?xml version="1.0"?><XDFFORMAT version="1.60"><XDFHEADER><DEFAULTS signed="0" lsbfirst="0" float="0"/></XDFHEADER><XDFTABLE><XDFAXIS id="x"><EMBEDDEDDATA/><LABEL index="0" value="10"/><LABEL index="1" value="20"/></XDFAXIS><XDFAXIS id="z"><EMBEDDEDDATA mmedaddress="0x10" mmedelementsizebits="8"/><datatype>0</datatype></XDFAXIS></XDFTABLE></XDFFORMAT>`;
  const result = interpretXdfStructure({ xml, provenance: "synthetic static axis" });
  assert.equal(result.definitions[0].axes[0].representation, "static_literal");
  assert.deepEqual(result.definitions[0].axes[0].literalLabels, [{ index: "0", value: "10" }, { index: "1", value: "20" }]);
});

test("unimplemented XDF elements are reported rather than silently treated as supported", () => {
  const result = interpretXdfStructure({ xml: document(`${table("One", "0x100")}<UNSUPPORTED-FEATURE/>`), provenance: "synthetic fixture" });
  assert.equal(result.outcome, "structurally_interpreted");
  assert.deepEqual(result.findings.filter((finding) => finding.code === "unsupported_construct"), [{ code: "unsupported_construct", path: "//UNSUPPORTED-FEATURE", message: "UNSUPPORTED-FEATURE is preserved only as an explicitly unsupported XDF construct in this slice." }]);
});

test("malformed, missing, unsupported, hostile and out-of-range structures fail explicitly", () => {
  assert.equal(interpretXdfStructure({ xml: "<XDFFORMAT><XDFTABLE></XDFFORMAT>", provenance: "hostile" }).outcome, "invalid");
  assert.equal(interpretXdfStructure({ xml: "<XDFFORMAT version=\"1.60\"/>", provenance: "hostile" }).findings[0].code, "missing_tables");
  assert.equal(interpretXdfStructure({ xml: document(table("Test", "0x100"), "2.00"), provenance: "hostile" }).outcome, "unsupported");
  assert.equal(interpretXdfStructure({ xml: `<!DOCTYPE x [<!ENTITY ext SYSTEM "file:///etc/passwd">]>${document(table("Test", "0x100"))}`, provenance: "hostile" }).findings[0].code, "external_entity_forbidden");
  assert.equal(interpretXdfStructure({ xml: document(table("Test", "-1")), provenance: "hostile" }).findings[0].code, "invalid_number");
  assert.equal(interpretXdfStructure({ xml: document("<XDFTABLE><title>No axes</title></XDFTABLE>"), provenance: "hostile" }).findings[0].code, "missing_axes");
  assert.equal(interpretXdfStructure({ xml: "x".repeat(XDF_STRUCTURAL_LIMITS.maximumInputBytes + 1), provenance: "hostile" }).findings[0].code, "input_size_limit");
});

declare global { var __xdfEquationExecuted: boolean | undefined; }
