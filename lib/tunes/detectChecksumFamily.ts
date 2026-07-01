import type { ParsedTuneFile } from "./types";

export function detectChecksumFamily(
  parsed: ParsedTuneFile
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  let checksumFamily = "Unknown";

  switch (parsed.detectedPlatform) {
    case "MSD80":
      checksumFamily = "Siemens MSD80";
      notes.push(
        "Likely Siemens MSD80 checksum structure detected."
      );
      notes.push(
        "Future checksum validation can target MSD80 sector layout."
      );
      break;

    case "MSD81":
      checksumFamily = "Siemens MSD81";
      notes.push(
        "Likely Siemens MSD81 checksum structure detected."
      );
      notes.push(
        "Future checksum validation can target MSD81 sector layout."
      );
      break;

    default:
      notes.push(
        "Checksum family could not yet be determined."
      );
      break;
  }

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      calibrationId:
        parsed.metadata.calibrationId ??
        checksumFamily,
    },
  };
}