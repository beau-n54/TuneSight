import type { ParsedTuneFile } from "../types";

export function enrichMsd81TuneProfile(
  parsed: ParsedTuneFile
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  notes.push("MSD81 platform handler applied.");
  notes.push("Platform family: Siemens MSD81, commonly used on later BMW N54 applications.");
  notes.push("Future MSD81 tasks: ROM family separation, checksum family detection, XDF table matching.");

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      softwareVersion: parsed.detectedRom ?? undefined,
    },
  };
}