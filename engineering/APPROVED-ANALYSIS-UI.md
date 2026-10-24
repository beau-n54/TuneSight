# Approved Analysis presentation integration

Status: Beau approved the final stacked layout on 24 October 2026 and authorised release of this integration. Functional limitations below remain outstanding; visual approval does not resolve them.

## Authority and preserved work

Founder approved both populated port 3001 examples from `cb43823990cb421bd7e8242c01964f7f341804db` (Deploy Calibration compute in Sydney). Those running examples are the presentation reference, not the rejected restoration. They use a local snapshot adapter containing current persisted results, not historical recalculations or an October database reconstruction.

Functional baseline: `f91a91197a5e71024af1fd828e6e86bd53d96a49`. Integration branch: `codex/analysis-historical-integration` in a separate worktree. The six rejected-restoration files on `codex/analysis-approved-ui`, main, port 3000, and the historical worktree/runtime/data on port 3001 remain preserved. Integration uses port 3002 and current authenticated loaders; snapshot plumbing is not part of application code.

## Approved layout amendment — 24 October 2026

Beau explicitly superseded the historical side-by-side desktop arrangement: Engineering Investigation is full width, followed immediately by full-width Calibration Context, aligned with Engineering Correlation above within the existing page margins. The shared shell applies this to every platform. Headings, borders, contents, disclosures, navigation anchors and internal responsive grids remain unchanged. No fixed height or neighbouring-column space is reserved. All other appearance and flow remain as previously reviewed. This visual feedback does not resolve the documented functional limitations.

## Section integration map

| Historical owner / responsibility | Current functional owner | Placement and treatment |
| --- | --- | --- |
| Analysis page header and badges | identityOwners, qualified source/result selection | Original header arrangement; retain declared-versus-observed identity and truthful unavailable badge |
| EngineeringWorkspaceShell | Shared presentation only | Original six sections, ordering, typography, sticky navigation and full-width stacked grid; min-w-0 prevents intrinsic overflow |
| EngineeringSummaryCard | recoverAnalysisWorkspace, sourceObservationEvents | Visible historical summary; current source/history controls and RunOverview within its existing disclosure pattern |
| PrimaryEngineeringResults | scoped qualified results plus ContextualFindings | Visible qualified results and grouped factual findings; never promote observations to fault diagnoses |
| TelemetryGraphV1 | Current translated channels, exact samples, interval selection and sourceInvestigation | Historical workspace surface and controls; run/gear disclosure within the controls; current traces, units, colours and elapsed-time axes retained |
| EngineeringCorrelationSurface | Conservative correlation | Visible Evidence section, not hidden under another section |
| Investigation reserved area | NextChecks, FactualInvestigation | Current content occupies the full existing content width; exact evidence expands in place |
| Calibration Context reserved area | readAnalysisCalibration, resolution/admission, channel status | Current qualified bindings and independent telemetry states occupy the full existing content width immediately below Investigation; unavailable admission remains explicit |
| Selected Log / Tune / Profile / Summary cards | Existing owner-scoped records | Original four-card row, selected source accurately named |
| Tune Profile V1 | Current profile hints and deferred owned-byte evidence | Visible original panel; byte evidence stays with this panel; no active-tune or observed-identity inference |
| Tune-Aware Reasoning | Qualified warnings and source association limits | Original visible placement; no historical fallback guesses restored |
| Metric cards | Qualified source observations / selected qualified result | Original grid and card appearance; actual units and unavailable states retained |
| Cylinder timing panel | analysisEvidenceSections timing observations | Shared original card styling, actual cylinder numbers; 4/6/8 observed-channel fixtures; no inferred installed count |
| Intelligent Warnings | Current source quality, check availability and qualified warnings | Original heading/placement; unavailable checks are not GOOD |
| Detected Events / Cross-Reference Details | Current event grouping, scoring and exact admitted relationships | Existing lower-page investigation hierarchy; current evidence grades, scoring, disclosure details and immutability retained |

