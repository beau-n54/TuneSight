export type BinaryChangedRegion = {
  startOffset: number;
  endOffset: number;
  changedBytes: number;
  density: number;
};

export type BinaryDifferenceSummary = {
  totalChangedBytes: number;
  changedRegionCount: number;
  changedRegions: BinaryChangedRegion[];
  notes: string[];
};

export function detectBinaryDifferences(
  modifiedBuffer: Buffer,
  referenceBuffer: Buffer
): BinaryDifferenceSummary {
  const chunkSize = 4096;

  const changedRegions: BinaryChangedRegion[] = [];

  const length = Math.min(
    modifiedBuffer.length,
    referenceBuffer.length
  );

  let totalChangedBytes = 0;

  for (let offset = 0; offset < length; offset += chunkSize) {
    const endOffset = Math.min(offset + chunkSize, length);

    let changedBytes = 0;

    for (let i = offset; i < endOffset; i++) {
      if (modifiedBuffer[i] !== referenceBuffer[i]) {
        changedBytes++;
      }
    }

    if (changedBytes > 0) {
      const density = Number(
        (changedBytes / (endOffset - offset)).toFixed(4)
      );

      changedRegions.push({
        startOffset: offset,
        endOffset,
        changedBytes,
        density,
      });

      totalChangedBytes += changedBytes;
    }
  }

  const notes: string[] = [];

  notes.push(
    `Binary diff complete. ${totalChangedBytes} changed bytes detected.`
  );

  notes.push(
    `${changedRegions.length} changed 4KB regions detected.`
  );

  if (changedRegions.length > 0) {
    const highestDensityRegion = [...changedRegions].sort(
      (a, b) => b.density - a.density
    )[0];

    notes.push(
      `Highest change density near 0x${highestDensityRegion.startOffset
        .toString(16)
        .toUpperCase()}.`
    );
  }

  return {
    totalChangedBytes,
    changedRegionCount: changedRegions.length,
    changedRegions,
    notes,
  };
}