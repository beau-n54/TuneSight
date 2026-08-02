This document forms part of TuneSight's Engineering Governance Framework.

**Identifier:** TS-STD-002

**Title:** Engineering Evidence Integrity Standard

**Version:** 1.0.0

**Authority:** Derived from [TS-STD-000 — Engineering Standards Framework](TS-STD-000-engineering-standards-framework.md)

**Status:** Founder Ratified

**Ratification:** [TS-RAT-015](../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-015)

# TS-STD-002

## Engineering Evidence Integrity Standard

## 1. Purpose

This Standard defines the permanent, implementation-independent obligations governing Engineering Data, Engineering Observation and Engineering Evidence.

It ensures that engineering material preserves sufficient integrity, identity, provenance, observation boundaries, source classification and transformation history before it may support or contradict Engineering Truth.

Evidence integrity does not determine Authority, Verification, Confidence, Knowledge admission, publication or Engineering Truth.

## 2. Scope

This Standard applies to every engineering artefact represented or consumed as Engineering Evidence, including measurements, telemetry, diagnostics, binary observations, events, conditions, anomalies, documents, images, human reports, derived and transformed material, historical material, synthetic and simulated material, replay and fixture material, generated material and training datasets.

It is implementation-independent, architecture-independent, manufacturer-neutral, platform-neutral, storage-neutral, schema-neutral and historically reproducible.

## 3. Authority and Framework Conformance

TS-STD-002 derives authority from the Founder Vision, Engineering Manifesto, Engineering Constitution, Engineering Principles and TS-STD-000.

Ratification establishes normative governance authority only. It does not establish the integrity, Authority, Verification, admissibility or Truth of any existing engineering material.

## 4. Normative References

- Founder Vision
- Engineering Manifesto
- Engineering Constitution
- Engineering Principles
- [TS-STD-000 — Engineering Standards Framework](TS-STD-000-engineering-standards-framework.md)
- [TS-STD-001 — Engineering Truth Standard](TS-STD-001-engineering-truth-standard.md)
- [TS-STD-004 — Engineering Identity, Provenance and Traceability Standard](TS-STD-004-engineering-identity-provenance-traceability-standard.md)

## 5. Permanent Engineering Evidence Model

```text
Engineering Reality
    ↓
Engineering Data
    ↓
Engineering Observation
    ↓
Engineering Evidence
    ↓
Engineering Assertion
    ↓
Qualification
    ↓
Governed Engineering Truth
```

No stage may substitute for another. Data records information. Observation represents something bounded that was measured, detected, recorded or reported. Evidence is governed material whose integrity is preserved for an engineering purpose. An Assertion makes a proposition. Qualification governs its state and limitations. Engineering Truth remains governed by TS-STD-001.

## 6. Engineering Evidence Integrity Supremacy

Engineering Evidence shall always remain subordinate to engineering reality.

Engineering Evidence exists to faithfully preserve what was genuinely observed or truthfully derived under governed engineering conditions.

Engineering Evidence shall never be preserved merely to support an existing Engineering Assertion, Qualification, Engineering Truth, Explanation or Decision where governed engineering reality demonstrates that the evidentiary representation no longer faithfully reflects what was actually observed.

Where later governed engineering observation, provenance, transformation history or source classification demonstrates that existing Engineering Evidence no longer faithfully represents engineering reality, that Evidence shall be corrected, superseded or withdrawn only through governed processes.

Historical Engineering Evidence shall remain historically reproducible.

Current Engineering Evidence shall faithfully represent the best governed engineering understanding of what was actually observed within its declared scope.

**Engineering Evidence Principle:** Engineering Evidence does not protect conclusions. Engineering Evidence protects the faithful governed preservation of engineering observation. Where engineering reality evolves, Engineering Evidence shall evolve. Engineering reality shall always remain the higher authority.

## 7. Production and Synthetic Evidence Principle

Engineering Evidence preserves what was genuinely observed. Synthetic Engineering Evidence preserves what was intentionally created. Both may contribute to engineering understanding. Neither shall ever be represented as the other.

Synthetic, simulated, replayed, benchmark, fixture, generated and training material shall remain permanently distinguishable from production observational Engineering Evidence. No transformation, persistence, aggregation, replay, publication or Presentation process shall conceal governed source classification.

