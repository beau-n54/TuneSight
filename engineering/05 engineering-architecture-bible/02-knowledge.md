This document forms part of TuneSight's Engineering Governance Framework.

**Authority:** Derived from the Engineering Blueprint

**Status:** Consolidated Draft for Founder Review

# TuneSight Engineering Architecture Bible

## Engineering Domain 02 — Knowledge

## Engineering Intent and Purpose

Knowledge is the authoritative owner of reusable Engineering Truth. Engineering Knowledge is the canonical representation through which reusable truth retains meaning, context, authority and availability.

Knowledge preserves Engineering Context: the relationships and surrounding meaning that allow individual truths to remain understandable, reusable and correctly interpreted. Where authoritative Knowledge is unavailable, the boundary remains visible and the unknown remains unknown.

## Authoritative Ownership

Knowledge solely owns canonical reusable Knowledge Objects, Knowledge Relationships, reference truth, provenance, verification state, confidence, version, lifecycle, conflict and supersession.

Knowledge does not own the current system's Engineering Identity, runtime Evidence, analysis-specific Correlation, Explanation, Decision, user-specific Memory, Evolution proposals or Presentation.

## Engineering Ontology

Engineering Ontology is a permanent architectural layer within Knowledge. It defines the canonical categories of engineering reality recognised by TuneSight and answers: **What kind of engineering thing exists?**

It does not define what a concept is called, where it is implemented or what Evidence currently supports it. Governed Vocabulary owns terminology. Knowledge Entities instantiate governed ontology classes. Engineering Assertions make qualified claims about those entities. Evidence supports or contradicts those claims.

```text
Engineering Ontology
    ↓
Governed Vocabulary
    ↓
Knowledge Entities
    ↓
Engineering Assertions
    ↓
Evidence
```

Ontology governs engineering existence. Vocabulary governs engineering language. Knowledge governs engineering truth. Evidence governs engineering support. Explanation governs analysis-specific reasoning. Decision governs engineering action. Presentation governs engineering communication.

Reality exists independently of TuneSight. Ontology models that reality; TuneSight does not invent it.

### Ontology Stability and Governance

Engineering Ontology is expected to evolve more slowly than the layers built upon it. It changes only when the governed engineering model of reality itself requires revision.

Every Ontology revision requires explicit architectural review and Founder ratification. No Knowledge Entity, Engineering Assertion, Vocabulary term, Evidence source, implementation type or consumer may redefine engineering reality or introduce an ungoverned ontology class.

Engineering reality shall remain stable while engineering language may evolve and qualified engineering truth may grow. Those three concepts remain distinct.

## Responsibilities

- Register and publish canonical reusable engineering truth.
- Preserve evidence, provenance, discovery source and transformation history.
- Maintain canonical Engineering Relationships as first-class Knowledge.
- Preserve verification, confidence, conflict, lifecycle and version.
- Support authoritative lookup without fabricating missing metadata.
- Admit new truth only through governed acquisition.
- Support Vehicle Identity and downstream Domains without assuming their responsibilities.

## Boundaries and Domain Relationships

[Vehicle Identity](01-vehicle-identity.md) owns the identity of the current system; Knowledge provides the authoritative reusable truth from which that identity is established.

Evidence owns validated runtime observations. Correlation owns analysis-specific relationships. Explanation owns reasoning. Decision owns guidance. Memory owns analysis-specific history. Evolution proposes governed improvements. Presentation communicates outputs.

Receipt of an input does not confer authority. Knowledge shall not diagnose, recommend, present conclusions, convert weak inference into truth, or let runtime learning write directly into authoritative Knowledge.

## Inputs and Outputs

Inputs may include verified binaries, fingerprints, hashes, sizes, ROM and calibration data, ECU and platform identity, XDF metadata, authoritative documentation, Founder Validation, controlled discoveries and governed Evolution proposals.

Outputs include canonical Knowledge Objects and Relationships, lookups, evidence, provenance, verification, confidence, version, lifecycle, conflict, supersession and explicit unknown state.

Vehicle Identity, Evidence, Correlation, Explanation, Decision, Memory, Evolution and Presentation may consume Knowledge without redefining it.

