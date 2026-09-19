# Acceptance and regression matrix

**RATIFIED ARCHITECTURE — IMPLEMENTATION REQUIRES SEPARATE FOUNDER AUTHORITY**

**Ratification:** [TS-RAT-024](../../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-024) — Founder approval: 20 September 2026.

Part of the [ratified programme](README.md). These are future test requirements, not executed results. D = deterministic model/contract tests; C = rendered component tests; B = browser interaction tests; F = Founder localhost validation. No new test dependency or test-file alteration is authorised by this architecture.

## Fixture and oracle policy

Use controlled, exact-revision N54 comparison and B58 Gen1/Supra Current-only fixtures as regression anchors; retain the accepted qualified identities and mutation outputs. Add explicit missing Reference/Current, quarantined, incomplete semantics, revision mismatch, conflict, storage failure and session-failure fixtures. N13, N20, N26, N54, N55, S55, B48, B58 Gen1, B58 Gen2, S58, S63, Supra B58 and future platforms receive parameterised shell tests with their supplied capability envelopes. Synthetic platform-labelled presentation fixtures demonstrate shell invariance only, never actual ROM or vehicle qualification.

For shared interactions compare exact pre/post snapshots of vehicle/Dataset/Definition/occurrence, Current digest, Working revision/history/cursor, tabs, selected cells and owner-supplied capability outcomes. Allowed presentation changes are enumerated by the action; all other fields remain unchanged. Browser tests must also assert no unintended provider/session reload or write request. Pixel similarity alone is insufficient.

## Shell, identity and persistence acceptance

| ID | Scenario / action | Required observable result | Coverage |
|---|---|---|---|
| S01 | Comparison and Current-only entry | Same landmarks, navigation, tabs, action locations and renderer interface; only qualified layers/actions differ | D C B F |
| S02 | Reference absent or comparison incompatible | Current stays visible; Reference/delta reason shown; no synthetic baseline; same shell | D C B F |
| S03 | Missing Current or quarantined selected Table | Same shell regions and honest absence; no editable/quarantined values; unaffected qualified Tables remain accessible | D C B |
| S04 | Change platform/DME/container identity | Same structure/control meaning; reauthorised context and distinct evidence; no platform-specific shell selection | D C B F |
| S05 | Repeated titles/Definition IDs, distinct occurrences | Exact key/revision/occurrence opens correct tab/cell; unresolved explicit target never resolves by name | D C B |
| S06 | Open, activate, close, close others and provisional capacity limit | Stable exact identity and per-tab state; explicit understandable capacity decision; no silent eviction of a Table with unapplied input, Working changes or relevant history; Working history never silently evicted; derived-cache eviction cannot discard user state | D C B |
| S07 | Standard/Engineer switch after edits and multi-tab selection | Values, capabilities, Dataset/session, tab/cell selection, Working and undo/redo unchanged; no network reload | D C B F |
| S08 | Collapse either/both panels; Focus enter/exit | Real width reclaimed, controls accessible, previous collapse states restored; no Table/history reset | D C B F |
| S09 | Reload then no-token vehicle reopen | Authorise context first; exact-compatible Working replay restored; latest/explicit vehicle-role recovery only for absent token | D B F |
| S10 | Valid explicit token plus preview parameter | Exactly requested owner/vehicle session; no latest/role lookup or preview provider; qualified layers preserved | D B |
| S11 | Empty/malformed/repeated/unavailable/expired/wrong-owner/wrong-vehicle explicit token | Existing fail-closed presentation; zero recovery/preview substitution and no stale local hydration | D C B |
| S12 | Development versus production preview | Preview only under existing non-production explicit-preview policy; isolated from subscriber/Working storage and visibly disclosed | D B |
| S13 | Working restoration with changed Dataset/layout/Definition revision or corrupt history | Replay rejected with visible incompatibility; no transplant or silent overwrite of stored history | D B |
| S14 | Source lease expires while derived evidence remains available | VIEW/history retained if independently authorised; reconstruction blocked; no source reacquisition by UI | D C B |
| S15 | Browser storage failure / divergent second window | Unsaved/conflict state explicit; no false saved confirmation or silent history overwrite | D B |
| S16 | Back/forward, explicit Definition link and invalid cell hints | Exact authorised selection; deterministic precedence; no title fallback or out-of-bounds edit | D B |
| S17 | Logout/account/vehicle change then restore | No cross-owner values, tabs, Working or cached evidence; reauthorise each context | D B |
| S18 | Desktop/small laptop/tablet/phone fixtures | Approved policy: desktop/laptop full editing, including smaller laptops through collapse/Focus; tablet review until explicit interaction and safety validation; phone exact-value/status/history review with full cell editing unavailable until separately designed and validated; EDIT qualification unchanged | C B F |
| S19 | Loss of access or transient evidence read failure | Clear failure distinct from missing semantics; no values from cached alternate session | D B |
| S20 | New user/profile, then explicit mode selection and reload | Standard default; explicit Standard/Engineer preference may persist; evidence, identity, values, capabilities, Working, tabs, cells and history unchanged | D C B |