## 8. Definitions

- **Engineering Data:** Recorded or received information before evidentiary integrity and engineering significance are sufficiently established.
- **Engineering Observation:** Bounded representation of something measured, detected, recorded or reported under a declared context and method.
- **Engineering Evidence:** Observation or governed material whose identity, provenance, boundaries, integrity and limitations are preserved for a declared engineering purpose.
- **Evidence Identity:** Stable governed identity distinguishing one Evidence item.
- **Evidence Revision:** One exact immutable governed state of an Evidence identity.
- **Evidence Provenance:** Governed record of origin, acquisition, custody, transformation and handling.
- **Chain of Custody:** Governed sequence of possession, transfer, storage and handling where integrity may be affected.
- **Evidence Transformation:** Governed operation changing Evidence representation, content, resolution, precision or engineering meaning.
- **Evidence Lineage:** Directional relationship connecting exact Evidence inputs, transformations and outputs.
- **Source Classification:** Governed classification of Evidence origin, including production observational, synthetic, simulated, replayed, benchmark, fixture, generated or training material.
- **Supporting Evidence:** Evidence related to one exact Assertion revision as supporting material.
- **Contradictory Evidence:** Evidence related to one exact Assertion revision as materially inconsistent material.
- **Missing Evidence:** Governed evidence-gap state recording absent or unavailable expected Evidence; it is not itself Evidence.
- **Incomplete Evidence:** Existing Evidence lacking expected content, coverage, provenance, custody, boundaries or integrity material.
- **Conflicting Evidence:** Evidence items whose governed meaning materially disagrees within overlapping scope.
- **Derived Evidence:** Evidence produced from exact upstream Evidence revisions through declared derivation.
- **Transformed Evidence:** Evidence whose representation changes through decoding, conversion, filtering, normalisation, aggregation or another operation.
- **Historical Evidence:** Evidence preserved under the identity, context, method, scope and interpretation effective at a historical boundary.
- **Negative Evidence:** Valid Observation that an expected phenomenon was not detected under conditions capable of detecting it.

## 9. Observation-to-Evidence Transition

An Observation becomes eligible to operate as Evidence only when every applicable integrity property is established or explicitly represented as unknown, incomplete, disputed or conflicted.

Applicable properties include Evidence identity and revision, source identity and classification, acquisition method, temporal and operating boundaries, provenance, transformation, custody, integrity status, scope, applicability, units, reference frames, calibration context, limitations, uncertainty, completeness, lifecycle and preserved source material or an exact immutable reference.

Structural validity does not imply evidentiary integrity. Evidentiary integrity does not imply Authority, Verification, Confidence, admission, publication or Engineering Truth.

## 10. Evidence Roles and Categories

Supporting and Contradictory Evidence are relational roles between exact Evidence and Assertion revisions, not intrinsic Evidence kinds. One Evidence item may support one Assertion, contradict another and remain irrelevant or insufficient for another purpose.

Missing, incomplete and conflicting Evidence remain distinct. Negative Evidence requires demonstrated observation opportunity and detection capability. Absence of data is not Negative Evidence.

## 11. Requirement Record Convention

Each requirement below has revision `1`, lifecycle `Active` and compatibility classification `Foundational`. Applicability, normative force, traceability, expected conformance evidence and assessable conformance criteria are stated independently.

## 12. Normative Requirements

### TS-STD-002-REQ-001 — Evidence Model Separation

**Applicability:** Every material in the Evidence lifecycle. **Normative force:** SHALL / SHALL NOT. **Traceability:** Engineering Constitution; TS-STD-001; Section 5. **Expected evidence:** Domain contracts and negative-promotion tests.

Data, Observation, Evidence, Assertion, Qualification and Truth SHALL remain distinct. No stage SHALL become another merely through processing, storage or publication.

**Conformance criteria:** Every artefact identifies its role and every transition satisfies its governed boundary.

### TS-STD-002-REQ-002 — Data Is Not Evidence

**Applicability:** Every Data item. **Normative force:** SHALL NOT. **Traceability:** Permanent Evidence Model. **Expected evidence:** Intake contracts and invalid-input tests.

Data SHALL NOT be represented as Evidence solely because it exists, is available, has been parsed or resembles expected information.

