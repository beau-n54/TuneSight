export type XdfTableCategory =
  | "boost"
  | "fueling"
  | "timing"
  | "torque"
  | "load"
  | "wgdc"
  | "railPressure"
  | "vanos"
  | "safety"
  | "unknown";

export type ParsedXdfTable = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  rows?: number;
  columns?: number;
  units?: string;
  category: XdfTableCategory;
  confidence: number;
  raw?: unknown;
};

export type XdfParseResult = {
  tables: ParsedXdfTable[];
  tableCount: number;
  categories: Record<XdfTableCategory, number>;
};