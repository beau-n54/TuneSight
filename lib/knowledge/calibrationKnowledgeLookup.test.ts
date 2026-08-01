import assert from "node:assert/strict";
import test from "node:test";

import {
  defineCalibrationKnowledgeObject,
  type CalibrationApplicability,
  type CalibrationKnowledgeObject,
  type GovernedVocabularyReference,
  type KnowledgeVerificationStatus,
  type QualifiedAssertion,
} from "./calibrationKnowledge.ts";
import {
  defineCalibrationKnowledgeLookupResult,
  defineCalibrationKnowledgeQuery,
  type CalibrationKnowledgeCandidate,
  type CalibrationKnowledgeLookupContext,
  type CalibrationKnowledgeLookupResult,
  type CalibrationKnowledgeQuery,
  type CalibrationKnowledgeReader,
} from "./calibrationKnowledgeLookup.ts";

const vocabulary = (termId: string): GovernedVocabularyReference => ({
  vocabularyId: "test-vocabulary",
  vocabularyVersion: "1",
  termId,
  label: termId.replaceAll("_", " "),
  recognition: "known",
});

const applicability = (): CalibrationApplicability => ({
  scope: vocabulary("universal"),
  platforms: [],
  engineFamilies: [],
  ecuFamilies: [],
  dmeVariants: [],
  controlStrategies: [],
  romFamilies: [],
  softwareVersions: [],
  calibrationIds: [],
  stockVariantIds: [],
  operatingModes: [],
  transmissions: [],
  regions: [],
  emissionsSpecifications: [],
  hardwareConfigurations: [],
  sourceReferenceIds: [],
  unresolvedReason: null,
});

function assertion<T>(args: {
  id: string;
  value: T;
  verificationStatus?: KnowledgeVerificationStatus;
  provenance?: QualifiedAssertion<T>["provenance"];
  applicability?: CalibrationApplicability;
  conflictState?: QualifiedAssertion<T>["conflictState"];
  unresolvedReason?: string | null;
}): QualifiedAssertion<T> {
  const status = args.verificationStatus ?? "candidate";
  const authoritative = [
    "verified",
    "founder_verified",
    "authoritatively_verified",
  ].includes(status);

  return {
    assertionId: args.id,
    value: args.value,
    verificationStatus: status,
    confidence: authoritative ? "high" : "medium",
    authority: authoritative
      ? { authorityType: "test", authorityIdentifier: "test-authority" }
      : null,
    provenance: args.provenance ?? [
      {
        sourceType: "test",
        sourceIdentifier: `source:${args.id}`,
        validationMethod: authoritative ? "controlled-review" : undefined,
        validationAuthority: authoritative ? "test-authority" : undefined,
        validationDate: authoritative ? "2026-08-01" : undefined,
      },
    ],
    supportingEvidence: [
      {
        evidenceId: `evidence:${args.id}`,
        sourceType: "test",
        sourceIdentifier: `source:${args.id}`,
      },
    ],
    contradictoryEvidence: [],
    applicability: args.applicability ?? applicability(),
    conflictState: args.conflictState ?? "none",
    unresolvedReason: args.unresolvedReason ?? null,
    version: "1",
    lifecycle: { status: "active", version: "1" },
  };
}

function knowledge(
  identityStatus: KnowledgeVerificationStatus = "candidate"
): CalibrationKnowledgeObject {
  return defineCalibrationKnowledgeObject({
    identity: assertion({
      id: "identity",
      value: { stableId: "cal:test" },
      verificationStatus: identityStatus,
    }),
    canonicalName: assertion({ id: "name", value: "Test calibration" }),
    aliases: [],
    purposes: [
      assertion({
        id: "purpose",
        value: { summary: "Defines a represented engineering quantity." },
      }),
    ],
    engineeringIntents: [],
    calibrationKind: assertion({ id: "kind", value: vocabulary("target") }),
    primarySubsystem: assertion({
      id: "subsystem",
      value: vocabulary("boost_control"),
    }),
    relatedSubsystems: [],
    applicability: assertion({ id: "applicability", value: applicability() }),
    sourceRepresentations: [],
    directionalBehaviours: [],
    relationships: [],
    provenance: [{ sourceType: "test", sourceIdentifier: "fixture" }],
    lifecycle: { status: "active", version: "1" },
    version: "1",
  });
}

