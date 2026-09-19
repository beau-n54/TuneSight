# Universal Table presentation contract

**RATIFIED ARCHITECTURE — IMPLEMENTATION REQUIRES SEPARATE FOUNDER AUTHORITY**

**Ratification:** [TS-RAT-024](../../07-engineering-governance-records/engineering-ratification-register.md#ts-rat-024) — Founder approval: 20 September 2026.

Part of the [ratified programme](README.md). This contract replaces neither Dataset qualification nor the Working engine. It specifies their common presentation boundary.

## One Table model, optional evidence layers

A shared Table presentation model is consumed by Grid, 2D, 3D and Cell Inspector for both comparison and Current-only sessions. Adapters may project the two existing provider outputs into that model, preserving source identities and qualification; they must not invent missing values or change owner contracts. Long-term product layout has no comparison/current-only branch.

Required fields: exact vehicle/Dataset and Definition revision/occurrence binding; qualified shape/dimensions; canonical cell identity and coordinates; supplied X/Y orientation and coordinate evidence; output units/representation and their qualification; immutable Current layer; optional qualified Reference and comparison mapping; optional validated Working projection; raw evidence availability; table/cell authority, findings, provenance and limitations. A missing layer is explicitly absent, never a zero-valued array or copy of Current. Labels and mode are presentation inputs, not model identity.

Working display resolves sparse changes over immutable Current through the existing engine. Reference comparison and Working-versus-Current comparison are separately labelled relationships. A Reference layer can be toggled off without losing Current-only plot quality. Suggested stays outside mutation and render assumptions until its own contract is authorised.

## Shape and axis decision matrix

**Founder-approved strict geometry policy:** Disable unsupported 2D or 3D when genuine axis orientation, coordinates or topology cannot be established. Do not retain a flattened all-cell line presented as meaningful 2D, a perspective-tilted line presented as 3D, axis assignment based only on matching dimensions, fabricated RPM/load/time or other engineering meaning, or interpolation across unqualified or quarantined cells. Grid remains the truthful fallback when qualified values exist but genuine plot geometry does not. This approval records architectural direction only, not implementation authority.

| Governed structure | Grid | 2D | 3D |
|---|---|---|---|
| Scalar | One exact cell, no manufactured axes | Unavailable: scalar has no line axis | Unavailable: no surface topology |
| 1D with one supplied axis | Exact cells and genuine axis | One line on that axis in source order | Unavailable: no second axis |
| 2D with governed X/Y and complete qualified topology | Exact rows, columns, both supplied axes | Genuine selected row or column slice; correct varying axis | Surface from adjacent qualified cells with exact cell identity |
| Values qualified, required axis/orientation unresolved | Grid can use clearly labelled structural row/column indices | Unavailable where a genuine axis cannot be established | Unavailable; no manufactured physical coordinates |
| Missing/quarantined values or partial topology | Metadata plus explicit cell absence; qualified unaffected cells retained | Gaps remain gaps; only independently qualified slices/segments | Only qualified local topology; missing cells never filled; wireframe/disclosure if no complete faces |

Dimension equality alone cannot assign X versus Y. A renderer must consume an authoritative orientation binding; it cannot choose an axis because its length happens to fit. Source indices are structural addresses, never inferred RPM, load, time or other engineering axes. Categorical/non-numeric axes may be shown as labelled ordered samples in a supported 2D presentation, not asserted continuous physical spacing. A quantitative 3D surface requires qualified numeric coordinates and sufficient topology; unresolved or degenerate coordinates disable that surface with a reason. Any future categorical surface is a separate reviewed presentation proposal.

Numerical coordinate knowledge and semantic interpretation are distinct. A supplied qualified numeric axis may be plotted under its source label while engineering meaning remains unknown; the UI must not relabel it from title guesses. Repeated/non-monotonic axis values retain source order and disclose limitations; no silent sort, deduplication or resampling to make a surface look regular. Plot scale transforms are explicit visual mappings, reversible for inspection, and never rewrite engineering values.

Reference axis disagreement is preserved. Use the qualified comparison mapping for matched values; a shared overlay must not place Reference points at Current coordinates if that misrepresents their supplied axes. Where geometry cannot honestly overlay, show separate labelled layer views and disable the misleading overlay/delta with the comparison reason. Do not infer cell correspondence by title or proximity. Working retains Current axes unless a separately qualified axis-edit contract exists; this programme authorises none.

## Interaction parity

| Interaction | Required common behavior |
|---|---|
| Selection | One canonical selected cell/region per exact tab; Grid, slice, surface and Inspector consume it. A slice not containing the selected cell discloses that state, never changes identity silently. |
| Keyboard | Arrow navigation follows exact row/column bounds; focus remains distinguishable from selection; Enter commits only a validated edit, Escape cancels pending input. |
| Direct editing | Only Working plus EDIT-qualified targets; reuse preview/apply validation. Read-only Current/Reference remain selectable and inspectable. |
| BLOCKED | No mutation or history entry; before/after unchanged; owner/engine findings visible adjacent to operation. |
| WARNING | Show findings and before/after before intentional apply; an applied warning remains attached to history. A warning is not an assurance of safety or Export eligibility. |
| Zoom/pan | Same controls and reset semantics for either evidence state; view changes affect presentation only. Grid zoom cannot change stored values or precision. |
| Rotation | Only genuine 3D surfaces; preserve camera state per tab; no perspective tilt of a line advertised as 3D. |
| Before/after | Label Current, Working and optional Reference separately; exact selected values and signed deltas only where qualified. |
| Change indication | Working changes and Reference/Current differences are visually distinct, with text legends. Neither means dangerous, safe or recommended. |
| Undo/redo | Accepted Working cursor/history, independent of active renderer or tab; undoing an off-screen edit still updates affected Table indicators. |

Mouse/touch/keyboard transitions operate on the same identities. Surface selection is resolved to the actual cell/node, not an interpolated value treated as an editable cell. Triangulation is presentation geometry only, with deterministic source-cell vertices; interpolation, smoothing, curve fitting and decimation must not become fabricated displayed engineering evidence. Render acceleration may batch geometry but cannot lose inspection identity or exact values.

## Raw Representation and precision

Raw Representation is a consistent Inspector disclosure. It consumes supplied raw value, representation width/signedness/byte order, offset/address and conversion provenance only when qualified and accessible. Missing raw evidence is labelled unavailable; absence of a source-binary lease does not automatically erase independently preserved raw metadata or authorise reacquiring bytes. No browser binary parser or inverse conversion is added here.

Standard formatting may abbreviate labels or display precision but must expose the exact supplied value for inspection; edit operands are validated against the accepted engine, never a rounded display string substituted for immutable Current. Engineer exposes source units, symbols, revisions and conversion provenance. Neither mode changes units numerically without a separately qualified conversion owner.

## Reuse and migration evidence

Reuse [visualizationModel.ts](../../../lib/calibration-workshop/visualizationModel.ts), the existing comparison surface, [workspaceTabs.ts](../../../lib/calibration-workshop/workspaceTabs.ts), [workingCalibration.ts](../../../lib/calibration-workshop/workingCalibration.ts) and [workingCalibrationPersistence.ts](../../../lib/calibration-workshop/workingCalibrationPersistence.ts) where conformant. Reuse is conditional: present dimension-matching/index fallback logic must not become the new contract by accident. Remove the Current-only flattened/tilted path only after actual shared-renderer parity is demonstrated. Keep Founder-validated N54 orbit/slice/cell behavior and B58/Supra Current-only identities and Working behavior through every slice.

Acceptance requires identical model/cell outputs from Grid, line, surface and Inspector for the same evidence; Reference absence must not disable structurally supported views. See [R01–R08](05-acceptance-regression.md#table-and-interaction-acceptance) and the [migration sequence](06-migration-work-packages.md).
