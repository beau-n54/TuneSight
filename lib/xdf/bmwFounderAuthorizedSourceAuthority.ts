import type { FounderReviewCohort } from "./sourceAuthorityFounderReview.ts";
import { constructSourceAuthorityRecord, type SourceAuthorityRecord } from "./sourceAuthorityScope.ts";

export const BMW_FOUNDER_REVIEW_COHORT_ID = "source-authority-founder-review-cohort:688e5519ac0e7d391d4f5cf94dcb9fdeeeafc273173dbe0a7a1090131af13996" as const;
export const BMW_FOUNDER_REVIEW_COHORT_REVISION = "source-authority-founder-review-cohort-revision:60bb4879161e041df467c2b25532cb70d801183e955b19fb2c4d0061d9636146" as const;
export const BMW_FOUNDER_SOURCE_AUTHORIZED_AT = "2026-09-01T00:00:00.000Z" as const;

const EXPECTED_FAMILIES = Object.freeze({ B58gen2: 42, N55E: 1, S63: 11 });

export function materializeBmwFounderAuthorizedSourceAuthority(cohort: FounderReviewCohort): SourceAuthorityRecord {
  if (cohort.cohortId !== BMW_FOUNDER_REVIEW_COHORT_ID || cohort.cohortRevision !== BMW_FOUNDER_REVIEW_COHORT_REVISION) throw new Error("Founder authority requires the unchanged accepted review cohort.");
  if (cohort.rows.length !== 54 || JSON.stringify(cohort.familyCounts) !== JSON.stringify(EXPECTED_FAMILIES)) throw new Error("Founder authority is limited to the exact enumerated 42 B58 Gen2, one N55E and 11 S63 scopes.");
  if (cohort.rows.some((row) => row.authorityState !== "pending_founder_authority" || row.publicationState !== "not_published")) throw new Error("Founder authority input must remain pending and unpublished.");
  return constructSourceAuthorityRecord({
    authorityClass: "governed_evidence_review",
    founderAuthorityId: "tunesight-founder:founder",
    authorizedAt: BMW_FOUNDER_SOURCE_AUTHORIZED_AT,
    lineage: [`Accepted immutable review cohort ${cohort.cohortRevision}.`],
    scope: cohort.rows.map((row) => row.exactScope),
    evidenceBasis: ["Exact Source Artifact and Definition Set identities", "Exact ROM/software marker correspondence", "Complete conflict-free extraction and engineering conversion for every responsible binary", "Founder-authorized TuneSight governed engineering Evidence review"],
    provenance: ["Founder Founder and Bob authorized only the 54 exact immutable scopes recorded in WP-004.3.23; upstream acquisition and authorship remain unknown."],
    limitations: ["Upstream acquisition provenance and XDF authorship remain unknown.", "This is TuneSight governed-Evidence Source Authority, not BMW or OEM authorship or endorsement.", "No wildcard family, platform, sibling-ROM or future-revision authority exists.", "Stock authenticity and semantic Calibration Knowledge remain separate.", "Every applicability relationship requires independent assessment and explicit decision.", "Publication remains separately authorized and has not occurred."],
  });
}