const emptyContext = (): CalibrationKnowledgeLookupContext => ({
  assertions: [],
});

const canonicalQuery = (): CalibrationKnowledgeQuery => ({
  queryId: "query:1",
  selectors: [
    assertion({
      id: "selector:identity",
      value: { kind: "canonical_identity", stableId: "cal:test" },
    }),
  ],
  context: emptyContext(),
  contractVersion: "1",
});

function candidate(args: {
  id?: string;
  identityStatus?: KnowledgeVerificationStatus;
  basisStatus?: KnowledgeVerificationStatus;
  applicabilityStatus?: KnowledgeVerificationStatus;
  matchScope?: "exact" | "contextual";
  querySelectorId?: string;
} = {}): CalibrationKnowledgeCandidate {
  return {
    candidateId: args.id ?? "candidate:1",
    knowledge: knowledge(args.identityStatus),
    matchBasis: assertion({
      id: `basis:${args.id ?? "1"}`,
      value: {
        kind: vocabulary("canonical_identity"),
        matchScope: args.matchScope ?? "exact",
        selectorIds: [args.querySelectorId ?? "selector:identity"],
        description: "Canonical identity supplied by the query.",
      },
      verificationStatus: args.basisStatus,
    }),
    applicabilityAssessment: assertion({
      id: `applicability:${args.id ?? "1"}`,
      value: applicability(),
      verificationStatus: args.applicabilityStatus,
    }),
    provenance: [{ sourceType: "test", sourceIdentifier: "candidate-source" }],
    limitations: ["Test-only candidate."],
  };
}

function commonResult(candidates: readonly CalibrationKnowledgeCandidate[]) {
  return {
    query: canonicalQuery(),
    candidates,
    ...commonMetadata(),
  };
}

function commonMetadata() {
  return {
    provenance: [{ sourceType: "test", sourceIdentifier: "result-source" }],
    missingContext: [],
    limitations: [],
    contractVersion: "1",
  };
}

test("constructs canonical-identity and source-reference queries", () => {
  const canonical = defineCalibrationKnowledgeQuery(canonicalQuery());
  const source = defineCalibrationKnowledgeQuery({
    queryId: "query:source",
    selectors: [
      {
        ...assertion({
          id: "selector:source",
          value: {
            kind: "source_reference" as const,
            sourceReferenceId: "xdf:table:1",
            sourceType: vocabulary("xdf"),
          },
        }),
      },
    ],
    context: {
      assertions: [
        assertion({
          id: "context:platform",
          value: {
            dimension: vocabulary("platform"),
            values: ["platform-context"],
          },
        }),
      ],
    },
    contractVersion: "1",
  });

  assert.equal(canonical.selectors[0].value?.kind, "canonical_identity");
  assert.equal(source.selectors[0].value?.kind, "source_reference");
  assert.deepEqual(source.context.assertions[0].value?.values, ["platform-context"]);
});

test("rejects missing and whitespace-only selectors", () => {
  assert.throws(
    () =>
      defineCalibrationKnowledgeQuery({
        ...canonicalQuery(),
        selectors: [],
      }),
    /requires a usable selector/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeQuery({
        ...canonicalQuery(),
        selectors: [
          assertion({
            id: "selector:identity",
            value: { kind: "canonical_identity", stableId: "   " },
          }),
        ],
      }),
    /Canonical calibration identity is required/
  );
});

test("provisional selectors and context remain valid without authoritative provenance", () => {
  const query = defineCalibrationKnowledgeQuery({
    queryId: "query:provisional",
    selectors: [
      assertion({
        id: "selector:provisional",
        value: { kind: "canonical_identity", stableId: "cal:candidate" },
        verificationStatus: "provisional",
        provenance: [],
      }),
    ],
    context: {
      assertions: [
        assertion({
          id: "context:provisional",
          value: {
            dimension: vocabulary("rom_family"),
            values: ["ROM:CANDIDATE"],
          },
          verificationStatus: "provisional",
          provenance: [],
        }),
      ],
    },
    contractVersion: "1",
  });

  assert.equal(query.selectors[0].verificationStatus, "provisional");
  assert.equal(query.context.assertions[0].verificationStatus, "provisional");
});