**Conformance criteria:** Material lacking applicable evidentiary integrity remains Data or an explicit invalid, unknown or incomplete state.

### TS-STD-002-REQ-003 — Bounded Observation

**Applicability:** Every Observation. **Normative force:** SHALL. **Traceability:** Evidence ownership. **Expected evidence:** Observation boundaries and acquisition context.

Every Observation SHALL preserve what was observed, the method and the boundaries outside which no observational claim is made.

**Conformance criteria:** Applicable temporal, subject, operating, measurement and method boundaries are inspectable.

### TS-STD-002-REQ-004 — Observation Is Not Interpretation

**Applicability:** Every Observation and Evidence representation. **Normative force:** SHALL NOT. **Traceability:** Engineering Blueprint Evidence boundary. **Expected evidence:** Consumer audits and negative inference tests.

Observation SHALL NOT infer causation, root cause, reusable meaning, action or recommendation.

**Conformance criteria:** Observed content remains distinct from downstream interpretation.

### TS-STD-002-REQ-005 — Governed Observation-to-Evidence Transition

**Applicability:** Every proposed Evidence item. **Normative force:** SHALL. **Traceability:** Section 9. **Expected evidence:** Integrity assessment and property manifest.

Material SHALL become Evidence only through a governed transition preserving every applicable integrity property or its unresolved state.

**Conformance criteria:** Resulting Evidence identifies exact source, boundaries, provenance, limitations and integrity state.

### TS-STD-002-REQ-006 — Evidence Identity

**Applicability:** Every Evidence item. **Normative force:** SHALL. **Traceability:** TS-STD-004. **Expected evidence:** Identity manifests and collision tests.

Every Evidence item SHALL possess stable identity distinct from source, revision, Representation and storage identity.

**Conformance criteria:** Evidence remains unique without filename, path, database key, array position or display label.

### TS-STD-002-REQ-007 — Evidence Revision Integrity

**Applicability:** Every revision-bearing Evidence item. **Normative force:** SHALL / SHALL NOT. **Traceability:** TS-STD-004. **Expected evidence:** Revision manifests and immutability tests.

Each revision SHALL represent one immutable state and SHALL NOT be reused after material content, source, boundary, transformation, limitation or integrity meaning changes.

**Conformance criteria:** Material change creates a governed successor revision or new Evidence identity.

### TS-STD-002-REQ-008 — Source Identity Preservation

**Applicability:** Every Evidence item. **Normative force:** SHALL / SHALL NOT. **Traceability:** Evidence provenance architecture. **Expected evidence:** Source and acquisition records.

Evidence SHALL preserve exact source identity or an unresolved source state. Names, files, labels and locations SHALL NOT independently establish source identity.

**Conformance criteria:** Source identity is traceable without display-metadata reconstruction.

### TS-STD-002-REQ-009 — Evidence Provenance Integrity

**Applicability:** Every Evidence revision. **Normative force:** SHALL. **Traceability:** TS-STD-004. **Expected evidence:** Provenance and transformation history.

Evidence SHALL preserve applicable origin, acquisition, custody, transformation, validation activity, limitation and correction history.

**Conformance criteria:** Origin and every material handling stage remain traceable.

### TS-STD-002-REQ-010 — Chain-of-Custody Integrity

**Applicability:** Evidence whose handling may affect integrity. **Normative force:** SHALL. **Traceability:** Evidence provenance architecture. **Expected evidence:** Custody and gap records.

Applicable custody SHALL preserve possession, transfer, storage and handling. Gaps SHALL remain visible and SHALL NOT be reconstructed silently.

**Conformance criteria:** Custody continuity or its unresolved boundary is inspectable.

### TS-STD-002-REQ-011 — Transformation Declaration

**Applicability:** Every transformed Evidence item. **Normative force:** SHALL. **Traceability:** Transformation architecture. **Expected evidence:** Transformation identity, version, inputs, parameters and outputs.

Every material transformation SHALL identify exact inputs, method and version, purpose, parameters, ordering, introduced or removed information, precision changes and exact output revision.

**Conformance criteria:** Transformation and material effects are reproducible or truthfully bounded.

### TS-STD-002-REQ-012 — Direct and Derived Evidence Separation

**Applicability:** Every derived or transformed Evidence item. **Normative force:** SHALL NOT. **Traceability:** Evidence lineage. **Expected evidence:** Input lineage and derivation tests.

