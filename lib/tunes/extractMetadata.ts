import type { ParsedTuneFile } from "./types";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

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

function findCalibrationId(
  printableStrings: string[],
  detectedRom: string | null
): string | undefined {
  const romUpper = detectedRom?.toUpperCase() ?? null;

  const candidates = unique(
    printableStrings.flatMap((value) => {
      const upper = value.toUpperCase();

      return (
        upper.match(
          /\b(?:[A-Z]{1,4}[0-9]{5,12}|[0-9]{8,14}[A-Z]{0,3})\b/g
        ) ?? []
      );
    })
  );

  return candidates.find((candidate) => {
    if (candidate === romUpper) {
      return false;
    }

    if (/^0+$/.test(candidate)) {
      return false;
    }

    return true;
  });
}

export function extractTuneMetadata(
  parsed: ParsedTuneFile
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  const detectedVin =
    parsed.metadata.vin ??
    findVin(parsed.printableStrings);

  const detectedCalibrationId =
    parsed.metadata.calibrationId ??
    findCalibrationId(
      parsed.printableStrings,
      parsed.detectedRom
    );

  const softwareVersion =
    parsed.metadata.softwareVersion ??
    parsed.detectedRom ??
    undefined;

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