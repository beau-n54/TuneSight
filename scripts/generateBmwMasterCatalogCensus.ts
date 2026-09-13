import fs from "node:fs";
import path from "node:path";
import { buildBmwMasterCatalogCensus } from "../lib/calibration-workshop/bmwMasterCatalogCensus.ts";

const census = buildBmwMasterCatalogCensus(path.resolve("BMW-XDFs-master"));
const output = path.resolve("engineering/calibration/bmw-master-99-xdf-census.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(census, null, 2)}\n`);
const lines = ["# BMW Master 99-XDF Catalog & Current VIEW Census", "", `Contract: \`${census.contractVersion}\``, "", "## Totals", "", ...Object.entries(census.totals).map(([key, value]) => `- ${key}: ${value}`), "", "## Family breakdown", "", "| Family | Cataloged | VIEW qualified | Definitions |", "| --- | ---: | ---: | ---: |", ...Object.entries(census.familyBreakdown).map(([family, value]) => `| ${family} | ${value.cataloged} | ${value.viewQualified} | ${value.definitions} |`), "", "## Complete census", "", "| XDF | Definitions | Extracted | Converted | Quarantine | Conflicts | Cohort | Blocker |", "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |", ...census.rows.map((row) => `| ${row.relativePath} | ${row.definitionCount} | ${row.extractionCapableCount} | ${row.conversionCount + row.identityNoOpCount} | ${row.quarantineCount} | ${row.conflictCount} | ${row.cohort} | ${row.blockers.join(" ").replaceAll("|", "\\|") || "—"} |`), ""];
fs.writeFileSync(path.resolve("engineering/calibration/bmw-master-99-xdf-census.md"), lines.join("\n"));
console.log(JSON.stringify(census.totals));
