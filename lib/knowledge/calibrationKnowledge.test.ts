import assert from "node:assert/strict";
import test from "node:test";

import {
  defineCalibrationKnowledgeObject,
  type CalibrationApplicability,
  type CalibrationBoundaryCondition,
  type CalibrationKnowledgeObject,
  type CalibrationProtectiveResponse,
  type GovernedVocabularyReference,
  type KnowledgeVerificationStatus,
  type QualifiedAssertion,
} from "./calibrationKnowledge.ts";

const vocabulary = (
  termId: string,
  recognition: GovernedVocabularyReference["recognition"] = "known"
): GovernedVocabularyReference => ({
  vocabularyId: "test-vocabulary",
  vocabularyVersion: "1",
  termId,
  label: termId.replaceAll("_", " "),
  recognition,
});

const applicability = (
  recognition: GovernedVocabularyReference["recognition"] = "known"
): CalibrationApplicability => ({
  scope: vocabulary("universal", recognition),
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
  unresolvedReason: recognition === "known" ? null : "Scope is unresolved.",
});

function assertion<T>(args: {
  id: string;
  value: T | null;
  verificationStatus?: KnowledgeVerificationStatus;
  unresolvedReason?: string | null;
  conflictState?: "none" | "unresolved" | "resolved";
  provenance?: QualifiedAssertion<T>["provenance"];
  supportingEvidence?: QualifiedAssertion<T>["supportingEvidence"];
}): QualifiedAssertion<T> {
  const status = args.verificationStatus ?? "candidate";
  const authoritative = new Set<KnowledgeVerificationStatus>([
    "verified",
    "founder_verified",
    "authoritatively_verified",
  ]).has(status);

  return {
    assertionId: args.id,
    value: args.value,
    verificationStatus: status,
    confidence: status === "unknown" ? "unknown" : "medium",
    authority: authoritative
      ? { authorityType: "test", authorityIdentifier: "test-authority" }
      : null,
    provenance:
      args.provenance ??
      [
        {
          sourceType: "test",
          sourceIdentifier: `source:${args.id}`,
          validationMethod: authoritative ? "controlled-test" : undefined,
          validationAuthority: authoritative ? "test-authority" : undefined,
          validationDate: authoritative ? "2026-08-01" : undefined,
        },
      ],
    supportingEvidence: args.supportingEvidence ?? [
      {
        evidenceId: `evidence:${args.id}`,
        sourceType: "test",
        sourceIdentifier: `source:${args.id}`,
      },
    ],
    contradictoryEvidence: [],
    applicability: applicability(),
    conflictState: args.conflictState ?? "none",
    unresolvedReason:
      args.unresolvedReason ??
      (args.value === null || status === "unknown"
        ? "Knowledge is unresolved."
        : null),
    version: "1",
    lifecycle: { status: "active", version: "1" },
  };
}

function minimalObject(): CalibrationKnowledgeObject {
  return {
    identity: assertion({ id: "identity", value: { stableId: "cal:test" } }),
    canonicalName: assertion({ id: "name", value: "Test calibration" }),
    aliases: [],
    purposes: [],
    engineeringIntents: [],
    calibrationKind: assertion({ id: "kind", value: vocabulary("limit") }),
    primarySubsystem: assertion({
      id: "primary-subsystem",
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
  };
}

test("defines an immutable canonical Calibration Knowledge object", () => {
  const input = minimalObject();
  const result = defineCalibrationKnowledgeObject(input);

  assert.notEqual(result, input);
  assert.equal(result.identity.value?.stableId, "cal:test");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.identity));
  assert.ok(Object.isFrozen(result.provenance));
  assert.equal(Reflect.set(result, "version", "2"), false);
});

