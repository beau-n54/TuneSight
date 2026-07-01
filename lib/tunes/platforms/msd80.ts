import type { ParsedTuneFile } from "../types";

export function enrichMsd80TuneProfile(
  parsed: ParsedTuneFile
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  notes.push("MSD80 platform handler applied.");
  notes.push("Platform family: Siemens MSD80, commonly used on BMW N54 applications.");
  notes.push("Future MSD80 tasks: checksum family detection, map region scan, XDF table matching.");

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      softwareVersion: parsed.detectedRom ?? undefined,
    },
  };
}