test("conflicting context assertions remain preserved", () => {
  const query = defineCalibrationKnowledgeQuery({
    ...canonicalQuery(),
    context: {
      assertions: [
        assertion({
          id: "context:rom:a",
          value: { dimension: vocabulary("rom_family"), values: ["ROM:A"] },
          conflictState: "unresolved",
          unresolvedReason: "Qualified sources disagree.",
        }),
        assertion({
          id: "context:rom:b",
          value: { dimension: vocabulary("rom_family"), values: ["ROM:B"] },
          conflictState: "unresolved",
          unresolvedReason: "Qualified sources disagree.",
        }),
      ],
    },
  });

  assert.equal(query.context.assertions.length, 2);
  assert.ok(
    query.context.assertions.every(
      (item) => item.conflictState === "unresolved"
    )
  );
});

test("shared authority validation governs selectors and applicability", () => {
  const invalidProvenance = [
    { sourceType: "test", sourceIdentifier: "unvalidated" },
  ];
  assert.throws(
    () =>
      defineCalibrationKnowledgeQuery({
        ...canonicalQuery(),
        selectors: [
          assertion({
            id: "selector:authoritative",
            value: { kind: "canonical_identity", stableId: "cal:test" },
            verificationStatus: "verified",
            provenance: invalidProvenance,
          }),
        ],
      }),
    /requires provenance with validation method, validation authority, and validation date/
  );

  const match = candidate({ applicabilityStatus: "verified" });
  const invalidApplicability = {
    ...match,
    applicabilityAssessment: {
      ...match.applicabilityAssessment,
      provenance: invalidProvenance,
    },
  };
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...commonResult([invalidApplicability]),
        outcome: "exact_candidate",
        match: invalidApplicability,
        unresolvedReason: "Applicability provenance is invalid.",
      }),
    /requires provenance with validation method, validation authority, and validation date/
  );
});

test("exact_verified requires one fully qualified canonical match", () => {
  const match = candidate({
    identityStatus: "verified",
    basisStatus: "verified",
    applicabilityStatus: "verified",
  });
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([match]),
    outcome: "exact_verified",
    match,
    unresolvedReason: null,
  });

  assert.equal(result.outcome, "exact_verified");
  assert.equal(result.match.knowledge.identity.verificationStatus, "verified");
  assert.equal(result.match.knowledge.purposes[0].verificationStatus, "candidate");

  const invalidBasis = {
    ...match,
    matchBasis: {
      ...match.matchBasis,
      provenance: [{ sourceType: "test", sourceIdentifier: "unvalidated" }],
    },
  };
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...commonResult([invalidBasis]),
        outcome: "exact_verified",
        match: invalidBasis,
        unresolvedReason: null,
      }),
    /requires provenance with validation method, validation authority, and validation date/
  );
});

test("exact_candidate remains below verified authority", () => {
  const match = candidate({ basisStatus: "verified" });
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([match]),
    outcome: "exact_candidate",
    match,
    unresolvedReason: "Canonical identity remains candidate Knowledge.",
  });

  assert.equal(result.outcome, "exact_candidate");
  assert.equal(result.match.matchBasis.verificationStatus, "verified");
  assert.equal(result.match.knowledge.identity.verificationStatus, "candidate");
  assert.throws(
    () => {
      const verified = candidate({
        identityStatus: "verified",
        basisStatus: "verified",
        applicabilityStatus: "verified",
      });
      defineCalibrationKnowledgeLookupResult({
        ...commonResult([verified]),
        outcome: "exact_candidate",
        match: verified,
        unresolvedReason: "Incorrectly weakened outcome.",
      });
    },
    /cannot contain a fully authoritative exact match/
  );
});

test("contextual_match cannot be mistaken for an exact outcome", () => {
  const match = candidate({ matchScope: "contextual" });
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([match]),
    outcome: "contextual_match",
    match,
    unresolvedReason: "Only bounded strategy context supports this match.",
  });

  assert.equal(result.outcome, "contextual_match");
  assert.notEqual(result.outcome, "exact_verified");

  const exactBasis = candidate();
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...commonResult([exactBasis]),
        outcome: "contextual_match",
        match: exactBasis,
        unresolvedReason: "Contextual scope is required.",
      }),
    /requires a contextual qualified match basis/
  );
});