test("requires repository-compatible provenance for authoritative assertions", () => {
  const cases = [
    {
      name: "validation method",
      provenance: [
        {
          sourceType: "test",
          sourceIdentifier: "source",
          validationAuthority: "authority",
          validationDate: "2026-08-01",
        },
      ],
    },
    {
      name: "validation authority",
      provenance: [
        {
          sourceType: "test",
          sourceIdentifier: "source",
          validationMethod: "controlled-review",
          validationDate: "2026-08-01",
        },
      ],
    },
    {
      name: "validation date",
      provenance: [
        {
          sourceType: "test",
          sourceIdentifier: "source",
          validationMethod: "controlled-review",
          validationAuthority: "authority",
        },
      ],
    },
  ];

  for (const item of cases) {
    const input = minimalObject();
    assert.throws(
      () =>
        defineCalibrationKnowledgeObject({
          ...input,
          purposes: [
            assertion({
              id: `purpose:${item.name}`,
              value: { summary: "Qualified purpose." },
              verificationStatus: "verified",
              provenance: item.provenance,
            }),
          ],
        }),
      new RegExp(item.name)
    );
  }
});

test("rejects invalid authoritative validation dates and missing evidence", () => {
  const input = minimalObject();
  const invalidDate = assertion({
    id: "purpose:invalid-date",
    value: { summary: "Qualified purpose." },
    verificationStatus: "verified",
    provenance: [
      {
        sourceType: "test",
        sourceIdentifier: "source",
        validationMethod: "controlled-review",
        validationAuthority: "authority",
        validationDate: "2026-02-30",
      },
    ],
  });
  const missingEvidence = assertion({
    id: "purpose:missing-evidence",
    value: { summary: "Qualified purpose." },
    verificationStatus: "verified",
    supportingEvidence: [],
  });

  assert.throws(
    () =>
      defineCalibrationKnowledgeObject({ ...input, purposes: [invalidDate] }),
    /invalid validation date/
  );
  assert.throws(
    () =>
      defineCalibrationKnowledgeObject({ ...input, purposes: [missingEvidence] }),
    /requires supporting evidence/
  );
});

test("keeps Purpose and Engineering Intent independently qualified", () => {
  const input = minimalObject();
  const result = defineCalibrationKnowledgeObject({
    ...input,
    purposes: [
      assertion({
        id: "purpose",
        value: { summary: "Defines requested manifold pressure." },
        verificationStatus: "verified",
      }),
    ],
    engineeringIntents: [
      assertion({
        id: "intent",
        value: {
          summary: "Balances requested torque with system constraints.",
          engineeringObjectives: [],
          participatingSubsystems: [],
          protectedInterests: [],
          governingConstraints: [],
          documentedTradeoffs: [],
        },
        verificationStatus: "candidate",
      }),
    ],
  });

  assert.equal(result.purposes[0].verificationStatus, "verified");
  assert.equal(result.engineeringIntents[0].verificationStatus, "candidate");
});

test("preserves explicit Unknown without inventing a value", () => {
  const input = minimalObject();
  const result = defineCalibrationKnowledgeObject({
    ...input,
    calibrationKind: assertion({
      id: "kind",
      value: null,
      verificationStatus: "unknown",
      unresolvedReason: "Calibration kind has not been qualified.",
    }),
  });

  assert.equal(result.calibrationKind.value, null);
  assert.equal(result.calibrationKind.verificationStatus, "unknown");
});

test("requires unresolved reasons for unknown assertions", () => {
  const input = minimalObject();
  const invalid = {
    ...input,
    calibrationKind: {
      ...assertion({ id: "kind", value: null }),
      verificationStatus: "unknown" as const,
      unresolvedReason: null,
    },
  };

  assert.throws(
    () => defineCalibrationKnowledgeObject(invalid),
    /requires an unresolved reason/
  );
});

test("represents increase and decrease behaviour as separate assertions", () => {
  const input = minimalObject();
  const behaviour = (id: string, response: string) =>
    assertion({
      id,
      value: {
        manipulatedQuantity: "requested pressure",
        response: vocabulary(response),
        expectedEffect: `${response} requested pressure`,
        affectedSubsystems: [vocabulary("boost_control")],
        preconditions: [],
        boundaryConditions: [],
        nonlinearCharacteristics: [],
        potentialProtectiveResponses: [],
        dependencyCalibrationIds: [],
        exceptions: [],
      },
    });
  const result = defineCalibrationKnowledgeObject({
    ...input,
    directionalBehaviours: [
      behaviour("increase", "increase"),
      behaviour("decrease", "decrease"),
    ],
  });

  assert.deepEqual(
    result.directionalBehaviours.map((item) => item.value?.response.termId),
    ["increase", "decrease"]
  );
});

