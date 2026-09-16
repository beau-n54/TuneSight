import { buildCalibrationEditCensus } from "./editAuthorityCensus.ts";

export function buildBmwEngineeringNavigationCensus() {
  const capability = buildCalibrationEditCensus(), families = [...new Set(capability.rows.map(row => row.family))].sort().map(family => { const rows = capability.rows.filter(row => row.family === family), tables = rows.reduce((sum, row) => sum + row.tables, 0); return Object.freeze({ family, relationships: rows.length, tables, ENGINEERING_QUALIFIED: 0, SOURCE_DERIVED_CANDIDATE: 0, UNCLASSIFIED: tables, essentials: 0 }); });
  return Object.freeze({ contractVersion: "tunesight.calibration-engineering-navigation-census.v1", relationships: capability.relationships, tables: capability.tables, ENGINEERING_QUALIFIED: 0, SOURCE_DERIVED_CANDIDATE: 0, UNCLASSIFIED: capability.tables, essentials: 0, duplicateSystemMemberships: 0, systems: Object.freeze([]), families: Object.freeze(families), limitation: "No published runtime Calibration Knowledge records are currently injected into the 68 active Workshop relationships; source titles were not promoted to engineering authority." });
}
