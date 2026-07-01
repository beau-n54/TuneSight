import type { ParsedXdfTable, XdfTableCategory } from "./xdfTypes";

export type XdfLinkedTable = {
  tableId: string;
  tableName: string;
  category: XdfTableCategory;
  reason: string;
  confidence: number;
};

const FINDING_TO_CATEGORIES: Record<string, XdfTableCategory[]> = {
  overboost: ["boost", "wgdc", "load", "torque", "safety"],
  underboost: ["boost", "wgdc", "load", "torque"],
  highWgdc: ["wgdc", "boost", "load"],
  railPressureDrop: ["railPressure", "fueling", "safety"],
  lowLpfp: ["fueling", "railPressure", "safety"],
  leanAfr: ["fueling", "safety"],
  timingCorrection: ["timing", "load", "torque", "safety"],
  highIat: ["boost", "timing", "safety"],
  throttleClosure: ["torque", "load", "boost", "safety"],
};

export function crossReferenceXdfTables(
  findingType: string,
  tables: ParsedXdfTable[],
): XdfLinkedTable[] {
  const relatedCategories = FINDING_TO_CATEGORIES[findingType] ?? [];

  if (relatedCategories.length === 0) {
    return [];
  }

  return tables
    .filter((table) => relatedCategories.includes(table.category))
    .map((table) => ({
      tableId: table.id,
      tableName: table.name,
      category: table.category,
      reason: `Matched ${findingType} to ${table.category} table category.`,
      confidence: table.confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}