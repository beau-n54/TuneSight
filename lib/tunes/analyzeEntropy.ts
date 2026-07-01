import type { ParsedTuneFile } from "./types";

function calculateEntropy(bytes: Uint8Array): number {
  const frequency = new Array(256).fill(0);

  for (const byte of bytes) {
    frequency[byte]++;
  }

  let entropy = 0;

  for (const count of frequency) {
    if (count === 0) continue;

    const probability = count / bytes.length;

    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

export function analyzeEntropy(
  parsed: ParsedTuneFile,
  buffer: Buffer
): ParsedTuneFile {
  const notes = [...parsed.parserNotes];

  const chunkSize = 4096;

  let totalEntropy = 0;
  let chunkCount = 0;

  let lowestEntropy = Infinity;
  let highestEntropy = -Infinity;

  let lowestEntropyOffset: number | null = null;
  let highestEntropyOffset: number | null = null;

  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const slice = buffer.subarray(offset, offset + chunkSize);

    if (slice.length < 256) continue;

    const entropy = calculateEntropy(slice);

    totalEntropy += entropy;
    chunkCount++;

    if (entropy < lowestEntropy) {
      lowestEntropy = entropy;
      lowestEntropyOffset = offset;
    }

    if (entropy > highestEntropy) {
      highestEntropy = entropy;
      highestEntropyOffset = offset;
    }
  }

  const averageEntropy =
    chunkCount > 0
      ? Number((totalEntropy / chunkCount).toFixed(3))
      : 0;

  notes.push(
    `Binary entropy scan complete. Average entropy: ${averageEntropy}`
  );

  if (lowestEntropyOffset !== null) {
    notes.push(
      `Lowest entropy region detected near 0x${lowestEntropyOffset.toString(16).toUpperCase()}`
    );
  }

  if (highestEntropyOffset !== null) {
    notes.push(
      `Highest entropy region detected near 0x${highestEntropyOffset.toString(16).toUpperCase()}`
    );
  }

  return {
    ...parsed,
    parserNotes: notes,
    metadata: {
      ...parsed.metadata,
      entropyAnalysis: {
        averageEntropy,
        lowestEntropyOffset,
        highestEntropyOffset,
        notes: [
          "Low entropy regions may indicate structured calibration tables.",
          "High entropy regions may indicate compressed or executable code sections.",
        ],
      },
    },
  };
}