## Knowledge Object

A Knowledge Object is the smallest independently identifiable reusable engineering concept or truth that TuneSight can register, relate, verify, version and expose.

Where applicable it preserves stable identity, type, canonical meaning, relationships, evidence, provenance, verification, confidence, version, lifecycle, conflict, timestamps and metadata. Unknown fields remain unknown.

Internal categories may include vehicle, binary, ROM, calibration, ECU, platform, hardware, fuel system, transmission, diagnostic, root-cause reference, evidence reference, relationship, rule, validation, historical and learning Knowledge. These are classifications, not new Engineering Domains.

## Knowledge Relationships

Relationships are first-class Knowledge, not incidental attributes. A relationship preserves source, target, direction, meaning, authority, provenance, evidence, confidence, verification, version and lifecycle where applicable.

Meanings may include belongs to, contains, variant of, compatible with, identified by, verified by, supported by, derived from, applies to, supersedes, differs from, requires, calibrated for and installed on.

Name, filename, directory or family similarity shall not establish a relationship.

## Stock Variant Knowledge

Stock Variant is a first-class Knowledge Object representing one independently verifiable factory binary variant.

```text
One ROM Family
    |
    +-- Multiple Verified Factory Stock Variants
```

A Stock Variant may preserve SHA-256, byte length, ROM Family, ECU, DME variant, platform, I-Level, software version, Calibration ID, manufacturing revision, region, emissions specification, transmission, verification, evidence, checksum and XDF relationships.

Exact verified binary identity takes precedence over filename, directory and family assumptions. ROM Family membership does not prove exact Stock Variant identity. Materially different factory binaries are distinct objects, not destructive replacements.

## Truth Qualification

Verification states may include Unknown, Observed, Candidate, Provisional, Verified, Founder Verified, Authoritatively Verified, Disputed, Rejected, Superseded and Deprecated. Controlled vocabulary shall remain governed.

Authority identifies who may establish truth. Evidence supports an assertion. Verification records an authorised validation result. Confidence expresses strength of support. Provenance records origin and transformation. These remain distinct.

Confidence is scoped to a specific assertion, explainable and never manufactures authority. It shall not be copied or increased through aggregation, availability or repeated assertion. Any derived confidence requires an explicit authoritative rule, traceable evidence and an explanation of its relationship to required dependencies. This chapter defines no universal confidence formula.

## Provenance, Conflict and Lifecycle

Authoritative Knowledge requires sufficient provenance to trace source, discovery, transformation and validation. Conflicting evidence remains visible until authorised resolution.

Historical truth is preserved. Correction, enrichment, supersession, deprecation, rejection, conflict resolution, metadata completion, relationship addition and evidence addition remain distinguishable. Stable concepts retain identity; materially different variants receive new identity.

## Acquisition and Publication

The governed lifecycle is observation, candidate identification, evidence collection, provenance registration, validation, verification, object or relationship registration, confidence assessment, authorised review and publication.

Published Knowledge is canonical, versioned, traceable, queryable, scoped, confidence-aware and verification-aware. Candidate, disputed, rejected, superseded and deprecated states remain distinguishable.

## Contract Obligations

Knowledge exchanges follow the [Cross-Domain Engineering Contracts](00-cross-domain-engineering-contracts.md). Consumers use published outputs rather than inspect library internals or reconstruct authority from filenames, storage paths or persistence.

## Failure Behaviour

Knowledge preserves verified truth, qualifies candidates, exposes conflicts and returns the strongest valid result without concealing ambiguity. It never guesses metadata, invents relationships or fabricates Stock classification.

## Validation and Evolution

Validation shall cover exact hashes and sizes, multiple Stock Variants within one family, known N54 and B58 datasets, unknown and conflict cases, provenance, relationship integrity, version preservation and Vehicle Identity regression.

Future expansion may add platforms, variants, calibration relationships, checksum intelligence, software lineage, regional knowledge and governed learning while preserving existing truth and Domain boundaries.

## Closing Responsibility

Knowledge preserves authoritative reusable Engineering Truth so TuneSight can grow in understanding without corrupting what it already knows.