test("keeps nonlinear, boundary, and protective behaviour qualified", () => {
  const input = minimalObject();
  const result = defineCalibrationKnowledgeObject({
    ...input,
    directionalBehaviours: [
      assertion({
        id: "behaviour",
        value: {
          manipulatedQuantity: "requested pressure",
          response: vocabulary("nonlinear"),
          expectedEffect: "Response varies by operating region.",
          affectedSubsystems: [],
          preconditions: [],
          boundaryConditions: [
            assertion({
              id: "boundary",
              value: {
                conditionId: "boundary:1",
                quantity: "engine speed",
                relationship: vocabulary("above"),
                valueDescription: "Qualified boundary",
              },
            }),
          ],
          nonlinearCharacteristics: [
            assertion({ id: "nonlinear", value: vocabulary("saturation") }),
          ],
          potentialProtectiveResponses: [
            assertion({
              id: "protection",
              value: {
                responseId: "protection:1",
                response: vocabulary("torque_intervention"),
                activationConditions: [],
                affectedSubsystems: [],
                relatedCalibrationIds: [],
                protectedInterests: [],
              },
            }),
          ],
          dependencyCalibrationIds: [],
          exceptions: [],
        },
      }),
    ],
  });

  const behaviour = result.directionalBehaviours[0].value;
  assert.equal(behaviour?.boundaryConditions.length, 1);
  assert.equal(behaviour?.nonlinearCharacteristics.length, 1);
  assert.equal(behaviour?.potentialProtectiveResponses.length, 1);
});

test("preserves conflict state and contradictory evidence", () => {
  const input = minimalObject();
  const conflicted = assertion({
    id: "purpose",
    value: { summary: "Unresolved purpose." },
    conflictState: "unresolved",
    unresolvedReason: "Sources disagree.",
  });
  const result = defineCalibrationKnowledgeObject({
    ...input,
    purposes: [
      {
        ...conflicted,
        contradictoryEvidence: [
          {
            evidenceId: "contradiction:1",
            sourceType: "test",
            sourceIdentifier: "conflicting-source",
          },
        ],
      },
    ],
  });

  assert.equal(result.purposes[0].conflictState, "unresolved");
  assert.equal(result.purposes[0].contradictoryEvidence.length, 1);
});

test("supports multiple Engineering Objectives without collapsing intent", () => {
  const input = minimalObject();
  const result = defineCalibrationKnowledgeObject({
    ...input,
    engineeringIntents: [
      assertion({
        id: "intent",
        value: {
          summary: "Coordinates multiple engineering objectives.",
          engineeringObjectives: [
            {
              objectiveId: "torque",
              canonicalName: "Torque delivery",
              vocabulary: vocabulary("torque_delivery"),
            },
            {
              objectiveId: "durability",
              canonicalName: "Turbocharger durability",
              vocabulary: vocabulary("turbocharger_durability"),
            },
          ],
          participatingSubsystems: [],
          protectedInterests: [],
          governingConstraints: [],
          documentedTradeoffs: [],
        },
      }),
    ],
  });

  assert.equal(
    result.engineeringIntents[0].value?.engineeringObjectives.length,
    2
  );
});

test("keeps source representations non-authoritative and vocabulary extensible", () => {
  const input = minimalObject();
  const result = defineCalibrationKnowledgeObject({
    ...input,
    calibrationKind: assertion({
      id: "kind",
      value: vocabulary("future_kind", "unrecognized"),
      unresolvedReason: "Vocabulary term awaits governance.",
    }),
    sourceRepresentations: [
      assertion({
        id: "xdf-source",
        value: {
          sourceReferenceId: "xdf:1",
          sourceType: vocabulary("xdf"),
          sourceIdentifier: "table-name-only",
          axes: [],
          conversionMetadata: {},
        },
      }),
    ],
  });

  assert.equal(result.calibrationKind.value?.termId, "future_kind");
  assert.equal(result.calibrationKind.value?.recognition, "unrecognized");
  assert.equal(result.sourceRepresentations[0].verificationStatus, "candidate");
  assert.equal(result.identity.verificationStatus, "candidate");
});

