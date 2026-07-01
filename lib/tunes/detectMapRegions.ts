import type { ParsedTuneFile } from "./types";

export function detectMapRegions(
  parsed: ParsedTuneFile
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  const suspectedRegions: {
    type: string;
    startOffset: number;
    endOffset: number;
  }[] = [];

  if (parsed.detectedPlatform === "MSD80") {
    suspectedRegions.push({
      type: "Boost Control Region",
      startOffset: 0x68000,
      endOffset: 0x72000,
    });

    suspectedRegions.push({
      type: "Ignition Timing Region",
      startOffset: 0x72000,
      endOffset: 0x7F000,
    });

    suspectedRegions.push({
      type: "Fuel/Lambda Region",
      startOffset: 0x80000,
      endOffset: 0x8D000,
    });

    notes.push(
      "Initial MSD80 map-region heuristics applied."
    );

    notes.push(
      "Suspected boost, ignition, and fueling calibration regions identified."
    );
  }

  if (parsed.detectedPlatform === "MSD81") {
    suspectedRegions.push({
      type: "Torque/Load Region",
      startOffset: 0x70000,
      endOffset: 0x7D000,
    });

    notes.push(
      "Initial MSD81 map-region heuristics applied."
    );
  }

  if (suspectedRegions.length === 0) {
    notes.push(
      "No known map-region heuristics available for detected platform."
    );
  }

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      suspectedMapRegions: suspectedRegions,
    },
  };
}