import { constructGovernedEvidenceAuthorityCandidate, type CompleteBinaryValidation } from "./bmwMasterFullValidation.ts";

const validation: CompleteBinaryValidation = Object.freeze({ validationId: "bmw-full-validation:f22e25e89cdaf922b531b5cd75335568ee980b6d0ea894b77f925f45840ee7ac", validationRevision: "bmw-full-validation-revision:b960332ee5ae6d9ab39837b037bf1abe82221c4f1b998a628eee6341b44fb0f3", binaryDigest: "fb3402eeac93ea1ae08cffecb31960923019444ecb22b057fd60b352dc51dd40", definitions: 1096, extractionAttempts: 1096, extractionSuccess: 1096, blocked: 0, outOfBounds: 0, unsupported: 0, representationConflicts: 0, converted: 811, identityNoOp: 285, invalidNumeric: 0, malformed: 0, unavailable: 0, unresolvedUnits: 120, other: 0 });

export const B58_GEN1_SOURCE_AUTHORITY_DECISION_CANDIDATES = Object.freeze([
  constructGovernedEvidenceAuthorityCandidate({
    scope: { sourceArtifactId: "xdf-source:a2113f0eb25fe42c378eb1b47de7032990e2b8b59eeb58a42ae655eb5c375a60", sourceArtifactDigest: "sha256:a2113f0eb25fe42c378eb1b47de7032990e2b8b59eeb58a42ae655eb5c375a60", definitionSetId: "xdf-definition-set:094b147cb350c17584202cedc8a45d11619ddbedff3151e44422497b28042be9", definitionSetRevision: "xdf-definition-set-revision:e0481c51a69b45aa9328dba345ab75cd997b459f58ca150a79348e3a36b03105", family: "B58gen1" },
    romSoftwareIdentity: "00007972000705",
    validations: [validation],
    identityCoherent: true,
    limitations: ["Upstream acquisition and XDF authorship remain unknown.", "Candidate authority is pending Founder review.", "Stock authenticity, semantic Knowledge, applicability decision and publication remain separate."],
  }),
]);