test("multiple_candidates preserves every viable candidate", () => {
  const candidates = [candidate(), candidate({ id: "candidate:2" })];
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult(candidates),
    outcome: "multiple_candidates",
    unresolvedReason: "Two qualified candidates remain viable.",
  });

  assert.deepEqual(
    result.candidates.map((item) => item.candidateId),
    ["candidate:1", "candidate:2"]
  );
});

test("conflict preserves contradictory candidates and details", () => {
  const candidates = [candidate(), candidate({ id: "candidate:2" })];
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult(candidates),
    outcome: "conflict",
    conflicts: [
      {
        conflictId: "conflict:1",
        summary: "Candidate applicability assertions disagree.",
        candidateIds: ["candidate:1", "candidate:2"],
        contradictoryAssertionIds: ["applicability:1", "applicability:candidate:2"],
        provenance: [{ sourceType: "test", sourceIdentifier: "conflict-source" }],
        unresolvedReason: "No authorised resolution exists.",
      },
    ],
    unresolvedReason: "Material candidate conflict remains unresolved.",
  });

  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.conflicts[0].candidateIds, ["candidate:1", "candidate:2"]);
});

test("one candidate can conflict with preserved qualified context", () => {
  const match = candidate();
  const contextAssertion = assertion({
    id: "context:platform",
    value: {
      dimension: vocabulary("platform"),
      values: ["platform:contradictory"],
    },
  });
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([match]),
    query: {
      ...canonicalQuery(),
      context: { assertions: [contextAssertion] },
    },
    outcome: "conflict",
    conflicts: [
      {
        conflictId: "conflict:context",
        summary: "Qualified platform context contradicts candidate applicability.",
        candidateIds: [match.candidateId],
        contradictoryAssertionIds: [contextAssertion.assertionId],
        provenance: [{ sourceType: "test", sourceIdentifier: "conflict-source" }],
        unresolvedReason: "Candidate applicability and qualified context disagree.",
      },
    ],
    unresolvedReason: "Material candidate-versus-context conflict remains unresolved.",
  });

  assert.equal(result.outcome, "conflict");
  assert.deepEqual(result.conflicts[0].candidateIds, [match.candidateId]);
  assert.deepEqual(result.conflicts[0].contradictoryAssertionIds, [
    contextAssertion.assertionId,
  ]);
  assert.deepEqual(result.query.context.assertions[0], contextAssertion);
});

test("unknown, invalid, and runtime_unavailable remain distinct", () => {
  const unknown = defineCalibrationKnowledgeLookupResult({
    ...commonResult([]),
    outcome: "unknown",
    candidates: [],
    unresolvedReason: "No admitted Knowledge answered the valid query.",
  });
  const invalid = defineCalibrationKnowledgeLookupResult({
    ...commonMetadata(),
    outcome: "invalid",
    queryInput: {
      queryId: "query:invalid",
      selectors: [],
      context: { assertions: [] },
      contractVersion: "1",
    },
    candidates: [],
    validationIssues: ["Required lookup context is malformed."],
    unresolvedReason: "Lookup was not executed with invalid context.",
  });
  const unavailable = defineCalibrationKnowledgeLookupResult({
    ...commonResult([]),
    outcome: "runtime_unavailable",
    candidates: [],
    unavailableReason: "Calibration Knowledge runtime is unavailable.",
    unresolvedReason: null,
  });

  assert.deepEqual(
    [unknown.outcome, invalid.outcome, unavailable.outcome],
    ["unknown", "invalid", "runtime_unavailable"]
  );
});

test("invalid preserves missing and malformed query input", () => {
  const noSelector = defineCalibrationKnowledgeLookupResult({
    ...commonMetadata(),
    outcome: "invalid",
    queryInput: {
      queryId: "query:no-selector",
      selectors: [],
      context: { assertions: [] },
      contractVersion: "1",
    },
    candidates: [],
    validationIssues: ["No query selector was supplied."],
    unresolvedReason: "The malformed query was not executed.",
  });
  const malformedContext = defineCalibrationKnowledgeLookupResult({
    ...commonMetadata(),
    outcome: "invalid",
    queryInput: {
      queryId: "query:malformed-context",
      selectors: canonicalQuery().selectors,
      context: { assertions: null },
      contractVersion: "1",
    },
    candidates: [],
    validationIssues: ["Lookup context assertions are malformed."],
    unresolvedReason: "The malformed query was not executed.",
  });

  assert.deepEqual(noSelector.queryInput.selectors, []);
  assert.equal(malformedContext.queryInput.context?.assertions, null);
  assert.equal(noSelector.outcome, "invalid");
});