## Table and interaction acceptance

| ID | Scenario / action | Required observable result | Coverage |
|---|---|---|---|
| R01 | Scalar, 1D and 2D render matrix with and without Reference | No axes for scalar, genuine one-axis line for 1D, governed X/Y for 2D; identical shape gating across evidence states | D C B F |
| R02 | Equal axis lengths, missing orientation, unknown units/semantics, nonnumeric or repeated axes | No dimension/title inference; explicit unsupported geometry; source coordinates/order and uncertainty retained | D C B |
| R03 | Select Grid cell, slice point and surface node | Same exact cell in Inspector and linked views; selection outside active slice disclosed; no interpolated editable cell | D C B F |
| R04 | Row/column slices, zoom, camera rotation, view switches | Correct varying axis and selected layer; true surface only; values/Working/history unchanged | D C B F |
| R05 | Reference/Current axis disagreement | Supplied axes and comparison qualification visible; misleading overlay/delta unavailable; no alignment by guess | D C B |
| R06 | Missing surface cells/quarantine | No interpolated bridge across unqualified cells; valid local topology only and visible limits | D C |
| R07 | Qualified direct edit and toolbar operation | Same engine result; Current digest unchanged; sparse Working mutation, before/after and changed marker correct | D C B F |
| R08 | Raw Representation unavailable, modes or precision changes | Supplied raw facts/limitations only; no browser parser or invented conversion; exact values inspectable | D C B |
| W01 | BLOCKED edit or invalid operand | No mutation/history advance; explicit findings, stable selection | D C B |
| W02 | WARNING edit | Warning and before/after shown before intentional apply; recorded warning persists; no safety/export implication | D C B F |
| W03 | Undo/redo across Tables/renderers, branch after undo | Accepted engine history/cursor semantics, exact replayed values and indicators, no duplicate history | D B F |
| W04 | Close edited Table, reopen, refresh, change mode | Working remains exactly bound and restored under valid context; no loss with tab lifetime | D B |
| W05 | VIEW-only, expired reconstruction lease, checksum unknown, Flash request | Independent restrictions; no EDIT by VIEW, no reconstruction without dependencies, Export locked, Flash unavailable | D C B |

## Guidance acceptance

| ID | Scenario / action | Required observable result | Coverage |
|---|---|---|---|
| H1 | Exact qualified related edge; missing, conflicting, wrong-ROM or ambiguous target | Qualified exact target opens/focuses tab without losing tabs/Working; unavailable reasons shown; no title-derived edge | D C B F |
| H2 | Understand with complete, partial and absent qualified fields | Render qualified controls/purpose/contexts/reading/considerations/telemetry and provenance; missing fields explicitly absent; Engineer detail remains reachable | D C B F |
| H3 | Each producer-supported semantic reason plus generic legacy reason | Truthful nonblank reason, exact scope and evidence; no guessed pending-review/conflict state; both modes preserve uncertainty | D C B |
| N01 | All Tables, Essentials and all seven systems | Complete literal catalogue; qualified subset/multi-membership preserved; unclassified not forced into systems | D C B |
| N02 | Literal and engineering-intent queries with candidate-only records | Literal title/key search remains available; candidate/unclassified records cannot gain authoritative intent matching | D C B |
| N03 | Working changes with no Reference; evidence filters | Working and Reference-difference scopes labelled separately; missing Reference is unavailable, not “zero changes” | D C B |

