import { B58_GEN1_SOURCE_AUTHORITY_DECISION_CANDIDATES } from "./b58Gen1SourceAuthorityCandidates.ts";
import { constructSourceAuthorityRecord } from "./sourceAuthorityScope.ts";

export const B58_GEN1_00007972000705_ACCEPTED_CANDIDATE_ID = "xdf-source-authority-candidate:ce47e482fd14b0cc48ba5a62518ca64d7daded637c30ae144464d14a2a2f7099" as const;
export const B58_GEN1_00007972000705_ACCEPTED_CANDIDATE_REVISION = "xdf-source-authority-candidate-revision:1b3913abf5688ded6e82e90d592dcad2e3ebd9fe9fbed3e57f4c6b1b3456ac97" as const;
export const B58_GEN1_00007972000705_SOURCE_AUTHORIZED_AT = "2026-09-07T00:00:00.000Z" as const;

const accepted = B58_GEN1_SOURCE_AUTHORITY_DECISION_CANDIDATES.find(
  (candidate) => candidate.candidateId === B58_GEN1_00007972000705_ACCEPTED_CANDIDATE_ID,
);

if (!accepted || accepted.candidateRevision !== B58_GEN1_00007972000705_ACCEPTED_CANDIDATE_REVISION || accepted.romSoftwareIdentity !== "00007972000705") {
  throw new Error("Accepted B58 Gen1 Source Authority candidate no longer has the exact Founder-reviewed identity and revision.");
}

export const B58_GEN1_00007972000705_SOURCE_AUTHORITY = constructSourceAuthorityRecord({
  authorityClass: "governed_evidence_review",
  founderAuthorityId: "tunesight-founder:founder",
  authorizedAt: B58_GEN1_00007972000705_SOURCE_AUTHORIZED_AT,
  lineage: [
    `Founder accepted ${accepted.candidateId}.`,
    `Founder accepted immutable candidate revision ${accepted.candidateRevision}.`,
  ],
  scope: [accepted.scope],
  evidenceBasis: [
    "Complete exact-binary extraction and engineering-conversion validation passed for the responsible binary.",
    "Exact internal ROM/software identity evidence is coherent with 00007972000705.",
  ],
  provenance: [
    "Founder Founder explicitly accepted the exact pending Source Authority candidate on 2026-09-07.",
    "The accepted candidate derives from repository-controlled B58 Gen1 XDF and binary evidence.",
  ],
  limitations: [
    "Upstream acquisition and XDF authorship remain unknown.",
    "No BMW or OEM authorship claim is made.",
    "Stock authenticity remains independently governed.",
    "Semantic Calibration Knowledge remains separate.",
    "Applicability remains separate and requires an explicit Founder decision.",
    "Publication remains separate and is not authorized.",
  ],
});