test("candidate-free outcomes reject runtime candidate data", () => {
  const preservedCandidate = candidate();
  const invalidShapes = [
    {
      ...commonResult([preservedCandidate]),
      outcome: "unknown",
      unresolvedReason: "Invalid candidate-bearing unknown.",
    },
    {
      ...commonMetadata(),
      outcome: "invalid",
      queryInput: {
        queryId: null,
        selectors: null,
        context: null,
        contractVersion: null,
      },
      candidates: [preservedCandidate],
      validationIssues: ["Malformed query."],
      unresolvedReason: "Invalid query.",
    },
    {
      ...commonResult([preservedCandidate]),
      outcome: "runtime_unavailable",
      unavailableReason: "Runtime unavailable.",
      unresolvedReason: null,
    },
  ];

  invalidShapes.forEach((shape) =>
    assert.throws(
      () =>
        Reflect.apply(defineCalibrationKnowledgeLookupResult, undefined, [shape]),
      /cannot preserve candidate data/
    )
  );
});

test("exact matches cannot diverge from the preserved candidate", () => {
  const preserved = candidate();
  const divergent = { ...preserved, limitations: ["Different limitation."] };

  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...commonResult([preserved]),
        outcome: "exact_candidate",
        match: divergent,
        unresolvedReason: "Candidate remains provisional.",
      }),
    /requires one preserved candidate match/
  );
});

test("multiple-candidate and conflict identities remain unique and resolvable", () => {
  const first = candidate();
  const second = candidate({ id: "candidate:2" });

  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...commonResult([first, { ...first }]),
        outcome: "multiple_candidates",
        unresolvedReason: "Duplicate candidates are invalid.",
      }),
    /Candidate identity candidate:1 is duplicated/
  );

  const conflictBase = {
    ...commonResult([first, second]),
    outcome: "conflict" as const,
    unresolvedReason: "Conflict remains unresolved.",
  };
  const conflict = (candidateIds: readonly string[], assertionIds: readonly string[]) => ({
    conflictId: "conflict:invalid",
    summary: "Invalid conflict fixture.",
    candidateIds,
    contradictoryAssertionIds: assertionIds,
    provenance: [{ sourceType: "test", sourceIdentifier: "conflict-source" }],
    unresolvedReason: "Conflict remains unresolved.",
  });

  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...conflictBase,
        conflicts: [conflict(["candidate:1", "candidate:1"], ["assertion:1"])],
      }),
    /candidate identities must be unique/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...conflictBase,
        conflicts: [conflict(["candidate:1", "candidate:missing"], ["assertion:1"])],
      }),
    /is not preserved by the result/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...conflictBase,
        conflicts: [conflict(["candidate:1", "candidate:2"], [])],
      }),
    /requires at least one contradictory assertion identity/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...conflictBase,
        conflicts: [
          conflict(
            ["candidate:1", "candidate:2"],
            ["assertion:1", "assertion:1"]
          ),
        ],
      }),
    /Contradictory assertion identities must be unique/
  );
});