Derived or transformed Evidence SHALL NOT be represented as directly observed material.

**Conformance criteria:** Consumers distinguish direct Observation from derivation and transformation.

### TS-STD-002-REQ-013 — Transformation Scope Limitation

**Applicability:** Every transformed or derived Evidence item. **Normative force:** SHALL NOT. **Traceability:** Transformation architecture. **Expected evidence:** Input/output scope comparison and loss declarations.

Transformation SHALL NOT create broader observational scope than inputs support.

**Conformance criteria:** Output remains bounded by inputs, method and declared information loss.

### TS-STD-002-REQ-014 — Original Material Preservation

**Applicability:** Evidence derived from source material. **Normative force:** SHALL. **Traceability:** TS-STD-004 historical preservation. **Expected evidence:** Preserved source or immutable source reference.

Original material or an exact immutable reference SHALL be preserved where lawful and technically possible; impossibility remains explicit.

**Conformance criteria:** Derived Evidence remains traceable without fabricated continuity.

### TS-STD-002-REQ-015 — Limitation and Information-Loss Preservation

**Applicability:** Every Evidence item. **Normative force:** SHALL. **Traceability:** Engineering Constitution uncertainty. **Expected evidence:** Limitation manifests and transformation-loss records.

Evidence SHALL preserve applicable limitations, missing coverage, clipping, saturation, truncation, interpolation, filtering, quantisation, conversion, timing, measurement and decoding uncertainty.

**Conformance criteria:** No material limitation or information loss is concealed by processing success.

### TS-STD-002-REQ-016 — Unknown and Unresolved Integrity

**Applicability:** Every Evidence integrity property. **Normative force:** SHALL / SHALL NOT. **Traceability:** TS-STD-001. **Expected evidence:** Unknown outcomes and coercion tests.

Unknown and unresolved integrity SHALL remain first-class and SHALL NOT be replaced by defaults, assumed validity or fabricated values.

**Conformance criteria:** Unknown, invalid, incomplete, unavailable and conflict remain distinct.

### TS-STD-002-REQ-017 — Supporting Evidence Role

**Applicability:** Every supporting Evidence relationship. **Normative force:** SHALL. **Traceability:** Permanent Evidence Model. **Expected evidence:** Exact Evidence and Assertion revision references.

Supporting Evidence SHALL identify the exact Assertion revision, Evidence revision, scope and purpose of support.

**Conformance criteria:** Support remains a governed relationship rather than an intrinsic Evidence kind.

### TS-STD-002-REQ-018 — Contradictory Evidence Role

**Applicability:** Every contradictory Evidence relationship. **Normative force:** SHALL. **Traceability:** TS-STD-001 contradiction preservation. **Expected evidence:** Contradiction and conflict records.

Contradictory Evidence SHALL identify the exact Assertion revision and material contradiction within scope.

**Conformance criteria:** Contradictory material remains visible after Assertion acceptance or publication.

### TS-STD-002-REQ-019 — Missing Evidence Separation

**Applicability:** Every Evidence-gap representation. **Normative force:** SHALL / SHALL NOT. **Traceability:** Evidence categories. **Expected evidence:** Gap identity, expectation basis and missing reason.

Missing Evidence SHALL remain an evidence-gap state and SHALL NOT be represented as observed Evidence.

**Conformance criteria:** Absence of expected Evidence remains distinct from Observation of absence.

### TS-STD-002-REQ-020 — Incomplete Evidence Preservation

**Applicability:** Evidence lacking expected material. **Normative force:** SHALL. **Traceability:** Evidence categories. **Expected evidence:** Completeness findings and gap manifest.

Incomplete Evidence SHALL preserve existing material and identify every known relevant gap.

**Conformance criteria:** Partial material is not presented as complete or wholly missing.

### TS-STD-002-REQ-021 — Conflicting Evidence Preservation

**Applicability:** Evidence disagreeing in overlapping scope. **Normative force:** SHALL / SHALL NOT. **Traceability:** TS-STD-001. **Expected evidence:** Exact conflicting references and rationale.

Conflicting Evidence SHALL remain independently preserved and SHALL NOT be resolved through order, majority, repetition, convenience, aggregation or Presentation.

