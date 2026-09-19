# Standard/Engineer, Engineering Navigation and held presentation contracts

**RATIFIED ARCHITECTURE — IMPLEMENTATION REQUIRES SEPARATE FOUNDER AUTHORITY**

**Ratification:** [TS-RAT-024](../../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-024) — Founder approval: 20 September 2026.

Part of the [ratified programme](README.md). All three decisions below are ratified contracts for later authorised implementation and acceptance testing. They neither alter the held tests nor assert that their expectations currently pass.

## One terminology and presentation contract

Both modes consume the same immutable Table model, semantic binding, capability envelope and Working projection. A mode switch is a local presentation action. It cannot reload the Dataset/session, reset Working, clear tabs, change active Definition/occurrence or selected cells, lose mutation history, change units numerically or alter any engineering result.

Founder approved Standard as the default for a new user or profile. After an explicit user selection, TuneSight may remember Standard or Engineer as a presentation preference. Switching never alters evidence, identity, values, capabilities, Working state, tabs, selected cells, mutation history or engineering results.

Standard and Engineer are presentation modes, not subscription tiers. Starter is intended to provide a simplified enthusiast product experience and may have a smaller entitled feature set. Pro contains the complete individual engineering and calibration capability authorised for the user; Workshop retains Pro’s engineering capability and adds professional business workflow. Entitlement may permit or restrict entry and actions but cannot alter engineering truth, qualify evidence or manufacture capability. Any tier entitled to enter a shared domain receives consistent engineering results and the same fundamental product model, never an unrelated platform-specific product. Pricing, final Starter Calibration access and commercial quotas remain outside this architecture.

| Surface | Standard | Engineer | Shared obligation |
|---|---|---|---|
| Table title and axes | Qualified concise names where available; source fallback explicitly labelled | Source terminology, symbols and source units prominent | Preserve exact Definition identity; never create a semantic alias from prose/title similarity |
| Guidance | Understand prioritises qualified plain-language explanation | Engineering Detail prioritises assertion revisions, applicability, provenance, authority and limitations | Both disclosures accessible in both modes; neither hides conflict or absence |
| Numerical values | Readable formatting with exact-value inspection | Source precision and representation readily available | Same underlying values, mutation result and comparison authority |
| Density | Fewer expanded disclosures, clear primary controls | Denser identity/provenance fields and efficient controls | Same actions and keyboard model; no engineering feature removed by mode |
| Capability and validation | Plain-language reason plus technical detail disclosure | Full supplied reason and scope | BLOCKED, WARNING, quarantine, save failure and Export/Flash limits never concealed |

Reuse [calibrationTerminology.ts](../../../lib/calibration-workshop/calibrationTerminology.ts) as the shared presentation owner, preserving exact-qualified label gating. Where it currently consumes prose-based qualification hints, a future owner-published structured qualification field should replace consumer inference under explicit contract review. This architecture does not change runtime terminology mappings. Pro and Workshop are subscription/workflow packaging; Standard and Engineer are not tiers or permission levels.

## Engineering Navigation

Keep All Tables complete for admitted Definition records, including explicit unavailable/quarantined records; it does not imply all values are viewable. Tuning Essentials is a qualified subset, not a substitute for the Explorer. Systems may contain many Tables and a Table may have multiple independently qualified memberships. The seven universal systems are:

1. Boost and Air Control
2. WGDC and Turbo Control
3. Load and Torque
4. Fueling and Lambda
5. Ignition and Timing
6. IAT and Temperature Compensation
7. Protection, Safety and Limiters

Do not force every Definition into these systems. Preserve `ENGINEERING_QUALIFIED`, `SOURCE_DERIVED_CANDIDATE` and `UNCLASSIFIED` as visibly different classification outcomes under the existing [navigation contract](../../../lib/calibration-workshop/engineeringNavigation.ts). Candidate classification is never authoritative education, engineering-intent search authority or Essential status. Future governed systems may extend navigation without inventing membership from titles.

Changed must distinguish Working-versus-Current from qualified Current-versus-Reference differences. Without Reference, Working changes remain available and comparison changes are unavailable, not zero. Evidence filters expose independent VIEW/EDIT/reconstruction, quarantine, unresolved and semantic qualification states. Counts and “no matches” refer to the active scope; “no qualified Knowledge” is a different empty state.

Literal source-title and key search works independently of semantic coverage and mode. Qualified engineering-intent search consumes published exact-scoped aliases, systems and assertions only. Search results retain original identities and source titles; searching cannot admit a Definition, expand ROM applicability or promote a candidate. Related navigation and search activate/open exact tabs through the same command path.

## Held decision H1 — Related Table

**Decision:** Provide a persistent Related Tables disclosure in Table Information, using a singular “Related Table” item label where appropriate. Populate navigable relationships only from active, admitted/published, qualified relationship assertions with exact source applicability and resolved target identity.

A qualifying edge records assertion identity/revision, relationship kind/direction, source and target Knowledge/Definition identities, exact ROM and Definition-revision applicability, verification/authority, provenance, limitations and lifecycle. The target must resolve to an exact Definition occurrence in the active authorised Dataset; if several occurrences remain plausible, require explicit selection from supplied exact candidates rather than guessing. A target in another Dataset requires an explicit separately authorised context transition, not an automatic switch of Current.