No platform-specific page implementation is introduced. Master-library family labels do not grant diagnostic applicability. Existing N54 rule qualification is retained; factual telemetry and observations work independently for other supported sources.

## Subsequent functionality accounting

All changes since the historical commit are retained by basing this worktree on the latest functional commit, rather than replacing it with historical source. The complete 290-path inventory and per-commit history are preserved in the local review evidence (`functional-files.json`, `functional-history.txt`). Presentation changes are limited to the final integration diff.

| Commits / programme | Disposition |
| --- | --- |
| 65b0652 Security and Trust | Retain subscriber gate, ownership, bounded parsing, source access and evidence qualification; no old permissive loader restored |
| 7c0d8eb R01 identity owners | Retain separate owner-declared, observed controller and Calibration source fields |
| 8b0c6f3, be80580, ee166b2 | Retain owned-source access, read-only recovery, platform-neutral workspace and exact selected-log handling |
| a9ab2c7, 8499554 | Retain response-only durable Calibration reconstruction and master-platform source observations; no session or role persistence |
| bd655e3 | Retain independent raw/recognised/observed/system/event/table/diagnostic channel status |
| 67e2d0a | Retain source investigation, tune context and qualification limits |
| 7df8bda | Retain scoring values, ranking and admitted cross-reference evidence |
| 4c47cd4 | Retain score/rank distinction and accessible evidence disclosures within original page hierarchy |
| 4d09b20 | Adapt section placement/width to approved historical layout; preserve substantive data, copy and evidence controls |
| 5162c2a | Retain run/gear intervals, grouped occurrences, finding links, source boundaries and actual sample timing; adapt control placement |
| 4f1c058 | Retain truthful retrieval failure, retry and owned history; same six-section structure now remains present when source is unavailable |
| f91a911 | Retain channel colours, responsive chart sizing and deferred owned evidence; adapt only page placement |
| R02/R03 Calibration performance, R04/R05 Working/editing/history, other pages, security governance | Retained unchanged in baseline; outside this presentation task; no migrations or repair |

The six uncommitted rejected-restoration files are preserved separately and not used as this design baseline. No substantive functional module from that unfinished package is needed: the rejected diff concerned composition, tests and a status note. Its preservation manifest records hashes.

## Platform and data limits

Founder explicitly approved observed-channel-only cylinder presentation for this integration. Missing channels do not establish absent cylinders, are not renumbered and are not filled with zero. Authoritative installed-cylinder-count support remains outstanding for full cross-platform coverage. Source-family names and engine declarations cannot silently provide that authority.

Real-log browser review uses B58 log `7e1cb8fe-2e3a-4612-9cdc-8a18674905c2` (144 samples). The N54 comparison is the existing `WP-005 Founder Validation - MHD` record `97b8386b-fe54-4bb1-8130-51816e352a53`, not claimed as a road log. Historical stored results and current read-only source recovery can legitimately differ. Additional platform and 4/6/8-channel tests are fixtures, not physical acceptance.

No current schema establishes installed cylinder count universally. No new diagnostics, channel aliases, thresholds, source admission rules, scoring values or Calibration relationships are introduced.

## Validation boundaries

The former `Unbound reason retained` failure is closed, not waived. Its fixture expected an arbitrary legacy phrase after the renderer grouped repeated per-channel withheld explanations. The resolver retains exact admission blockers in `reason`; the renderer preserves those blockers, grouped unbound observed channels, relationship limitations and independent telemetry availability. Behavioural regressions now verify these contracts, failed admission and fully bound channels: 120/120 affected tests passed. Application files were unchanged by this test correction. Local browser evidence is distinct from controlled component renders; the final stacked presentation has Beau's visual approval.

Founder authorised commit, integration into the verified production branch, normal push and automatic Production deployment on 24 October 2026. Subscriber mutations, migrations, backfills and R06–R07 remain outside this release. Preserve the historical comparison worktree, rejected restoration and local review evidence.