**Conformance criteria:** Every conflicting item and scope remains inspectable until governed resolution.

### TS-STD-002-REQ-022 — Derived Evidence Lineage

**Applicability:** Every Derived Evidence item. **Normative force:** SHALL. **Traceability:** TS-STD-004. **Expected evidence:** Exact inputs, derivation identity and output revision.

Derived Evidence SHALL preserve directional lineage to every material input and governed method.

**Conformance criteria:** A distinct output cannot appear to be an independent source merely through separate identity.

### TS-STD-002-REQ-023 — Historical Evidence Reproducibility

**Applicability:** Every historical, superseded or withdrawn Evidence item. **Normative force:** SHALL. **Traceability:** TS-STD-001 and TS-STD-004. **Expected evidence:** Historical replay and original method context.

Historical Evidence SHALL remain reproducible according to identity, revision, source, method, boundaries, limitations and historical interpretation.

**Conformance criteria:** Later understanding does not silently rewrite what was observed or historically governed.

### TS-STD-002-REQ-024 — Negative Evidence Validity

**Applicability:** Every claim of non-observation. **Normative force:** SHALL / SHALL NOT. **Traceability:** Evidence categories. **Expected evidence:** Detection capability, opportunity, threshold and scope.

Negative Evidence SHALL require demonstrated opportunity and capability to observe. Missing data, unavailable instruments, unexecuted tests and source silence SHALL NOT become Negative Evidence.

**Conformance criteria:** Every non-detection identifies how detection would have occurred.

### TS-STD-002-REQ-025 — Governed Source Classification

**Applicability:** Every Evidence item. **Normative force:** SHALL. **Traceability:** Founder synthetic-Evidence amendment. **Expected evidence:** Source classification and provenance.

Every Evidence item SHALL preserve exact source classification, including distinctions among production observational, synthetic, simulated, replayed, benchmark, fixture, generated and training material.

**Conformance criteria:** Source class remains inspectable throughout the lifecycle.

### TS-STD-002-REQ-026 — Non-Production Evidence Non-Promotion

**Applicability:** Every non-production Evidence item. **Normative force:** SHALL NOT. **Traceability:** Engineering Evidence Principle. **Expected evidence:** Transformation, persistence and consumer audits.

Non-production Evidence SHALL NOT be represented as production observational Evidence. Transformation, persistence, aggregation, replay, publication and Presentation SHALL NOT silently reclassify it.

**Conformance criteria:** Non-production origin remains visible across every authorised boundary.

### TS-STD-002-REQ-027 — Production Observation Fidelity

**Applicability:** Every production observational Evidence item. **Normative force:** SHALL. **Traceability:** Engineering Evidence Principle. **Expected evidence:** Production source, method and context.

Production observational Evidence SHALL preserve exact source, acquisition method, subject, context and observation boundary.

**Conformance criteria:** Production Observation remains distinguishable from replayed, simulated, generated or reconstructed material.

### TS-STD-002-REQ-028 — Copies Are Not Independent Corroboration

**Applicability:** Duplicated, reproduced or commonly sourced Evidence. **Normative force:** SHALL NOT. **Traceability:** Provenance and lineage. **Expected evidence:** Dependency analysis and common-lineage records.

Copies, repeated citations, transformations and records sharing one material source SHALL NOT be represented as independent corroboration.

**Conformance criteria:** Independence claims require distinct provenance and material independence.

### TS-STD-002-REQ-029 — Evidence Does Not Establish Authority or Truth

**Applicability:** Every Evidence producer and consumer. **Normative force:** SHALL NOT. **Traceability:** TS-STD-001 and Engineering Standards Ecosystem. **Expected evidence:** Boundary contracts and promotion tests.

Evidence existence, integrity, volume, repetition, publication or Registry membership SHALL NOT independently establish Authority, Verification, Confidence, Qualification or Truth.

**Conformance criteria:** Downstream statuses arise only through their governed owners.

### TS-STD-002-REQ-030 — Artificial Intelligence Source Preservation

**Applicability:** AI-generated, selected, summarised or transformed material. **Normative force:** SHALL / SHALL NOT. **Traceability:** TS-STD-001 AI prohibition. **Expected evidence:** Generator identity, method version and input lineage.

