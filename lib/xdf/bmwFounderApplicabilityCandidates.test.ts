import assert from "node:assert/strict";
import test from "node:test";
import { constructReviewedApplicabilityCandidateCohort, constructReviewedApplicabilityDecisionCandidate } from "./bmwFounderApplicabilityCandidates.ts";
import type { ApplicabilityAuthorityAssessment } from "./applicabilityAuthorityDecision.ts";
import type { CalibrationApplicabilityEvidencePackage } from "./calibrationApplicabilityEvidenceFactory.ts";
import type { SourceAuthorityFounderReviewRow } from "./sourceAuthorityFounderReview.ts";
import { constructSourceAuthorityRecord } from "./sourceAuthorityScope.ts";

function relationship(index: number) {
  const hex = index.toString(16).padStart(64, "0"), scope = { sourceArtifactId: `xdf-source:${hex}`, sourceArtifactDigest: `sha256:${hex}`, definitionSetId: `xdf-definition-set:${index}`, definitionSetRevision: `xdf-definition-set-revision:${index}`, family: index < 42 ? "B58gen2" : index === 42 ? "N55E" : "S63" };
  const authority = constructSourceAuthorityRecord({ authorityClass: "governed_evidence_review", founderAuthorityId: "tunesight-founder:founder", authorizedAt: "2026-09-01T00:00:00.000Z", lineage: ["Accepted exact cohort"], scope: [scope], evidenceBasis: ["Complete validation"], provenance: ["Unknown upstream provenance"], limitations: ["No publication"] });
  const proposal = { proposalId: `proposal:${index}`, proposalRevision: `proposal-revision:${index}` };
  const review = { reviewRevision: `review-revision:${index}`, romSoftwareIdentity: `ROM${index}`, sourceArtifactId: scope.sourceArtifactId, definitionSetRevision: scope.definitionSetRevision, exactScope: scope, authorityState: "pending_founder_authority", publicationState: "not_published", completeExtraction: { attempts: 2, successful: 2, blocked: 0, outOfBounds: 0, unsupported: 0 }, completeConversion: { converted: 2, identityNoOp: 0, invalidNumeric: 0, malformed: 0, unavailable: 0 }, representationConflicts: 0 } as unknown as SourceAuthorityFounderReviewRow;
  const evidencePackage = { source: { artifactId: scope.sourceArtifactId, definitionSetRevision: scope.definitionSetRevision }, binaries: [{ role: "stock_original", proposal }], conflicts: { identity: [], platformFamily: [], stockVariant: [], representation: [], equationUnit: [], sourceAuthority: [], duplicateSource: [], binaryCandidate: [] }, packageRevision: `package-revision:${index}` } as unknown as CalibrationApplicabilityEvidencePackage;
  const assessment = { proposalRevision: proposal.proposalRevision, outcome: "reviewable_for_exact_applicability", exactAcceptanceEligible: true, assessmentRevision: `assessment-revision:${index}` } as ApplicabilityAuthorityAssessment;
  return constructReviewedApplicabilityDecisionCandidate({ review, authority, evidencePackage, assessment });
}

test("54 reviewed applicability candidates remain independent, undecided and unpublished", () => {
  const cohort = constructReviewedApplicabilityCandidateCohort(Array.from({ length: 54 }, (_, index) => relationship(index)));
  assert.equal(cohort.eligible, 54); assert.equal(cohort.ineligible, 0); assert.equal(cohort.decisionsAccepted, 0); assert.deepEqual(cohort.publicationSideEffects, []);
  assert.equal(new Set(cohort.candidates.map((item) => item.candidateId)).size, 54);
  assert.ok(cohort.candidates.every((item) => item.decisionState === "candidate_only_pending_founder_review" && item.publicationState === "not_authorized"));
});
