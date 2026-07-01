import type { ParsedTuneFile } from "./types";

export function compareBinaryRegions(
  parsed: ParsedTuneFile,
  currentBuffer: Buffer,
  referenceBuffer: Buffer
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  const changedRegions: {
    startOffset: number;
    endOffset: number;
    changedBytes: number;
  }[] = [];

  const chunkSize = 4096;

  let totalChangedBytes = 0;

  const length = Math.min(
    currentBuffer.length,
    referenceBuffer.length
  );

  for (let offset = 0; offset < length; offset += chunkSize) {
    let changedBytes = 0;

    const end = Math.min(offset + chunkSize, length);

    for (let i = offset; i < end; i++) {
      if (currentBuffer[i] !== referenceBuffer[i]) {
        changedBytes++;
      }
    }

    if (changedBytes > 0) {
      changedRegions.push({
        startOffset: offset,
        endOffset: end,
        changedBytes,
      });

      totalChangedBytes += changedBytes;
    }
  }

  notes.push(
    `Binary comparison complete. ${totalChangedBytes} changed bytes detected.`
  );

  if (changedRegions.length > 0) {
    notes.push(
      `${changedRegions.length} modified binary regions identified.`
    );
  } else {
    notes.push(
      "No binary differences detected against reference file."
    );
  }

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      binaryComparison: {
        changedRegions,
        totalChangedBytes,
        comparisonNotes: [
          "Changed regions may indicate modified calibration tables.",
          "Large clustered changes often indicate tuning activity.",
        ],
      },
    },
  };
} 