test("unrecognized vocabulary cannot carry authoritative verification", () => {
  const input = minimalObject();

  assert.throws(
    () =>
      defineCalibrationKnowledgeObject({
        ...input,
        calibrationKind: assertion({
          id: "kind",
          value: vocabulary("future_kind", "unrecognized"),
          verificationStatus: "verified",
          unresolvedReason: "Term awaits vocabulary governance.",
        }),
      }),
    /cannot be authoritative/
  );

  const authoritativeBehaviour = assertion({
    id: "behaviour",
    value: {
      manipulatedQuantity: "requested pressure",
      response: vocabulary("future_response", "unrecognized"),
      expectedEffect: "Response remains unresolved.",
      affectedSubsystems: [],
      preconditions: [],
      boundaryConditions: [],
      nonlinearCharacteristics: [],
      potentialProtectiveResponses: [],
      dependencyCalibrationIds: [],
      exceptions: [],
    },
    verificationStatus: "verified",
    unresolvedReason: "Response vocabulary awaits governance.",
  });

  assert.throws(
    () =>
      defineCalibrationKnowledgeObject({
        ...input,
        directionalBehaviours: [authoritativeBehaviour],
      }),
    /cannot be authoritative/
  );

  const unrecognizedApplicability = {
    ...applicability("unrecognized"),
    unresolvedReason: "Applicability scope awaits governance.",
  };
  const authoritativePurpose = {
    ...assertion({
      id: "purpose",
      value: { summary: "Qualified purpose." },
      verificationStatus: "verified",
    }),
    applicability: unrecognizedApplicability,
  };

  assert.throws(
    () =>
      defineCalibrationKnowledgeObject({
        ...input,
        purposes: [authoritativePurpose],
      }),
    /applicability vocabulary cannot be authoritative/
  );
});

test("unknown vocabulary remains explicitly bounded", () => {
  const input = minimalObject();
  const result = defineCalibrationKnowledgeObject({
    ...input,
    calibrationKind: assertion({
      id: "kind",
      value: vocabulary("unresolved_kind", "unknown"),
      verificationStatus: "provisional",
      unresolvedReason: "Meaning remains unresolved.",
    }),
  });

  assert.equal(result.calibrationKind.value?.recognition, "unknown");
  assert.equal(result.calibrationKind.verificationStatus, "provisional");
  assert.equal(result.calibrationKind.unresolvedReason, "Meaning remains unresolved.");
});

test("validates nested vocabulary references", () => {
  const input = minimalObject();
  const invalidRelationship = { ...vocabulary("above"), termId: "   " };

  assert.throws(
    () =>
      defineCalibrationKnowledgeObject({
        ...input,
        directionalBehaviours: [
          assertion({
            id: "behaviour",
            value: {
              manipulatedQuantity: "requested pressure",
              response: vocabulary("increase"),
              expectedEffect: "Increases the represented request.",
              affectedSubsystems: [],
              preconditions: [],
              boundaryConditions: [
                assertion({
                  id: "boundary",
                  value: {
                    conditionId: "boundary:1",
                    quantity: "engine speed",
                    relationship: invalidRelationship,
                    valueDescription: "Above the qualified threshold.",
                  },
                }),
              ],
              nonlinearCharacteristics: [],
              potentialProtectiveResponses: [],
              dependencyCalibrationIds: [],
              exceptions: [],
            },
          }),
        ],
      }),
    /term identity is required/
  );
});

