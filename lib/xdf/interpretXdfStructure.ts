import {
  defineXdfDefinitionRevision,
  defineXdfSourceArtifact,
  deriveDefinitionIdentity,
  type XdfAxisDefinition,
  type XdfDefinitionRevision,
  type XdfEmbeddedData,
  type XdfSourceArtifact,
} from "./canonicalXdfDefinition.ts";

export const XDF_STRUCTURAL_LIMITS = Object.freeze({
  maximumInputBytes: 4 * 1024 * 1024,
  maximumDepth: 64,
  maximumNodes: 100_000,
  maximumTables: 10_000,
  maximumAxesPerTable: 8,
  maximumAttributesPerElement: 64,
  maximumMetadataLength: 16_384,
  maximumEquationLength: 4_096,
});

type XmlNode = { name: string; attributes: Record<string, string>; children: XmlNode[]; text: string };
export type XdfStructuralFinding = Readonly<{ code: string; path: string; message: string }>;
export type XdfStructuralInterpretation = Readonly<{
  outcome: "structurally_interpreted" | "unsupported" | "invalid";
  sourceArtifact: XdfSourceArtifact | null;
  definitions: readonly XdfDefinitionRevision[];
  findings: readonly XdfStructuralFinding[];
}>;

class XdfXmlError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    const codePoint = entity.startsWith("#x") ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      throw new XdfXmlError("invalid_entity", "XML numeric entity is invalid.");
    }
    return String.fromCodePoint(codePoint);
  }).replace(/&[^;\s]{1,64};/g, () => { throw new XdfXmlError("unsupported_entity", "Only predefined and numeric XML entities are supported."); });
}

function parseStartTag(source: string): { name: string; attributes: Record<string, string>; selfClosing: boolean } {
  let cursor = 0;
  const whitespace = () => { while (/\s/.test(source[cursor] ?? "")) cursor += 1; };
  whitespace();
  const nameMatch = /^[A-Za-z_][\w:.-]*/.exec(source.slice(cursor));
  if (!nameMatch) throw new XdfXmlError("malformed_tag", "XML element name is malformed.");
  const name = nameMatch[0].toUpperCase(); cursor += nameMatch[0].length;
  const attributes: Record<string, string> = {};
  let selfClosing = false;
  while (cursor < source.length) {
    whitespace();
    if (source[cursor] === "/") { selfClosing = true; cursor += 1; whitespace(); if (cursor !== source.length) throw new XdfXmlError("malformed_tag", "Unexpected content follows the self-closing marker."); break; }
    if (cursor >= source.length) break;
    const attributeMatch = /^[A-Za-z_][\w:.-]*/.exec(source.slice(cursor));
    if (!attributeMatch) throw new XdfXmlError("malformed_attribute", "XML attribute name is malformed.");
    const attributeName = attributeMatch[0].toLowerCase(); cursor += attributeMatch[0].length; whitespace();
    if (source[cursor] !== "=") throw new XdfXmlError("malformed_attribute", "XML attribute requires an equals sign.");
    cursor += 1; whitespace();
    const quote = source[cursor];
    if (quote !== '"' && quote !== "'") throw new XdfXmlError("malformed_attribute", "XML attribute value must be quoted.");
    const end = source.indexOf(quote, cursor + 1);
    if (end < 0) throw new XdfXmlError("malformed_attribute", "XML attribute quote is unterminated.");
    if (Object.hasOwn(attributes, attributeName)) throw new XdfXmlError("duplicate_attribute", `XML attribute ${attributeName} is duplicated.`);
    if (Object.keys(attributes).length >= XDF_STRUCTURAL_LIMITS.maximumAttributesPerElement) throw new XdfXmlError("attribute_limit", "XML element exceeds the attribute limit.");
    attributes[attributeName] = decodeEntities(source.slice(cursor + 1, end)); cursor = end + 1;
  }
  return { name, attributes, selfClosing };
}

