import type { CalibrationSourceIdentity } from "./identityOwners.ts";
import type { QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";

/** Read the admitted Dataset's own source identity. Legacy sessions are read as
 * they stand; no reload, requalification, revision rewrite or persistence occurs.
 * Only the container owner's two identity-preserving resolutions prove that the
 * original container bytes equal EngineeringBinary bytes; otherwise it is absent.
 */
export function calibrationSourceIdentity(input: Readonly<{
  identity: string; container: string; containerDigest?: string;
  coverage: Readonly<{ outcome: string }>;
  material: Readonly<{ current: Pick<QualifiedCalibrationDataset, "exactBinaryIdentity" | "definitionSetRevisionId" | "sourceArtifactId" | "sourceArtifactDigest" | "datasetId" | "datasetRevision"> }>;
}>): CalibrationSourceIdentity {
  const dataset = input.material.current;
  const binary = dataset.exactBinaryIdentity;
  const identicalContainer = binary.containerByteLength === binary.byteLength && input.container === binary.containerType
    && ((input.container === "bin" && binary.resolutionMethod === "bin_identity")
      || (input.container === "dtf" && binary.resolutionMethod === "dtf_raw_mg1_86t0_full_binary"));
  return Object.freeze({ authority: "qualified_calibration_source", containerType: input.container,
    containerDigest: input.containerDigest ?? (identicalContainer ? binary.digest : null),
    containerDigestProvenance: input.containerDigest ? "uploaded_container_sha256" : identicalContainer ? "qualified_identity_container_resolution" : null,
    engineeringBinaryDigest: dataset.exactBinaryIdentity.digest,
    exactSoftwareIdentity: input.identity, definitionSourceFamily: dataset.exactBinaryIdentity.romFamily,
    definitionSetRevision: dataset.definitionSetRevisionId, sourceArtifactId: dataset.sourceArtifactId,
    sourceArtifactDigest: dataset.sourceArtifactDigest, datasetId: dataset.datasetId,
    datasetRevision: dataset.datasetRevision, coverage: input.coverage.outcome });
}
