import assert from "node:assert/strict";
import test from "node:test";
import { BMW_FOUNDER_REVIEW_COHORT_ID, BMW_FOUNDER_REVIEW_COHORT_REVISION, materializeBmwFounderAuthorizedSourceAuthority } from "./bmwFounderAuthorizedSourceAuthority.ts";
import type { FounderReviewCohort, SourceAuthorityFounderReviewRow } from "./sourceAuthorityFounderReview.ts";
import { assessSourceAuthorityScope } from "./sourceAuthorityScope.ts";

function cohort(): FounderReviewCohort {
  const families = [...Array(42).fill("B58gen2"), "N55E", ...Array(11).fill("S63")];
  const rows = families.map((family, index) => ({ authorityState: "pending_founder_authority", publicationState: "not_published", exactScope: { sourceArtifactId: `xdf-source:${index.toString(16).padStart(64, "0")}`, sourceArtifactDigest: `sha256:${index.toString(16).padStart(64, "0")}`, definitionSetId: `xdf-definition-set:${index}`, definitionSetRevision: `xdf-definition-set-revision:${index}`, family } })) as SourceAuthorityFounderReviewRow[];
  return { cohortId: BMW_FOUNDER_REVIEW_COHORT_ID, cohortRevision: BMW_FOUNDER_REVIEW_COHORT_REVISION, rows, familyCounts: { B58gen2: 42, N55E: 1, S63: 11 }, outliers: [], consistency: "internally_consistent_with_disclosed_outliers", authorityGranted: false, publicationSideEffects: [] };
}

test("Founder authority materializes only the unchanged exact 54 scopes and no wildcard", () => {
  const review = cohort(), authority = materializeBmwFounderAuthorizedSourceAuthority(review);
  assert.equal(authority.scope.length, 54); assert.equal(new Set(authority.scope.map((item) => JSON.stringify(item))).size, 54);
  assert.ok(authority.limitations.some((item) => item.includes("wildcard")));
  assert.equal(assessSourceAuthorityScope(authority, review.rows[0]!.exactScope).outcome, "in_scope");
  assert.equal(assessSourceAuthorityScope(authority, { ...review.rows[0]!.exactScope, family: "BMW" }).outcome, "out_of_scope");
  assert.throws(() => materializeBmwFounderAuthorizedSourceAuthority({ ...review, cohortRevision: `${BMW_FOUNDER_REVIEW_COHORT_REVISION}:changed` }));
});