test("single-candidate conflict invariants reject incomplete contradiction data", () => {
  const match = candidate();
  const contextAssertion = assertion({
    id: "context:platform",
    value: {
      dimension: vocabulary("platform"),
      values: ["platform:contradictory"],
    },
  });
  const conflictBase = {
    ...commonResult([match]),
    query: {
      ...canonicalQuery(),
      context: { assertions: [contextAssertion] },
    },
    outcome: "conflict" as const,
    unresolvedReason: "Conflict remains unresolved.",
  };
  const conflict = (
    candidateIds: readonly string[],
    contradictoryAssertionIds: readonly string[]
  ) => ({
    conflictId: "conflict:context",
    summary: "Qualified context contradicts candidate applicability.",
    candidateIds,
    contradictoryAssertionIds,
    provenance: [{ sourceType: "test", sourceIdentifier: "conflict-source" }],
    unresolvedReason: "Candidate applicability and qualified context disagree.",
  });

  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...conflictBase,
        conflicts: [conflict([match.candidateId], [])],
      }),
    /requires at least one contradictory assertion identity/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...conflictBase,
        conflicts: [
          conflict(["candidate:missing"], [contextAssertion.assertionId]),
        ],
      }),
    /is not preserved by the result/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...commonResult([]),
        outcome: "conflict",
        conflicts: [conflict([], [contextAssertion.assertionId])],
        unresolvedReason: "Conflict without candidates is invalid.",
      }),
    /requires at least one contradictory candidate/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeLookupResult({
        ...conflictBase,
        conflicts: [conflict([match.candidateId], ["candidate:assertion-only"])],
      }),
    /must preserve a contradictory qualified context assertion/
  );
});

test("reader contract is asynchronous and read-only", async () => {
  const reader: CalibrationKnowledgeReader = {
    async lookup(query) {
      return defineCalibrationKnowledgeLookupResult({
        ...commonMetadata(),
        query,
        outcome: "unknown",
        candidates: [],
        unresolvedReason: "No admitted Knowledge answered the query.",
      });
    },
  };

  const pending = reader.lookup(defineCalibrationKnowledgeQuery(canonicalQuery()));
  assert.ok(pending instanceof Promise);
  assert.equal((await pending).outcome, "unknown");
});

test("candidate provenance and applicability remain available", () => {
  const match = candidate();
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([match]),
    outcome: "exact_candidate",
    match,
    unresolvedReason: "Verification remains candidate.",
  });

  assert.equal(result.match.provenance[0].sourceIdentifier, "candidate-source");
  assert.equal(result.match.applicabilityAssessment.value?.scope.termId, "universal");
});

test("source representation verification does not verify unrelated assertions", () => {
  const match = candidate({ basisStatus: "verified" });
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([match]),
    outcome: "exact_candidate",
    match,
    unresolvedReason: "Verified representation does not verify canonical meaning.",
  });

  assert.equal(result.match.matchBasis.verificationStatus, "verified");
  assert.equal(result.match.knowledge.purposes[0].verificationStatus, "candidate");
});

test("query and result construction defensively isolate and freeze values", () => {
  const platforms = ["platform:original"];
  const query = defineCalibrationKnowledgeQuery({
    ...canonicalQuery(),
    context: {
      assertions: [
        assertion({
          id: "context:platform",
          value: { dimension: vocabulary("platform"), values: platforms },
        }),
      ],
    },
  });
  platforms.push("platform:later");

  const limitations = ["Original limitation."];
  const match = { ...candidate(), limitations };
  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([match]),
    outcome: "exact_candidate",
    match,
    unresolvedReason: "Candidate remains unverified.",
  });
  limitations.push("Later mutation.");

  assert.deepEqual(
    query.context.assertions[0].value?.values,
    ["platform:original"]
  );
  assert.deepEqual(result.match.limitations, ["Original limitation."]);
  assert.ok(Object.isFrozen(query.context.assertions[0].value?.values));
  assert.ok(Object.isFrozen(result.match.knowledge));
  assert.ok(Object.isFrozen(result.match.matchBasis.value?.selectorIds));
  assert.equal(Reflect.set(result.match.limitations, "0", "changed"), false);
});

test("lookup outcome union supports exhaustive consumer handling", () => {
  const describe = (result: CalibrationKnowledgeLookupResult): string => {
    switch (result.outcome) {
      case "exact_verified":
      case "exact_candidate":
      case "contextual_match":
      case "multiple_candidates":
      case "conflict":
      case "unknown":
      case "invalid":
      case "runtime_unavailable":
        return result.outcome;
      default: {
        const exhaustiveResult: never = result;
        return exhaustiveResult;
      }
    }
  };

  const result = defineCalibrationKnowledgeLookupResult({
    ...commonResult([]),
    outcome: "unknown",
    candidates: [],
    unresolvedReason: "No admitted Knowledge answered the query.",
  });
  assert.equal(describe(result), "unknown");
});
