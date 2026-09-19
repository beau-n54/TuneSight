# Professional tuner workflow and future dyno boundary

**RATIFIED ARCHITECTURE — IMPLEMENTATION REQUIRES SEPARATE FOUNDER AUTHORITY**

**Ratification:** [TS-RAT-024](../../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-024) — Founder approval: 20 September 2026.

Part of the [ratified programme](README.md). These are compatibility boundaries, not executable workflows, schema changes, adapters or permissions grants.

## Individual tuner and Workshop continuity

Standard and Engineer are presentation modes, not subscription tiers. Starter is intended to provide a simplified enthusiast product experience and may have a smaller entitled feature set. Pro contains the complete individual engineering and calibration capability authorised for the user. Workshop retains Pro’s engineering capability and adds professional business workflow: customer records, vehicle management, staff accounts, permissions and workshop history. Entitlement may permit or restrict entry and actions, but cannot alter engineering truth, qualify evidence or manufacture capability. A tier entitled to enter a shared domain must not receive contradictory engineering results or an unrelated platform-specific product. Pricing, final Starter Calibration access and commercial quotas remain undefined here. A user entitled to enter but with fewer action permissions sees the same engineering context with unavailable actions and truthful access reasons.

The universal shell accepts an authorised work context: actor, owner/custodian scope, vehicle, optional organisation/customer/job references and separately evaluated permissions. This context is supplied by application access workflows. Presentation cannot self-assert membership, turn a customer record into file ownership or expand another owner's access. Existing owner/vehicle checks remain the minimum boundary until a separately authorised tenancy migration exists.

## Extension matrix

| Extension | Proposed boundary and exact identity | Workspace placement / limitation |
|---|---|---|
| Multiple customer vehicles | Authorised vehicle/context selector; customer association separate from vehicle engineering identity | Outer header/job context; switching reauthorises and isolates all cached state |
| Customer/workshop file custody | Explicit owner, custodian, source uploader and access grants; immutable artifact digest | Evidence provenance; do not silently transfer ownership when assigning a job |
| Staff and permissions | Server-enforced scoped read/edit/review/export permissions plus actor identity | Same controls with permitted actions; browser role labels are not enforcement |
| Revision history and iteration lineage | Immutable revision graph with parent, exact Current/Working revision, evidence and actor/time | History drawer; mutable notes do not rewrite calibration evidence |
| Tuner notes | Versioned annotations bound to exact vehicle/Dataset/Table/cell/revision as applicable | Collapsible notes surface; opinions labelled, never admitted Knowledge automatically |
| Before/after comparison | Owner-qualified mapping between exact revisions | Existing shared layer renderer; no title-based correspondence |
| Review/approval | Review references an immutable revision and evidence snapshot, with actor, scope, outcome and time | History/review disclosure; later edits invalidate approval applicability, not history |
| Logs and telemetry context | Exact source/run identity, time basis, channel qualification and calibration-association confidence | Optional context drawer; no automatic assertion that selected Working was installed |
| Analysis-to-Table | Qualified exact Definition/revision/occurrence handoff, validated against authorised Dataset | Open/focus existing tab; inferred/provisional cross-reference remains visibly non-authoritative and cannot execute exact navigation |
| Calibration-to-log | Scoped request carrying revision and qualified channel relationship, not guessed causal diagnosis | Open linked evidence context while preserving tabs/Working |
| Export eligibility | Existing reconstruction, source lease, checksum/integrity evidence and exact revision | Locked eligibility disclosure; review or subscription does not make Export qualified |
| Future read/clear DTC | Separately qualified vehicle-interface diagnostic services, identity, access and audit trail | Vehicle diagnostic context, not a Table edit command; clear requires explicit future authority and operator intent |

Working revisions are not automatically server records or multi-user documents. Reviews attach to exact content and do not bless later mutations. Retain the current browser-local Working store throughout U0–U6 unless a separate persistence programme is authorised; no database table or team role is introduced here.

## Required future Workshop production gate

Browser-only Working is not sufficient for the completed professional Workshop product. Before Workshop is considered professionally production-complete, TuneSight requires a separately governed server-side calibration revision and collaboration programme covering:

- Immutable calibration revision lineage.
- Actor and timestamp attribution.
- Customer, vehicle and workshop custody.
- Tuner notes and review records.
- Multi-staff access and permissions.
- Optimistic concurrency or equivalent conflict protection.
- Deliberate branching and reconciliation.
- No silent last-writer-wins overwrite.
- Exact association with logs, Analysis, telemetry, dyno evidence and later flash receipts, preserving each source's qualification and explicit absence.
- Versioned migration and rollback.
- Security, retention and customer-consent policy.

This is a required future Workshop production gate, not an optional enhancement. It remains outside U0–U6 and authorises no database schema, collaboration implementation, new evidence authority or Flash capability now. Universal Calibration migration completion and professional Workshop production completion are different acceptance boundaries. Later flash receipts remain unavailable until separately qualified; revision persistence cannot manufacture them.

“Flashed” is a provenance claim requiring a separately qualified installation/write receipt. A saved/exported file, selected UI layer, customer statement or timestamp coincidence does not prove installed calibration. A user-declared association may be retained as declared with its confidence/limitations, never promoted to verified lineage.

## Adapter-neutral dyno evidence seam

Future dyno acquisition uses a versioned external-evidence envelope and separately authorised import/adaptation workflows. The seam is data association and evidence consumption only: no roller control, load control, torque request, safety interlock, calibration write, DME command or dyno hardware protocol is designed here.

| Run-envelope subject | Required preservation / explicit absence |
|---|---|
| Run and source identity | Stable run ID/revision, manufacturer, model/provider when supplied, acquisition/import adapter identity/version, source format and source-record identity |
| Raw source evidence | Immutable original source reference/digest, acquisition time, custody and transformations; access-controlled storage under future retention policy |
| Vehicle association | Exact TuneSight vehicle ID plus supplied vehicle-identification evidence; association status and conflicts |
| Calibration association | Exact Dataset/Current revision, optional Working revision and iteration parents, separately qualified installed/flashed lineage receipt if one exists; unknown remains unknown |
| Time | Run timestamp/time zone, sample time basis, duration and alignment uncertainty; no invented clock synchronisation |
| Operator/workshop | Supplied operator, organisation/job and permission context; unknown attribution retained rather than guessed |
| Measurements | RPM, torque, power, boost, AFR or Lambda and relevant live channels when supplied, each with units, source sensor/channel identity, sample coordinates, quality and missingness |
| Correction | Correction standard and version/settings where supplied, corrected versus uncorrected distinction; absent standard explicitly unknown |
| Environment | Supplied temperature, pressure, humidity and other conditions with units/source/time; no fabricated defaults |
| Measurement basis | Wheel versus engine/crank, measured versus calculated, smoothing/filtering and other vendor transformations where supplied |
| Qualification and limitations | Source authority, verification, uncertainty, provenance and conflicts, kept separate from success of file import |

An imported run need not have every measurement; a missing required identity prevents an exact association, not honest retention of an unassociated source. Dyno torque/power are not ECU-native channels. A dyno-supplied derived power channel retains vendor-derived attribution; a later TuneSight calculation has its own transformation and input provenance. Wheel power is not silently converted to crank power. AFR/Lambda conversion requires qualified fuel/stoichiometric context; do not assume a universal conversion. These are boundary rules, not new conversion algorithms.

Simultaneously acquired DME telemetry remains a separate evidence stream linked by a qualified time-alignment/correlation result. Preserve different sampling rates, gaps, clocks, units and association confidence. Correlation may reference both streams; neither overwrites the other. Interpolation or a common chart axis is not proof of identical sample identity or causation.

## Visibility without workspace clutter

Future dyno information belongs in an optional run/history/context drawer and revision-associated evidence links. A compact “associated runs” count may appear only when that evidence exists and is authorised. Detailed runs open in the appropriate evidence/Analysis view; the Calibration main Table remains dominant. No blank dyno panel, fake run, promotional control or provider picker is required in the present shell.

A future adapter contract must be reviewed for units, correction metadata, measurement basis, source fidelity, identity association, access and retention. Adapter support is not universal dyno accuracy qualification. Manufacturer protocol selection, live streaming, file formats and control software are deliberately unresolved and require separate work packages.