function parseXml(xml: string): XmlNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new XdfXmlError("external_entity_forbidden", "DOCTYPE and entity declarations are forbidden.");
  const document: XmlNode = { name: "$DOCUMENT", attributes: {}, children: [], text: "" };
  const stack = [document]; let cursor = 0; let nodeCount = 0;
  while (cursor < xml.length) {
    const open = xml.indexOf("<", cursor);
    if (open < 0) { stack.at(-1)!.text += decodeEntities(xml.slice(cursor)); break; }
    stack.at(-1)!.text += decodeEntities(xml.slice(cursor, open));
    if (xml.startsWith("<!--", open)) { const end = xml.indexOf("-->", open + 4); if (end < 0) throw new XdfXmlError("malformed_comment", "XML comment is unterminated."); cursor = end + 3; continue; }
    if (xml.startsWith("<?", open)) { const end = xml.indexOf("?>", open + 2); if (end < 0) throw new XdfXmlError("malformed_declaration", "XML declaration is unterminated."); cursor = end + 2; continue; }
    if (xml.startsWith("<![CDATA[", open)) { const end = xml.indexOf("]]>", open + 9); if (end < 0) throw new XdfXmlError("malformed_cdata", "CDATA is unterminated."); stack.at(-1)!.text += xml.slice(open + 9, end); cursor = end + 3; continue; }
    let close = -1; let quote: string | null = null;
    for (let index = open + 1; index < xml.length; index += 1) {
      const value = xml[index];
      if (quote !== null) { if (value === quote) quote = null; continue; }
      if (value === '"' || value === "'") { quote = value; continue; }
      if (value === ">") { close = index; break; }
    }
    if (close < 0) throw new XdfXmlError("malformed_tag", "XML tag is unterminated.");
    const body = xml.slice(open + 1, close);
    if (body.startsWith("/")) {
      const closingName = body.slice(1).trim().toUpperCase();
      if (stack.length === 1 || stack.at(-1)!.name !== closingName) throw new XdfXmlError("mismatched_tag", `Unexpected closing element ${closingName}.`);
      stack.pop(); cursor = close + 1; continue;
    }
    if (body.startsWith("!")) throw new XdfXmlError("unsupported_declaration", "Unsupported XML declaration encountered.");
    const parsed = parseStartTag(body); const node: XmlNode = { name: parsed.name, attributes: parsed.attributes, children: [], text: "" };
    stack.at(-1)!.children.push(node); nodeCount += 1;
    if (nodeCount > XDF_STRUCTURAL_LIMITS.maximumNodes) throw new XdfXmlError("node_limit", "XDF exceeds the XML node limit.");
    if (!parsed.selfClosing) { stack.push(node); if (stack.length > XDF_STRUCTURAL_LIMITS.maximumDepth) throw new XdfXmlError("depth_limit", "XDF exceeds the XML depth limit."); }
    cursor = close + 1;
  }
  if (stack.length !== 1) throw new XdfXmlError("unclosed_tag", `XML element ${stack.at(-1)!.name} is unclosed.`);
  if (document.children.length !== 1) throw new XdfXmlError("document_root", "XDF requires exactly one XML root element.");
  return document.children[0];
}