## Professional and future-seam acceptance

| ID | Contract scenario | Required oracle | Coverage |
|---|---|---|---|
| P01 | Starter/Pro/Workshop entitlement and staff permission contexts | Entry/actions may be restricted; entitled entry shares engineering truth and fundamental product model; no entitlement-derived qualification or platform-specific product; fixture does not decide final Starter Calibration access, pricing or quotas | D C B when implemented |
| P02 | Notes, review and iteration lineage | Exact immutable revision references; later changes do not inherit earlier approval; notes never become Knowledge automatically | D when implemented |
| P03 | Analysis/log/Table navigation | Only exact qualified handoff resolves a Table; inferred matches remain disclosed; tabs/Working survive return | D B when implemented |
| P04 | Dyno fixture with missing correction, unknown installed tune and separate DME stream | Unknown fields preserved, source streams distinct, no false ECU channels or flashed claim, raw provenance retained | D when separately authorised |
| P05 | Professional Workshop production-completion review | Separately governed server revision/collaboration programme satisfies immutable lineage, actor/time, custody, notes/reviews, staff permissions, conflict protection, deliberate branching/reconciliation, no silent overwrite, exact evidence associations, versioned migration/rollback and security/retention/customer-consent policy | Mandatory future production gate; separate programme validation |

These rows do not require business features or dyno acquisition during U0–U6. P05 is nevertheless a mandatory future professional Workshop production-completion gate, not an optional enhancement. The browser-local Working store remains throughout U0–U6 unless a separate persistence programme is authorised. The [TuneSight-wide invariant](README.md#universal-product-experience-invariant) also governs other product domains, each requiring its own bounded architecture, migration and acceptance programme; this matrix creates no implementation contracts for them.

## Test evolution and regression gate

Keep accepted deterministic mutation, persistence, role, navigation, comparison, qualification and session tests. Supplement source-text tests in `engineeringNavigation.test.ts`, `subscriberWorkshopSession.integration.test.ts`, `vehicleCalibrationRole.integration.test.ts`, `calibrationTerminologyUi.test.ts`, `workingCalibrationUi.test.ts` and especially `tablePresentation.test.ts` with rendered component/browser assertions. Source checks may remain for server-only imports and route wiring; they are insufficient evidence for interaction, state retention or true 3D.

Do not rewrite the three held tests until a separately authorised implementation slice delivers H1–H3 and the replacement/supplement is reviewed. Their current failures remain explicit holds, not quarantined successes. The current two corrected assertions remain intact.

For each future implementation slice run focused changed-contract tests, type-checking, relevant component/browser cases, `git diff --check`, and the deterministic regression set established at the accepted checkpoint: all test files under `lib/calibration-workshop`, `lib/knowledge`, `lib/vehicle-interface`, plus the four Analysis files (`engineeringInvestigationPresentation`, `telemetryWorkspacePresentation`, `telemetryGraphPresentation`, `TelemetryViewEducation`). The checkpoint baseline is 757 tests, 754 passing and three held presentation failures; additions will change counts. Report failures by identity, not only totals. No unrelated regressions may be reclassified as holds.

Browser tooling must be inventoried before choosing a harness; dependencies need separate authorisation. Founder checkpoints include N54 comparison and B58/Supra Current-only, then unavailable states and smaller displays. Record exact identities, actions, outcomes and remaining limits. Performance acceptance begins with measured cold-load and interaction baselines; shared presentation-only actions must trigger zero provider reloads and introduce no unreviewed budget regression. The existing 12-open-tab/six-derived-Table bounds may remain during U0–U6 as provisional migration limits only. Final capacity requires controlled performance measurement and professional workflow review; expansion or configurable professional capacity needs its own review. S06 protects pending input, Working changes and relevant history and requires an explicit capacity decision instead of unexplained removal.
