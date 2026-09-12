import { FOUNDER_00003076501103_SOURCE_AUTHORITY } from "./b58PhysicalAcceptedSourceAuthority.ts";
import { FOUNDER_00003076501103_COMPLETE_VALIDATIONS, FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE, FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT } from "./b58PhysicalTableQuarantine.ts";
import { constructQuarantineAwareApplicabilityCandidate } from "./quarantineAwareApplicabilityCandidate.ts";

const scope = FOUNDER_00003076501103_SOURCE_AUTHORITY.scope[0]!;

export const FOUNDER_00003076501103_APPLICABILITY_CANDIDATE = constructQuarantineAwareApplicabilityCandidate({
  sourceAuthority: FOUNDER_00003076501103_SOURCE_AUTHORITY,
  romSoftwareIdentity: "00003076501103",
  definitionSetId: scope.definitionSetId,
  definitionSetRevision: scope.definitionSetRevision,
  totalDefinitions: 1_175,
  validations: FOUNDER_00003076501103_COMPLETE_VALIDATIONS,
  quarantineBindings: [{ quarantine: FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE, safetyAssessment: FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT }],
  limitations: [...FOUNDER_00003076501103_SOURCE_AUTHORITY.limitations, "The physical binaries remain observed evidence / Stock Candidate; applicability does not establish authoritative Stock or Reference status.", "The candidate creates no applicability decision, publication, Dataset admission or Workshop authority."],
});