const children = (node: XmlNode, name: string) => node.children.filter((child) => child.name === name);
const child = (node: XmlNode, name: string) => children(node, name)[0] ?? null;
const SUPPORTED_ELEMENTS = new Set(["XDFFORMAT", "XDFHEADER", "BASEOFFSET", "REGION", "DEFAULTS", "XDFTABLE", "TITLE", "DESCRIPTION", "XDFAXIS", "EMBEDDEDDATA", "INDEXCOUNT", "DATATYPE", "UNITS", "MATH", "VAR"]);
function unsupportedElements(root: XmlNode): string[] {
  const names = new Set<string>();
  const visit = (node: XmlNode) => { if (!SUPPORTED_ELEMENTS.has(node.name)) names.add(node.name); node.children.forEach(visit); };
  visit(root);
  return [...names].sort();
}
function text(node: XmlNode | null, maximum = XDF_STRUCTURAL_LIMITS.maximumMetadataLength): string | null {
  if (!node) return null;
  const value = node.text.trim();
  if (value.length > maximum) throw new XdfXmlError("text_limit", `XDF text exceeds ${maximum} characters.`);
  return value || null;
}
function integer(value: string | null | undefined, field: string, allowNegative = false): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!/^-?(?:0x[0-9a-f]+|\d+)$/i.test(value)) throw new XdfXmlError("invalid_number", `${field} is not an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (!allowNegative && parsed < 0)) throw new XdfXmlError("invalid_number", `${field} is outside the supported range.`);
  return parsed;
}
function embedded(axis: XmlNode): XdfEmbeddedData {
  const node = child(axis, "EMBEDDEDDATA"); const a = node?.attributes ?? {};
  const source = a.mmedaddress ?? a.address ?? null;
  return Object.freeze({
    address: integer(source, "Embedded-data address"), addressSource: source,
    elementSizeBits: integer(a.mmedelementsizebits, "Element size"),
    rowCount: integer(a.mmedrowcount, "Row count"), columnCount: integer(a.mmedcolcount, "Column count"),
    majorStrideBits: integer(a.mmedmajorstridebits, "Major stride", true), minorStrideBits: integer(a.mmedminorstridebits, "Minor stride", true),
    typeFlags: a.mmedtypeflags ?? null,
  });
}
function axis(node: XmlNode): XdfAxisDefinition {
  const math = child(node, "MATH"); const equation = math?.attributes.equation ?? null;
  if (equation !== null && equation.length > XDF_STRUCTURAL_LIMITS.maximumEquationLength) throw new XdfXmlError("equation_limit", "XDF equation exceeds the inert-source limit.");
  return Object.freeze({
    axisId: node.attributes.id ?? "unidentified", indexCount: integer(text(child(node, "INDEXCOUNT")), "Axis index count"),
    dataType: text(child(node, "DATATYPE")), units: text(child(node, "UNITS")), embeddedData: embedded(node),
    equationSource: equation, equationVariables: Object.freeze(math ? children(math, "VAR").map((value) => value.attributes.id ?? "unidentified") : []),
  });
}

export function interpretXdfStructure(input: { xml: string; filename?: string | null; provenance: string; sourceRevision?: string | null }): XdfStructuralInterpretation {
  const bytes = new TextEncoder().encode(input.xml);
  if (bytes.byteLength > XDF_STRUCTURAL_LIMITS.maximumInputBytes) return Object.freeze({ outcome: "unsupported", sourceArtifact: null, definitions: [], findings: [{ code: "input_size_limit", path: "$", message: "XDF exceeds the supported input-size limit." }] });
  try {
    const root = parseXml(input.xml);
    if (root.name !== "XDFFORMAT") throw new XdfXmlError("unsupported_root", "The XML root is not XDFFORMAT.");
    const version = root.attributes.version ?? null;
    if (version !== "1.60" && version !== "1.70" && version !== "1.80") {
      return Object.freeze({ outcome: "unsupported", sourceArtifact: defineXdfSourceArtifact({ bytes, observedVersion: version, filename: input.filename, provenance: input.provenance, sourceRevision: input.sourceRevision }), definitions: [], findings: [{ code: "unsupported_version", path: "/XDFFORMAT/@version", message: `XDF version ${version ?? "absent"} is unsupported.` }] });
    }
    const sourceArtifact = defineXdfSourceArtifact({ bytes, observedVersion: version, filename: input.filename, provenance: input.provenance, sourceRevision: input.sourceRevision });
    const header = child(root, "XDFHEADER") ?? root;
    const defaults = child(header, "DEFAULTS");
    const lsbFirstSource = defaults?.attributes.lsbfirst ?? null;
    if (lsbFirstSource !== null && lsbFirstSource !== "0" && lsbFirstSource !== "1") throw new XdfXmlError("invalid_byte_order", "DEFAULTS lsbfirst must be 0 or 1 when present.");
    const byteOrderMetadata = Object.freeze({ lsbFirst: lsbFirstSource === null ? null : lsbFirstSource === "1", source: lsbFirstSource });
    const signedSource = defaults?.attributes.signed ?? null;
    if (signedSource !== null && signedSource !== "0" && signedSource !== "1") throw new XdfXmlError("invalid_signedness", "DEFAULTS signed must be 0 or 1 when present.");
    const defaultDataLayout = Object.freeze({ elementSizeBits: integer(defaults?.attributes.datasizeinbits, "Default element size"), signed: signedSource === null ? null : signedSource === "1" });
    const base = child(header, "BASEOFFSET");
    const subtractSource = base?.attributes.subtract ?? null;
    if (subtractSource !== null && subtractSource !== "0" && subtractSource !== "1") throw new XdfXmlError("invalid_base_offset", "BASEOFFSET subtract must be 0 or 1 when present.");
    const regions = children(header, "REGION").map((region) => Object.freeze({ startAddress: integer(region.attributes.startaddress, "Region start address") ?? 0, size: integer(region.attributes.size, "Region size") ?? 0, name: region.attributes.name ?? null }));
    const addressSpace = Object.freeze({ baseOffset: integer(base?.attributes.offset, "Base offset"), subtractBaseOffset: subtractSource === null ? null : subtractSource === "1", regions: Object.freeze(regions) });
    const tableNodes = children(root, "XDFTABLE");
    if (tableNodes.length === 0) throw new XdfXmlError("missing_tables", "XDF contains no XDFTABLE definitions.");
    if (tableNodes.length > XDF_STRUCTURAL_LIMITS.maximumTables) return Object.freeze({ outcome: "unsupported", sourceArtifact, definitions: [], findings: [{ code: "table_limit", path: "/XDFFORMAT", message: "XDF exceeds the supported table limit." }] });
    const drafts = tableNodes.map((table) => {
      const axes = children(table, "XDFAXIS");
      if (axes.length === 0) throw new XdfXmlError("missing_axes", "XDFTABLE contains no XDFAXIS structure.");
      if (axes.length > XDF_STRUCTURAL_LIMITS.maximumAxesPerTable) throw new XdfXmlError("axis_limit", "XDFTABLE exceeds the supported axis limit.");
      const parsedAxes = axes.map(axis); const valueAxis = parsedAxes.find((value) => value.axisId.toLowerCase() === "z") ?? parsedAxes.at(-1) ?? null;
      const primaryAddress = valueAxis?.embeddedData.address ?? parsedAxes.find((value) => value.embeddedData.address !== null)?.embeddedData.address ?? null;
      const key = primaryAddress === null ? null : `${primaryAddress}\0${parsedAxes.map((value) => value.axisId).sort().join("\0")}`;
      return { table, axes: parsedAxes, primaryAddress, key };
    });
    const counts = new Map<string, number>(); for (const draft of drafts) if (draft.key) counts.set(draft.key, (counts.get(draft.key) ?? 0) + 1);
    const findings: XdfStructuralFinding[] = unsupportedElements(root).map((name) => ({ code: "unsupported_construct", path: `//${name}`, message: `${name} is preserved only as an explicitly unsupported XDF construct in this slice.` }));
    const definitions = drafts.map((draft, index) => {
      const identity = deriveDefinitionIdentity({ definitionKind: "table", primaryAddress: draft.primaryAddress, axisRoles: draft.axes.map((value) => value.axisId), conflict: draft.key !== null && (counts.get(draft.key) ?? 0) > 1 });
      if (identity.status !== "derived") findings.push({ code: `definition_identity_${identity.status}`, path: `/XDFFORMAT/XDFTABLE[${index + 1}]`, message: identity.unresolvedReason ?? "Definition identity is unresolved." });
      return defineXdfDefinitionRevision({ identity, sourceArtifactDigest: sourceArtifact.sourceDigest, definitionKind: "table", title: text(child(draft.table, "TITLE")), description: text(child(draft.table, "DESCRIPTION")), primaryAddress: draft.primaryAddress, addressSpace, defaultDataLayout, byteOrderMetadata, axes: draft.axes, qualificationState: "applicability_unresolved" });
    });
    return Object.freeze({ outcome: "structurally_interpreted", sourceArtifact: Object.freeze({ ...sourceArtifact, qualificationState: "structurally_interpreted" as const }), definitions: Object.freeze(definitions), findings: Object.freeze(findings) });
  } catch (error) {
    const parsed = error instanceof XdfXmlError ? error : new XdfXmlError("invalid_xml", error instanceof Error ? error.message : "XDF parsing failed.");
    return Object.freeze({ outcome: "invalid", sourceArtifact: null, definitions: [], findings: [{ code: parsed.code, path: "$", message: parsed.message }] });
  }
}