AI-originated material SHALL preserve generated or transformed source classification and lineage and SHALL NOT become direct production Observation through plausibility or repetition.

**Conformance criteria:** AI participation remains identifiable in every downstream Representation.

### TS-STD-002-REQ-031 — Evidence Correction and Supersession

**Applicability:** Corrected, superseded, rejected or withdrawn Evidence. **Normative force:** SHALL / SHALL NOT. **Traceability:** Evidence Integrity Supremacy; TS-STD-004. **Expected evidence:** Correction rationale and predecessor-successor revisions.

Evidence correction or supersession SHALL preserve predecessor identity, revision, provenance, rationale and boundary. Earlier Evidence SHALL NOT be destructively rewritten.

**Conformance criteria:** Current Evidence and historical predecessors remain independently reproducible.

### TS-STD-002-REQ-032 — Consumer Evidence Fidelity

**Applicability:** Every Evidence consumer. **Normative force:** SHALL / SHALL NOT. **Traceability:** Cross-domain ownership. **Expected evidence:** Consumer contracts and reasoning audits.

Consumers SHALL preserve Evidence identity, revision, classification, provenance, boundaries, limitations, uncertainty, incompleteness and conflict and SHALL NOT strengthen, generalise, reconstruct or omit material limitations.

**Conformance criteria:** Consumer outputs resolve to exact Evidence and preserve its governing limitations.

## 13. Evidence Evolution

Evidence evolution preserves history. A new physical or runtime acquisition normally creates new Evidence. A new revision may correct or extend the governed representation of the same acquisition without changing its enduring referent.

Candidate, provisional, integrity-validated, incomplete, disputed, conflict, rejected, deprecated, superseded, withdrawn and historical lifecycle conditions remain distinguishable from Authority, Verification, Confidence, applicability, availability, Truth, admission and publication.

## 14. Consumer Obligations

Consumers preserve exact Evidence identity, revision, classification, provenance, lineage, boundaries, limitations, missing, incomplete and conflicting states. Direct, derived and transformed Evidence remain distinct. Dependent sources are not counted as independent. Consumers cite the exact Evidence consumed and do not reconstruct missing attributes.

## 15. Cross-Standard Boundaries

TS-STD-001 owns Engineering Truth. TS-STD-004 owns universal Identity, Provenance and Traceability obligations. TS-STD-003 will own Qualification, Authority, Verification and Confidence. TS-STD-005 will own semantic integrity. TS-STD-006 will own admission and publication integrity.

TS-STD-002 governs Evidence integrity without assuming those responsibilities.

## 16. Non-Ownership

TS-STD-002 does not define Engineering Truth, Engineering Assertions, Qualification, Authority, Verification, Confidence, Ontology, Vocabulary, Knowledge admission, publication, Registry implementation, Explanation, Decision, Presentation, APIs, schemas, persistence or runtime technology.

## 17. Conformance

Potential subjects include Evidence Architecture and contracts, Evidence records, telemetry and measurement pipelines, diagnostic and binary observations, source adapters, transformations, historical Evidence stores, Evidence packages, consumers, synthetic fixtures, replay and simulation systems and training datasets.

Assessments identify exact subject and version, this Standard version, applicable requirement revisions, method, evidence, authority, findings, exceptions and outcome.

Passing tests may demonstrate preservation of integrity obligations. They do not prove that an Observation accurately represents engineering reality.

## 18. Expected Conformance Evidence

Expected evidence may include Evidence contracts, identity and revision manifests, source classifications, provenance and custody, transformation specifications, exact lineage, original-source preservation, observation boundaries, limitation and loss declarations, immutability, Negative Evidence validation, conflict preservation, independence analysis, historical replay, consumer audits and source-classification validation.

## 19. Compatibility and Evolution

The initial requirements are foundational. Material changes to lifecycle boundaries, identity, revision, classification, provenance, custody, transformation semantics, Evidence categories, Negative Evidence, historical interpretation or consumer obligations require governed compatibility review.

Migration preserves exact identity, revisions, provenance, classification and historical meaning. Correction cannot silently strengthen Evidence or conceal former limitations.

## 20. Permanent Prohibitions