Titles, aliases, proximity, engineering-system co-membership or similar prose alone cannot establish an edge. A shared system is a navigation membership, not proof that two Tables interact. Expired/superseded/conflicting/candidate edges are not presented as qualified navigation.

Activating a qualified same-Dataset edge opens or focuses its existing tab, retains other tabs under the [protected-state capacity contract](01-shell-evidence-identity.md#provisional-capacity-and-protected-state), preserves Working/history and source tab selection, and does not reload the provider. At capacity, an explicit user decision precedes opening; no protected Table is silently evicted. A pending cell input must be committed through validation or explicitly cancelled before switching; it cannot disappear silently. No Workspace route replacement or new session is required.

No qualified edge: show “No qualified Related Tables for this exact Definition/ROM.” A known edge with unavailable target shows its owner-supplied reason and disabled navigation. An ambiguous target offers only explicit exact choices if available. Do not replace absence with title search results under a Related Tables label.

## Held decision H2 — Understand

**Decision:** Add an Understand disclosure alongside Engineering Detail, available for every selected Table regardless of mode or evidence layout. It is an educational projection of qualified assertion-scoped Knowledge, not generated tuning advice.

| Educational question | Permitted source |
|---|---|
| What this Table controls / What this Table does | Qualified controls/calibration-role assertions |
| Why it matters | Qualified purpose/interaction assertions |
| When it is used | Exact applicable operating-context assertions |
| How to read it | Qualified axis/output meaning and reading guidance, plus separately labelled structural information |
| Common risks / Important consideration | Qualified engineering considerations and limitations; absence means not established |
| Related systems | Qualified system memberships, distinct from Related Table edges |
| Telemetry to inspect | Qualified telemetry relationships; not inferred from a familiar Channel label |
| Evidence confidence and limitations | Assertion-level verification, scoped confidence where supplied, provenance and limitations |

If a field has no qualified value, show the corresponding absence reason or a concise “Not yet established” state. Do not fabricate “safe ranges,” directional recommendations or ideal values. Structural facts such as dimensions remain available even when interpretation is missing. Confidence is never promoted to verification. Source descriptions remain clearly attributed source text, not automatically canonical education.

Standard opens the understandable summary first; Engineer makes source identity, revisions, units, authority and provenance readily available. Both retain the same qualified explanation and limitations. The future acceptance test must inspect rendered educational fields and provenance, not merely find the word “Understand” in a file.

## Held decision H3 — semantic.unavailableReason

**Decision:** Never render a blank semantic section in place of an unavailable interpretation. Consume the existing binding's `unavailableReason` and qualification state. Preserve the exact supplied reason in Engineering Detail; a stable plain-language label may accompany it only when supported by owner-published structured evidence.

The following is a proposed reason vocabulary, not an implemented enum or a new Knowledge authority:

| Proposed user-facing state | Required producer evidence | Forbidden UI shortcut |
|---|---|---|
| Not yet identified | Semantic owner explicitly reports no admitted interpretation for this exact subject | Guessing a meaning from title or assuming zero records proves permanent absence |
| Source-derived candidate only | Published candidate/partial qualification for the applicable assertion | Treating source description as verified Knowledge |
| Awaiting Founder or engineering review | Explicit pending-review lifecycle/decision evidence | Interpreting any missing record as awaiting review |
| Conflicting evidence | Conflict/dispute output and traceable competing assertions | Selecting the first record or hiding the conflict |
| Representation unresolved | Responsible representation owner reports unresolved axis/unit/value representation | Concluding numeric engineering meaning from display shape |
| Definition revision not covered | Authoritative applicability assessment explicitly excludes/lacks this revision | Reusing the nearest or older revision automatically |
| Relationship not qualified for this ROM | Relationship owner supplies scope/qualification failure | Treating a same-named Table in another ROM as applicable |

Multiple reasons may coexist and retain their scopes; the UI cannot invent a precedence that hides a conflict. Operational loading failure is separate from semantic unavailability. Until structured reasons exist, show the existing truthful reason, with the generic “Engineering interpretation not yet available” where that is the actual owner output. Do not reverse-engineer free text into a more precise governance state.

Knowledge admission/publication and representation owners would need to extend their outputs in an authorised slice before the precise new labels can be used. The shell does not infer governance workflow. [TS-STD-005](../../engineering-standards/TS-STD-005-engineering-semantic-integrity-standard.md) and [TS-STD-006](../../engineering-standards/TS-STD-006-engineering-knowledge-admission-publication-integrity-standard.md) remain controlling.

## Disposition of existing tests

[tablePresentation.test.ts](../../../lib/calibration-workshop/tablePresentation.test.ts) remains untouched and failing for all three held expectations. Later implementation must supplement it with rendered behavior and navigation tests for H1–H3, then seek explicit approval before replacing source-text checks. Merely changing literals, deleting expectations or rendering placeholder words does not satisfy the contract. See [acceptance H1–H3](05-acceptance-regression.md#guidance-acceptance).
