export type OwnerTuneDeclaration = Readonly<{
  provider: string; tuneType: string; stage: string; fuel: string | null;
  flashOptions: string | null; declaredAt: string; evidenceGrade: "owner-declared, not byte-verified";
}>;
export type TuneByteEvidence = {
  sourceId: string; fileName: string; digest: string; byteLength: number;
  referenceId: string | null; referenceDigest: string | null; matchesOwnedStockReference: boolean;
};
/** A declaration has no authority over source bytes, platform identity or rules. */
export function tuneEvidenceContext(bytes: TuneByteEvidence | null, declaration: OwnerTuneDeclaration | null) {
  return {bytes, declaration,
    sourceClassification: bytes?.matchesOwnedStockReference
      ? "Uploaded bytes match the explicitly owned Stock Reference byte-for-byte. OEM authenticity and the currently flashed calibration are not established by that match."
      : bytes ? "Owned uploaded bytes verified. Stock/OEM status and active flashed-map status are not established." : "Uploaded byte evidence is unavailable.",
    activeModifiedComparison: "unavailable" as const,
    comparisonReason: "An uploaded file or owner declaration does not prove the active modified calibration. Exact active-map values and modified-versus-stock differences require independently established active modified bytes.",
    inspection: "Qualified Definition inspection relationships remain available independently of active modified bytes. They do not prove the active map's cell values.",
  };
}
