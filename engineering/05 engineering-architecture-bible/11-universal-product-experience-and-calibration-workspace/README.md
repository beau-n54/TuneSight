# Universal Product Experience and Universal Calibration Workspace — ratified architecture

**RATIFIED ARCHITECTURE — IMPLEMENTATION REQUIRES SEPARATE FOUNDER AUTHORITY**

**Ratification:** [TS-RAT-024](../../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-024) — Founder approval: 20 September 2026.

Ratified by Founder on 20 September 2026 under TS-RAT-024 following Founder and Bob’s final audit. Baseline: `840b75d444f67e22c6003202ebb39e7c17cb403d` — `Enforce fail-closed Calibration sessions`. This set establishes architecture and acceptance contracts only. It authorises no implementation and records no new engineering qualification. “Must” below describes the ratified contract; implementation requires separate Founder authority.

## Universal Product Experience invariant

**Controlling TuneSight-wide product rule:** Every admitted platform receives the same fundamental product-interface structure, navigation and interaction model across Vehicle Dashboard, Logs and Log History, Analysis, Calibration, Live Telemetry, future BMW Coding, future Diagnostics, and future professional and dyno evidence surfaces. Platform, engine, DME, ROM, chassis, source format and evidence availability may change data and capability states, but must not create unrelated versions of the TuneSight product.

Calibration is the first domain in which this invariant is being formally applied. The Calibration-specific expression below remains intact. This programme defines no implementation contract for the other domains; each requires its own bounded architecture and migration programme.

> Every platform and vehicle admitted to TuneSight receives the same fundamental Calibration Workspace structure, navigation and interaction model. Engine, DME, ROM, source container, evidence qualification and capability availability may change the data and available actions, but must not create a fundamentally different workspace.

The invariant applies to N13, N20, N26, N54, N55, S55, B48, B58 Gen1, B58 Gen2, S58, S63, Toyota Supra B58, every other admitted platform and future admissions. Inclusion in this list does not claim exact-ROM coverage, EDIT, telemetry or any other capability. Admission and capability remain independent.

The same invariant serves everyday enthusiasts and professional tuners. Standard and Engineer are presentation modes, not subscription tiers. Starter is intended to provide a simplified enthusiast product experience and may have a smaller entitled feature set. Pro contains the complete individual engineering and calibration capability authorised for the user. Workshop retains Pro’s engineering capability and adds professional business workflow. Entitlement may permit or restrict entry and actions, but cannot alter engineering truth, qualify evidence or manufacture capability. If a tier is entitled to enter a shared domain, it must not receive contradictory engineering results or an unrelated platform-specific product. Customer/staff context may surround the workspace but must not fork its core. Pricing, final Starter Calibration access and commercial quotas are not defined here.

Recognisably TuneSight means a clean, modern BMW-oriented visual language, restrained BMW framing, clear typography, one dominant Table surface and progressive disclosure. Professional completeness must coexist with understandable language. These are presentation requirements, not permission to copy a traditional editor or conceal uncertainty.

## Reading map and required artefacts

| Document | Review content |
|---|---|
| [Shell, evidence and identity](01-shell-evidence-identity.md) | Universal shell; capability/evidence matrix; authority boundaries; persistence and responsive behavior |
| [Universal Table presentation](02-table-presentation.md) | Shared renderer contract, actual axes, layers, linked interaction, Raw Representation |
| [Modes, navigation and guidance](03-modes-navigation-guidance.md) | Standard/Engineer; systems/search; explicit decisions for Related Tables, Understand and unavailable semantics |
| [Professional and dyno boundaries](04-professional-dyno-boundaries.md) | Workshop compatibility, exact lineage, Analysis/telemetry handoffs, adapter-neutral dyno evidence |
| [Acceptance and regression matrix](05-acceptance-regression.md) | Deterministic, component, browser and Founder validation oracles |
| [Incremental work-package sequence](06-migration-work-packages.md) | Bounded slices, dependencies, rollback boundaries and first recommended slice |
| This document | Product invariant, source hierarchy, risks, unresolved decisions and Founder audit questions |

## Controlling sources and status interpretation

The [Founder Vision](../../00-founders-vision.md), [Constitution](../../02-engineering-constitution.md), [Blueprint](../../04-engineering-blueprint.md) and [Production Contract](../../06-production-contract.md) remain controlling. The [Architecture Bible](../README.md), [Cross-Domain Engineering Contracts](../00-cross-domain-engineering-contracts.md) and [Presentation](../09-presentation.md) are read with the recorded [TS-RAT-003 ratification](../../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-003), despite older draft wording in some chapter headers. This programme does not reconcile those headers.

[Vehicle Admission and Capability Independence](../10-vehicle-admission-independence.md), ratified under [TS-RAT-023](../../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-023), controls independent capabilities. [TS-STD-004](../../engineering-standards/TS-STD-004-engineering-identity-provenance-traceability-standard.md), [TS-STD-005](../../engineering-standards/TS-STD-005-engineering-semantic-integrity-standard.md) and [TS-STD-006](../../engineering-standards/TS-STD-006-engineering-knowledge-admission-publication-integrity-standard.md) control exact identity, meaning, admission and publication. These links delegate authority; this architecture does not duplicate or expand their qualification rules.

