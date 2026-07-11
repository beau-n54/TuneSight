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
        "Detected Siemens MSD80 checksum family."
      );
      notes.push(
        "Checksum validation is not yet implemented for the MSD80 sector layout."
      );
      break;

    case "MSD81":
      checksumFamily = "Siemens MSD81";
      notes.push(
        "Detected Siemens MSD81 checksum family."
      );
      notes.push(
        "Checksum validation is not yet implemented for the MSD81 sector layout."
      );
      break;

    case "MG1":
      checksumFamily = "Bosch MG1";
      notes.push(
        "Detected Bosch MG1 checksum family."
      );
      notes.push(
        "Checksum validation is pending platform-specific MG1 verification logic."
      );
      break;

    case "MG1CS201":
      checksumFamily = "Bosch MG1CS201";
      notes.push(
        "Detected Bosch MG1CS201 checksum family."
      );
      notes.push(
        "Checksum validation is pending MG1CS201 verification logic."
      );
      break;

    case "MEVD17":
      checksumFamily = "Bosch MEVD17";
      notes.push(
        "Detected Bosch MEVD17 checksum family."
      );
      notes.push(
        "Checksum validation is pending MEVD17 verification logic."
      );
      break;

    case "S58":
      checksumFamily = "BMW S58 MG1";
      notes.push(
        "Detected BMW S58 MG1 checksum family."
      );
      notes.push(
        "Checksum validation is pending S58-specific verification logic."
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
      checksumFamily,
      checksumVerificationStatus: "pending",
      calibrationVerificationStatus:
        parsed.metadata.calibrationVerificationStatus ??
        "pending",
      exactBinaryMatchStatus:
        parsed.metadata.exactBinaryMatchStatus ??
        "pending",
    },
  };
}