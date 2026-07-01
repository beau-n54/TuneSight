import { buildCategoryCounts, categoriseXdfTableName } from "./categoriseXdfTables";
import type { ParsedXdfTable, XdfParseResult } from "./xdfTypes";

function getTagValue(block: string, tagName: string): string | undefined {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1]?.trim();
}

function getAddress(block: string): string | undefined {
  const addressMatch =
    block.match(/<EMBEDDEDDATA[^>]*mmedaddress\s*=\s*"([^"]+)"/i) ||
    block.match(/<EMBEDDEDDATA[^>]*address\s*=\s*"([^"]+)"/i);

  return addressMatch?.[1];
}

export function parseXdf(xml: string): XdfParseResult {
  const tableBlocks = xml.match(/<XDFTABLE[\s\S]*?<\/XDFTABLE>/gi) ?? [];

  const tables: ParsedXdfTable[] = tableBlocks.map((block, index) => {
    const name =
      getTagValue(block, "title") ||
      getTagValue(block, "name") ||
      `Unknown Table ${index + 1}`;

    const description = getTagValue(block, "description");
    const units = getTagValue(block, "units");
    const address = getAddress(block);

    const { category, confidence } = categoriseXdfTableName(name);

    return {
      id: `${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      description,
      address,
      units,
      category,
      confidence,
      raw: {
        hasDescription: Boolean(description),
        hasAddress: Boolean(address),
      },
    };
  });

  return {
    tables,
    tableCount: tables.length,
    categories: buildCategoryCounts(tables.map((table) => table.category)),
  };
}