Implementation/validation records, not new ratification: [WP-004.3.15](../../08-engineering-work-packages/WP-004.3.15-calibration-workshop-presentation.md) records the shared visual direction and physical presentation validation; [WP-004.3.28](../../08-engineering-work-packages/WP-004.3.28-calibration-export-foundation.md), [WP-004.3.29](../../08-engineering-work-packages/WP-004.3.29-calibration-export-readiness.md) and [WP-004.3.30](../../08-engineering-work-packages/WP-004.3.30-n54-b58-checksum-qualification.md) record reconstruction, the separate source lease and checksum blocks. Historical statements are read in their original scope, not as a declaration that later accepted behavior does not exist.

## Ratified invariants

1. One shell and one interaction vocabulary for every admitted vehicle; missing capability occupies its normal location with an explicit reason.
2. One owner per engineering truth. Presentation and orchestration consume qualified outputs and never manufacture applicability, units, axes, semantics or safety judgments.
3. Current stays immutable; Working stays separate, sparse, exactly bound and governed; Suggested is a distinct reserved state, never an automatic mutation.
4. Reference, comparison, VIEW, EDIT, RECONSTRUCT, Export and Flash authority remain independent. Export remains checksum/integrity locked and Flash unavailable.
5. A plot is a faithful presentation of exact cells and supplied axis evidence. Reference availability does not determine renderer quality.
6. Mode, panel, tab and view changes cannot change engineering results or discard Working/history.
7. Explicit session-token failure cannot resolve another session, vehicle-role recovery or Development Preview. Browser restoration cannot override this boundary.
8. Unknown, unavailable, conflict, candidate, quarantine and operational failure remain distinguishable; no appearance of capability without authority.
9. Workshop tenancy, permissions and commercial entitlements may restrict entry and actions; none upgrades engineering authority or forks the core workspace.
10. Dyno measurements, DME telemetry and TuneSight-derived calculations retain distinct source identities and provenance.

## Baseline observations versus proposed changes

At the accepted checkpoint, comparison and Current-only have separate clients. Shared tab identity, sparse mutation/persistence engines, Engineering Navigation, terminology and layout modules already exist. Current-only uses a flattened polyline with a perspective tilt; comparison has slices and an orbitable surface. Comparison axis construction also contains dimension-matching and index fallbacks: existing behavior is not itself proof of governed physical axis assignment. Migration must audit both paths.

Working persistence is currently browser-local and replay-validated; it is not team storage. Durable subscriber view sessions and the private Source Binary Reconstruction Lease are different lifetimes and contracts. The three held source-text tests remain failing at this checkpoint. No claim of acceptance-test implementation or browser validation is made by these documents.

## Risks and unresolved decisions

| Risk / decision | Proposed disposition and audit question |
|---|---|
| Axis ownership, equal-sized X/Y dimensions, missing axes | Founder approved strict geometry: disable unsupported 2D/3D and retain truthful Grid where qualified values exist. Owner-supported orientation/coordinates/topology still require validation. |
| Semantics lack structured absence reasons | Preserve existing `unavailableReason`; add producer-owned reason metadata only in a separately authorised contract slice. Which review owner can publish each new reason? |
| Browser-only Working can be lost or conflict between windows | Retain the browser store through U0–U6 unless a separate persistence programme is authorised. Governed server revision/collaboration is a mandatory future Workshop production-completion gate; detailed policy and design remain separate. |
| Duplicate clients conceal subtle parity differences | Baseline N54 and B58/Supra behavior before replacing either; retain reversible presentation dispatch until parity is accepted. |
| Dense controls on smaller screens | Founder approved desktop/laptop full editing, tablet review by default and phone read-only review. Exact viewport thresholds and interaction validation remain bounded follow-up work. |
| Default mode and first-open layout | Founder approved Standard for a new user/profile and remembering explicit mode selection. Progressive-disclosure density remains for localhost review. |
| Tab limit and cache budget | 12 open tabs and six derived Tables are provisional migration bounds, not permanent professional limits. Require explicit capacity decisions and protect unapplied input, Working changes and relevant history; future capacity requires measurement and professional review. |
| Team ownership and customer consent | Organisation/customer custody model, roles, retention and permission policy need separate review; no database or tenancy model is approved here. |
| Dyno association ambiguity | Distinguish user-declared revision from verified installed/flashed lineage; retain uncertain associations. Required correction formats and provider adapters remain undecided. |
| Professional numerical fidelity and performance | Keep exact values through presentation; accept budgets only against measured controlled workloads. No hidden decimation or precision reduction. |

## Founder decisions required

Founder and Bob accepted the core direction subject to the bounded clarifications recorded in this amended set. Founder approved strict geometry, Standard as the new-user/profile default, the desktop/laptop/tablet/phone policy and U0 Shared Contract Projection as the first slice in principle. U0 may begin only after architecture ratification and a separately issued implementation instruction. These decisions are now architecture-ratified under TS-RAT-024; they grant no implementation authority.

Founder ratification is recorded under TS-RAT-024; the governance package remains subject to Founder and Bob’s final diff review. Detailed owner-output extensions, team persistence/security/retention/customer-consent policy, measured professional capacity and localhost layout validation remain separately bounded decisions. Future architectural amendments, dependency changes and release decisions remain separately authorised actions.

No direct dyno control, DTC execution, Flash, checksum implementation, Suggested generation, team database schema, pricing enforcement or application/test alteration belongs to this governance reconciliation task.