test("rejects whitespace-only required semantic fields", () => {
  const input = minimalObject();
  const behaviourWith = (
    boundaryConditions: readonly QualifiedAssertion<CalibrationBoundaryCondition>[],
    potentialProtectiveResponses: readonly QualifiedAssertion<CalibrationProtectiveResponse>[] = []
  ) =>
    assertion({
      id: "behaviour",
      value: {
        manipulatedQuantity: "requested pressure",
        response: vocabulary("increase"),
        expectedEffect: "Increases the represented request.",
        affectedSubsystems: [],
        preconditions: [],
        boundaryConditions,
        nonlinearCharacteristics: [],
        potentialProtectiveResponses,
        dependencyCalibrationIds: [],
        exceptions: [],
      },
    });
  const cases: CalibrationKnowledgeObject[] = [
    { ...input, aliases: [assertion({ id: "alias", value: { name: "  " } })] },
    {
      ...input,
      purposes: [assertion({ id: "purpose", value: { summary: "\t" } })],
    },
    {
      ...input,
      engineeringIntents: [
        assertion({
          id: "intent",
          value: {
            summary: " ",
            engineeringObjectives: [],
            participatingSubsystems: [],
            protectedInterests: [],
            governingConstraints: [],
            documentedTradeoffs: [],
          },
        }),
      ],
    },
    {
      ...input,
      directionalBehaviours: [
        behaviourWith([
          assertion({
            id: "boundary",
            value: {
              conditionId: " ",
              quantity: "engine speed",
              relationship: vocabulary("above"),
              valueDescription: "Qualified boundary.",
            },
          }),
        ]),
      ],
    },
    {
      ...input,
      directionalBehaviours: [
        behaviourWith([
          assertion({
            id: "boundary",
            value: {
              conditionId: "boundary:1",
              quantity: "\t",
              relationship: vocabulary("above"),
              valueDescription: "Qualified boundary.",
            },
          }),
        ]),
      ],
    },
    {
      ...input,
      directionalBehaviours: [
        behaviourWith([], [
          assertion({
            id: "protection",
            value: {
              responseId: " ",
              response: vocabulary("torque_intervention"),
              activationConditions: [],
              affectedSubsystems: [],
              relatedCalibrationIds: [],
              protectedInterests: [],
            },
          }),
        ]),
      ],
    },
  ];

  cases.forEach((item) =>
    assert.throws(() => defineCalibrationKnowledgeObject(item), /is required/)
  );
});

test("deeply freezes nested content and isolates it from input mutation", () => {
  const input = minimalObject();
  const sourcePreconditions: string[] = ["initial condition"];
  const sourceObjectives = [
    {
      objectiveId: "durability",
      canonicalName: "Component durability",
      vocabulary: vocabulary("component_durability"),
    },
  ];
  const result = defineCalibrationKnowledgeObject({
    ...input,
    engineeringIntents: [
      assertion({
        id: "intent",
        value: {
          summary: "Preserve component durability.",
          engineeringObjectives: sourceObjectives,
          participatingSubsystems: [],
          protectedInterests: [],
          governingConstraints: [],
          documentedTradeoffs: [],
        },
      }),
    ],
    directionalBehaviours: [
      assertion({
        id: "behaviour",
        value: {
          manipulatedQuantity: "requested pressure",
          response: vocabulary("increase"),
          expectedEffect: "Increases the represented request.",
          affectedSubsystems: [],
          preconditions: sourcePreconditions,
          boundaryConditions: [],
          nonlinearCharacteristics: [],
          potentialProtectiveResponses: [],
          dependencyCalibrationIds: [],
          exceptions: [],
        },
      }),
    ],
  });

  sourcePreconditions.push("later mutation");
  sourceObjectives[0].canonicalName = "mutated name";

  const returnedIntent = result.engineeringIntents[0].value;
  const returnedBehaviour = result.directionalBehaviours[0].value;
  assert.equal(returnedBehaviour?.preconditions.length, 1);
  assert.equal(
    returnedIntent?.engineeringObjectives[0].canonicalName,
    "Component durability"
  );
  assert.ok(Object.isFrozen(returnedIntent));
  assert.ok(Object.isFrozen(returnedIntent?.engineeringObjectives));
  assert.ok(Object.isFrozen(returnedIntent?.engineeringObjectives[0]));
  assert.ok(Object.isFrozen(returnedBehaviour?.preconditions));
  assert.equal(
    Reflect.set(returnedIntent?.engineeringObjectives[0] ?? {}, "canonicalName", "changed"),
    false
  );
  assert.equal(
    Reflect.set(returnedBehaviour?.preconditions ?? [], "0", "changed"),
    false
  );
});
