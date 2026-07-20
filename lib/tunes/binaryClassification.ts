export type BinaryClassification =
  | "unknown"
  | "stock"
  | "modified"
  | "mapswitch";

export type BinaryClassificationResult = {
  classification: BinaryClassification;
  confidence: number;
  exactBinaryMatch: boolean;
  evidence: string[];
  warnings: string[];
};

export type BinaryReferenceMetadata = {
  hash: string | null;
  sizeBytes: number | null;
};

export type BinaryComparisonEvidence = {
  /**
   * Classification of the binary used as the comparison reference.
   *
   * Comparison evidence may only determine Stock or Modified when
   * the reference has already been independently verified as Stock.
   */
  referenceClassification: BinaryClassification;

  totalChangedBytes: number;
  uploadedSizeBytes: number;
  referenceSizeBytes: number;
};

export type ClassifyBinaryInput = {
  uploadedHash: string | null;
  uploadedSizeBytes: number | null;

  stockReference?: BinaryReferenceMetadata | null;
  mapSwitchReference?: BinaryReferenceMetadata | null;

  comparison?: BinaryComparisonEvidence | null;
};

function normaliseHash(
  value: string | null | undefined
): string | null {
  const normalised = value
    ?.trim()
    .toLowerCase();

  return normalised || null;
}

function isExactReferenceMatch(input: {
  uploadedHash: string | null;
  uploadedSizeBytes: number | null;
  reference?: BinaryReferenceMetadata | null;
}): boolean {
  const uploadedHash =
    normaliseHash(input.uploadedHash);

  const referenceHash =
    normaliseHash(input.reference?.hash);

  const referenceSize =
    input.reference?.sizeBytes ?? null;

  if (
    !uploadedHash ||
    !referenceHash ||
    input.uploadedSizeBytes === null ||
    referenceSize === null
  ) {
    return false;
  }

  return (
    uploadedHash === referenceHash &&
    input.uploadedSizeBytes === referenceSize
  );
}

export function classifyBinary(
  input: ClassifyBinaryInput
): BinaryClassificationResult {
  const evidence: string[] = [];
  const warnings: string[] = [];

  const exactMapSwitchMatch =
    isExactReferenceMatch({
      uploadedHash: input.uploadedHash,
      uploadedSizeBytes:
        input.uploadedSizeBytes,
      reference: input.mapSwitchReference,
    });

  if (exactMapSwitchMatch) {
    evidence.push(
      "Uploaded binary exactly matches a verified map-switch library reference."
    );

    return {
      classification: "mapswitch",
      confidence: 0.99,
      exactBinaryMatch: true,
      evidence,
      warnings,
    };
  }

  const exactStockMatch =
    isExactReferenceMatch({
      uploadedHash: input.uploadedHash,
      uploadedSizeBytes:
        input.uploadedSizeBytes,
      reference: input.stockReference,
    });

  if (exactStockMatch) {
    evidence.push(
      "Uploaded binary exactly matches a verified stock library reference."
    );

    return {
      classification: "stock",
      confidence: 0.99,
      exactBinaryMatch: true,
      evidence,
      warnings,
    };
  }

  const comparison =
    input.comparison ?? null;

  if (
    comparison &&
    comparison.referenceClassification ===
      "stock"
  ) {
    const sameLength =
      comparison.uploadedSizeBytes ===
      comparison.referenceSizeBytes;

    if (!sameLength) {
      warnings.push(
        "Uploaded binary and verified stock reference have different file sizes. Modification status cannot be safely inferred from the current comparison."
      );

      return {
        classification: "unknown",
        confidence: 0.35,
        exactBinaryMatch: false,
        evidence,
        warnings,
      };
    }

    if (
      comparison.totalChangedBytes === 0
    ) {
      evidence.push(
        "Uploaded binary is byte-for-byte identical to a verified stock reference."
      );

      return {
        classification: "stock",
        confidence: 0.98,
        exactBinaryMatch: true,
        evidence,
        warnings,
      };
    }

    if (
      comparison.totalChangedBytes > 0
    ) {
      evidence.push(
        `Uploaded binary differs from a verified stock reference by ${comparison.totalChangedBytes} byte(s).`
      );

      return {
        classification: "modified",
        confidence: 0.96,
        exactBinaryMatch: false,
        evidence,
        warnings,
      };
    }
  }

  if (
    comparison &&
    comparison.referenceClassification !==
      "stock"
  ) {
    warnings.push(
      "Binary differences were detected, but the comparison reference has not been independently verified as stock."
    );
  }

  if (
    !input.uploadedHash ||
    input.uploadedSizeBytes === null
  ) {
    warnings.push(
      "Uploaded binary hash or file size is unavailable for exact reference verification."
    );
  }

  evidence.push(
    "No verified stock, modified, or map-switch classification could be established."
  );

  return {
    classification: "unknown",
    confidence: 0.2,
    exactBinaryMatch: false,
    evidence,
    warnings,
  };
}
