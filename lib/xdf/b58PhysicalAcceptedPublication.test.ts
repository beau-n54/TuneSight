import assert from "node:assert/strict";
import test from "node:test";
import { FOUNDER_00003076501103_ACCEPTED_APPLICABILITY_DECISION } from "./b58PhysicalAcceptedApplicabilityDecision.ts";
import { FOUNDER_00003076501103_PUBLICATION_CANDIDATE, FOUNDER_00003076501103_ROM_LAYOUT_ID } from "./b58PhysicalPublicationCandidate.ts";
import { FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_ID, FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_REVISION, FOUNDER_00003076501103_ACCEPTED_PUBLICATION_DECISION, FOUNDER_00003076501103_ACTIVE_RELATIONSHIP, FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY } from "./b58PhysicalAcceptedPublication.ts";
import { FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE, FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT } from "./b58PhysicalTableQuarantine.ts";
import { lookupActiveRomLayoutApplicability } from "./romLayoutApplicabilityPublication.ts";

test("Founder publication binds the exact immutable candidate and every authority-bearing dependency", () => {
  assert.equal(FOUNDER_00003076501103_PUBLICATION_CANDIDATE.candidateId, FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_ID);
  assert.equal(FOUNDER_00003076501103_PUBLICATION_CANDIDATE.candidateRevision, FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_REVISION);
  assert.equal(FOUNDER_00003076501103_ACCEPTED_PUBLICATION_DECISION.reviewPackageId, FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_ID);
  assert.equal(FOUNDER_00003076501103_ACCEPTED_PUBLICATION_DECISION.reviewPackageRevision, FOUNDER_00003076501103_ACCEPTED_PUBLICATION_CANDIDATE_REVISION);
  assert.equal(FOUNDER_00003076501103_ACTIVE_RELATIONSHIP.decisionRevision, FOUNDER_00003076501103_ACCEPTED_PUBLICATION_DECISION.decisionRevision);
  assert.equal(FOUNDER_00003076501103_ACTIVE_RELATIONSHIP.romLayoutId, FOUNDER_00003076501103_ROM_LAYOUT_ID);
  assert.equal(FOUNDER_00003076501103_ACTIVE_RELATIONSHIP.definitionSetRevisionId, FOUNDER_00003076501103_ACCEPTED_APPLICABILITY_DECISION.definitionSetRevision);
  const provenance = FOUNDER_00003076501103_ACTIVE_RELATIONSHIP.sourceProvenanceDisclosure;
  assert.ok(provenance.includes(FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE.quarantineRevision));
  assert.ok(provenance.includes(FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT.assessmentRevision));
  assert.ok(FOUNDER_00003076501103_ACTIVE_RELATIONSHIP.provenanceLimitations.some(item => item.includes("Reference")));
});

test("runtime registry activates only the exact published relationship", () => {
  assert.equal(FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY.relationships.length, 1);
  assert.equal(lookupActiveRomLayoutApplicability(FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY, FOUNDER_00003076501103_ROM_LAYOUT_ID).outcome, "exact_active");
  assert.equal(lookupActiveRomLayoutApplicability(FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY, `rom-layout:${"f".repeat(64)}`).outcome, "none");
  assert.equal(FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE.permissions.editable, false);
  assert.equal(FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE.permissions.suggestedCalibrationEligible, false);
  assert.equal(FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE.permissions.reconstructionMutationEligible, false);
  assert.equal(FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE.permissions.flashingEligible, false);
});
