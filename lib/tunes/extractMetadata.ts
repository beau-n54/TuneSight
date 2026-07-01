import type { ParsedTuneFile } from "./types";

export function extractTuneMetadata(parsed: ParsedTuneFile): ParsedTuneFile {
  const joined = parsed.printableStrings.join(" ");

  const notes = [...parsed.parserNotes];

  const vinMatch = joined.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);

  const calibrationMatch =
    joined.match(/\b[0-9]{7}\b/) ||
    joined.match(/\b[0-9]{6,8}[A-Z]{0,2}\b/);

  const softwareVersion =
    parsed.detectedRom ?? parsed.metadata.softwareVersion;

  if (vinMatch?.[0]) {
    notes.push("Possible VIN-like identifier detected in binary metadata.");
  }

  if (calibrationMatch?.[0]) {
    notes.push("Possible calibration/software identifier detected in binary metadata.");
  }

  if (softwareVersion) {
    notes.push(`Software/ROM metadata assigned: ${softwareVersion}.`);
  }

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      vin: vinMatch?.[0],
      calibrationId: calibrationMatch?.[0],
      softwareVersion,
      romId: parsed.detectedRom ?? parsed.metadata.romId,
    },
  };
}