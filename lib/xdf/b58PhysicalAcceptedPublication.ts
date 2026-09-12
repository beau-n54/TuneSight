import { FOUNDER_00003076501103_SOURCE_AUTHORITY } from "./b58PhysicalAcceptedSourceAuthority.ts";
import { FOUNDER_00003076501103_ACCEPTED_APPLICABILITY_DECISION } from "./b58PhysicalAcceptedApplicabilityDecision.ts";
import { B58_PHYSICAL_ARTIFACT_EVIDENCE } from "./b58PhysicalArtifactEvidence.ts";
import { FOUNDER_00003076501103_COMPLETE_VALIDATIONS, FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE, FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT } from "./b58PhysicalTableQuarantine.ts";
import { FOUNDER_00003076501103_PUBLICATION_CANDIDATE } from "./b58PhysicalPublicationCandidate.ts";
import { constructRomLayoutApplicabilityDecision, constructRomLayoutPublicationInstruction, createEmptyRomLayoutApplicabilityRegistry, publishRomLayoutApplicability, type GovernedRomLayoutReviewReference } from "./romLayoutApplicabilityPublication.ts";

export const FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_ID = "quarantine-aware-rom-layout-publication-candidate:cc3e1d12095a73f169a1c08d0bc1d446203ef6994e6f94282823e72a2984f212" as const;
export const FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_REVISION = "quarantine-aware-rom-layout-publication-candidate-revision:10aa4351e1a030ef2203ba587aa087a564e7adfacc532027ab54a4397f161648" as const;
const candidate = FOUNDER_00003076501103_PUBLICATION_CANDIDATE;
if (candidate.candidateId !== FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_ID || candidate.candidateRevision !== FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_REVISION || candidate.eligibility !== "eligible_for_founder_publication_review") throw new Error("Founder-accepted B58 publication candidate identity, revision or eligibility drifted.");

const scope = FOUNDER_00003076501103_SOURCE_AUTHORITY.scope[0]!;
const exactBinaries = B58_PHYSICAL_ARTIFACT_EVIDENCE.slice(0, 2);
const review: GovernedRomLayoutReviewReference = Object.freeze({
  packageId: candidate.candidateId, packageRevision: candidate.candidateRevision,
  sourceArtifactId: scope.sourceArtifactId, sourceArtifactDigest: scope.sourceArtifactDigest,
  definitionSetId: candidate.definitionSetId, definitionSetRevisionId: candidate.definitionSetRevision,
  romLayoutId: candidate.romLayoutId, authorityPathway: "tunesight_governed_engineering_evidence",
  sourceAuthorityDisposition: "authoritative", assessmentOutcome: "evidence_sufficient_for_governed_review",
  supportingExactBinaries: Object.freeze(exactBinaries.map((item, index) => Object.freeze({ binaryDigest: item.digest, sourceRole: index === 0 ? "stock_original" as const : "mapswitch" as const, byteLength: item.byteLength, internalRomIdentifiers: Object.freeze([item.identity]) }))),
  representationConflictCount: candidate.representationConflicts,
  provenanceDisclosure: Object.freeze([FOUNDER_00003076501103_SOURCE_AUTHORITY.authorityRevision, FOUNDER_00003076501103_ACCEPTED_APPLICABILITY_DECISION.decisionRevision, ...FOUNDER_00003076501103_COMPLETE_VALIDATIONS.map((item) => item.validationRevision), FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE.quarantineRevision, FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT.assessmentRevision]),
  limitations: candidate.limitations,
});

export const FOUNDER_00003076501103_ACCEPTED_PUBLICATION_DECISION = constructRomLayoutApplicabilityDecision({ review, authority: Object.freeze({ authorityId: "rom-layout-decision-authority:tunesight-founder-b58-gen1-publication", authorityClass: "founder", authorityRevision: "rom-layout-decision-authority-revision:2026-09-13-00003076501103-publication", provenance: Object.freeze([`Founder accepted ${candidate.candidateId}.`, `Founder accepted immutable candidate revision ${candidate.candidateRevision}.`]), acceptedPathways: Object.freeze(["tunesight_governed_engineering_evidence" as const]) }), acceptedEvidenceThreshold: Object.freeze(["Exact accepted Source Authority and applicability decision", "Two complete exact-binary validations", "One exact fail-closed quarantine and safety assessment", "Zero unresolved Definitions or representation conflicts"]), rationale: "Publish the exact 00003076501103 ROM/layout/Definition relationship with its accepted quarantine; no family-wide applicability or Stock/Reference authority is established.", provenanceLimitations: candidate.limitations, decidedAt: "2026-09-13T01:00:00.000Z", decisionReference: `Founder acceptance of ${candidate.candidateId} at ${candidate.candidateRevision}` });

const empty = createEmptyRomLayoutApplicabilityRegistry("2026-09-13T01:01:00.000Z");
export const FOUNDER_00003076501103_PUBLICATION_INSTRUCTION = constructRomLayoutPublicationInstruction({ review, decision: FOUNDER_00003076501103_ACCEPTED_PUBLICATION_DECISION, expectedRegistrySnapshotId: empty.snapshotId, createdAt: "2026-09-13T01:02:00.000Z" });
const published = publishRomLayoutApplicability({ instruction: FOUNDER_00003076501103_PUBLICATION_INSTRUCTION, snapshot: empty, publishedAt: "2026-09-13T01:03:00.000Z" });
if (published.status !== "published") throw new Error("Accepted B58 exact relationship publication failed.");
export const FOUNDER_00003076501103_ACTIVE_RELATIONSHIP = published.relationship;
export const FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY = published.resultingSnapshot;
