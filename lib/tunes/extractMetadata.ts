import type { ParsedTuneFile } from "./types";

function findVin(printableStrings: string[]): string | undefined {
  for (const value of printableStrings) {
    const match = value
      .toUpperCase()
      .match(/\b[A-HJ-NPR-Z0-9]{17}\b/);

    if (match?.[0]) {
      return match[0];
    }
  }

  return undefined;
}

export function extractTuneMetadata(
  parsed: ParsedTuneFile
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  const detectedVin =
    parsed.metadata.vin ??
    findVin(parsed.printableStrings);

  const detectedCalibrationId =
    parsed.metadata.calibrationId;

  const softwareVersion =
    parsed.metadata.softwareVersion;

  const romId =
    parsed.metadata.romId ??
    parsed.detectedRom ??
    undefined;

  if (detectedVin) {
    notes.push(
      `VIN-like metadata detected: ${detectedVin}.`
    );
  } else {
    notes.push(
      "No reliable VIN metadata was detected."
    );
  }

  if (detectedCalibrationId) {
    notes.push(
      `Calibration identifier candidate detected: ${detectedCalibrationId}.`
    );
  } else {
    notes.push(
      "No reliable calibration identifier was detected."
    );
  }

  if (softwareVersion) {
    notes.push(
      `Software version metadata detected: ${softwareVersion}.`
    );
  }

  if (romId) {
    notes.push(
      `ROM identifier detected: ${romId}.`
    );
  }

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      ...(detectedVin
        ? { vin: detectedVin }
        : {}),
      ...(detectedCalibrationId
        ? { calibrationId: detectedCalibrationId }
        : {}),
      ...(softwareVersion
        ? { softwareVersion }
        : {}),
      ...(romId
        ? { romId }
        : {}),
    },
  };
}