Prohibited conduct includes fabricated or silently altered Evidence; undocumented transformation; source laundering; provenance stripping; custody concealment; copied Evidence presented as independent; transformed Evidence presented as direct Observation; inference presented as Observation; missing material presented as Negative Evidence; absence of contradiction presented as support; workflow, testing, build, write or deployment status presented as Evidence without a governed relationship; database-derived integrity; label-derived source identity; Confidence presented as Evidence integrity; Authority presented as observational accuracy; hidden conflict or information loss; default substitution; destructive historical rewriting; non-production material presented as production Observation; AI material presented as observed without classification and lineage; and consumer reconstruction of missing provenance or boundaries.

## 21. Requirement Manifest

| Requirement | Title | Revision | Lifecycle | Compatibility |
|---|---|---:|---|---|
| TS-STD-002-REQ-001 | Evidence Model Separation | 1 | Active | Foundational |
| TS-STD-002-REQ-002 | Data Is Not Evidence | 1 | Active | Foundational |
| TS-STD-002-REQ-003 | Bounded Observation | 1 | Active | Foundational |
| TS-STD-002-REQ-004 | Observation Is Not Interpretation | 1 | Active | Foundational |
| TS-STD-002-REQ-005 | Governed Observation-to-Evidence Transition | 1 | Active | Foundational |
| TS-STD-002-REQ-006 | Evidence Identity | 1 | Active | Foundational |
| TS-STD-002-REQ-007 | Evidence Revision Integrity | 1 | Active | Foundational |
| TS-STD-002-REQ-008 | Source Identity Preservation | 1 | Active | Foundational |
| TS-STD-002-REQ-009 | Evidence Provenance Integrity | 1 | Active | Foundational |
| TS-STD-002-REQ-010 | Chain-of-Custody Integrity | 1 | Active | Foundational |
| TS-STD-002-REQ-011 | Transformation Declaration | 1 | Active | Foundational |
| TS-STD-002-REQ-012 | Direct and Derived Evidence Separation | 1 | Active | Foundational |
| TS-STD-002-REQ-013 | Transformation Scope Limitation | 1 | Active | Foundational |
| TS-STD-002-REQ-014 | Original Material Preservation | 1 | Active | Foundational |
| TS-STD-002-REQ-015 | Limitation and Information-Loss Preservation | 1 | Active | Foundational |
| TS-STD-002-REQ-016 | Unknown and Unresolved Integrity | 1 | Active | Foundational |
| TS-STD-002-REQ-017 | Supporting Evidence Role | 1 | Active | Foundational |
| TS-STD-002-REQ-018 | Contradictory Evidence Role | 1 | Active | Foundational |
| TS-STD-002-REQ-019 | Missing Evidence Separation | 1 | Active | Foundational |
| TS-STD-002-REQ-020 | Incomplete Evidence Preservation | 1 | Active | Foundational |
| TS-STD-002-REQ-021 | Conflicting Evidence Preservation | 1 | Active | Foundational |
| TS-STD-002-REQ-022 | Derived Evidence Lineage | 1 | Active | Foundational |
| TS-STD-002-REQ-023 | Historical Evidence Reproducibility | 1 | Active | Foundational |
| TS-STD-002-REQ-024 | Negative Evidence Validity | 1 | Active | Foundational |
| TS-STD-002-REQ-025 | Governed Source Classification | 1 | Active | Foundational |
| TS-STD-002-REQ-026 | Non-Production Evidence Non-Promotion | 1 | Active | Foundational |
| TS-STD-002-REQ-027 | Production Observation Fidelity | 1 | Active | Foundational |
| TS-STD-002-REQ-028 | Copies Are Not Independent Corroboration | 1 | Active | Foundational |
| TS-STD-002-REQ-029 | Evidence Does Not Establish Authority or Truth | 1 | Active | Foundational |
| TS-STD-002-REQ-030 | Artificial Intelligence Source Preservation | 1 | Active | Foundational |
| TS-STD-002-REQ-031 | Evidence Correction and Supersession | 1 | Active | Foundational |
| TS-STD-002-REQ-032 | Consumer Evidence Fidelity | 1 | Active | Foundational |

## 22. Governance Effect

TS-STD-002 is the authoritative Engineering Evidence Integrity Standard for TuneSight. Future Engineering Standards shall remain consistent with it where applicable.

This ratification grants no implementation, runtime, admission, publication, Registry, schema, API, persistence, production Evidence or production Knowledge authority.
