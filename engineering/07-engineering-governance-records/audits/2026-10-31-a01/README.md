# A01 dependency security review

31 October 2026 · Prepared for Beau and Bob · Not pushed or deployed

The candidate updates **Next 16.3.8 to 16.4.1**, the first patched 16.x version for all three Next advisories cited by the 31 October audit. A clean installation and fresh production dependency scan report **zero vulnerabilities**. Type-check, lint, Production build and **974 selected regression tests** pass. Application code and the approved UI are unchanged.

This is a review candidate, not a Production closure or new ratification. Vercel's current Production deployment is verified at the released commit with **Next 16.3.8** in its build log; the live correction is still pending. No deployment is authorised in this package. Existing Security/Trust acceptance under TS-RAT-026 remains valid within its recorded scope. The full development dependency tree still reports 17 entries, qualified below.

## Baseline and exact changes

The isolated branch is `codex/a01-dependency-security`, based on released commit `63d1fa4ef2aebdb6bd21692ca93f4e2f544c988d`. Fresh connected GitHub reads confirm that SHA remains `main`, with a successful Vercel status. The difference from approved application release `ce3104b77acbc5345ff6276ba5f571b0e83f42f0` consists only of the two existing governance records. The dirty original checkout was not used as the implementation baseline.

Only [package.json](../../../../package.json) and [package-lock.json](../../../../package-lock.json) change existing tracked files. The review record and evidence are additive.

| Dependency | Released | Candidate | Reason |
|---|---|---|---|
| `next` | 16.3.8 | 16.4.1 | First fixed 16.x version for the three cited advisories |
| `@next/env` | 16.3.8 | 16.4.1 | Next's required matching dependency |
| Eight `@next/swc-*` platform packages | 16.3.8 | 16.4.1 | Matching optional platform artifacts required by Next |
| Next's optional `sharp` range | `^0.35.4` | `^0.35.5` | Vendor security floor; the resolved version remains 0.35.5 |

The eight SWC artifacts cover Darwin arm64/x64, Linux arm64/x64 GNU/musl, and Windows arm64/x64 MSVC. There are ten changed package entries plus the lockfile root dependency declaration. No other package version or integrity changes. The dependency patch is 42 insertions and 42 deletions across two files.

React and React DOM remain 19.2.4; `eslint-config-next` remains 16.3.8. Installed Next's Node requirement is `>=20.9.0` and its React peer range accepts the installed React. The existing ESLint configuration has no Next peer constraint requiring a version change. Compilation, type-check and lint confirm this combination for the tested source. No codemod, override, forced audit fix or unrelated upgrade was used. npm proposed 16.4.3, but the vendor's [16.4.1 security release](https://github.com/vercel/next.js/releases/tag/v16.4.1) supplies all three required fixes with the smaller version change.

[Exact dependency receipt](evidence/dependency-change.json) · [Review patch](evidence/dependency.patch)

## Advisory disposition

| Advisory | Actual condition and released-source evidence | Candidate disposition |
|---|---|---|
| [GHSA-p3m5-59mp-jv5r — Server Actions DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | Next 16.0.0–16.4.0 with App Router and a Server Action. TuneSight uses App Router and defines `deleteVehicle` with `use server` in `app/garage/page.tsx:22`. The vendor provides no workaround besides upgrading. Action authentication is not a vendor-listed mitigation for framework request processing. | Relevant application condition confirmed. Next 16.4.1 is installed and locked; the production scan no longer reports this advisory. No exploit request was sent. |
| [GHSA-2464-fhr4-w9xw — Image Optimization RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | The vendor describes an upstream memory issue on glibc Linux and names SVG in the advisory title. The baseline Next version is in range, but locked/installed `sharp` 0.35.5 already meets the vendor workaround. No `dangerouslyAllowSVG` configuration was found; the homepage uses a static PNG. Deployed `sharp` was not independently inspected. | Next 16.4.1 enforces the newer optional range, and clean installation retains sharp 0.35.5. Normal image optimisation returns HTTP 200; malformed width returns 400. Windows checks do not constitute a Linux exploit test. |
| [GHSA-673q-mjm6-r5xr — cached typed-array RCE](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | Affected versions require App Router with Cache Components and a `use cache` function returning multiple typed arrays. No `use cache` directive or `cacheComponents` setting was found. The existing React `cache` call is distinct. The vendor still recommends upgrading without those functions. | Package-range exposure removed by Next 16.4.1. The specific application prerequisite was not found; exploitability was not asserted. |

[Structured applicability record](evidence/advisory-disposition.json) · [Baseline production scan](evidence/baseline-production-audit.json) · [Patched production scan](evidence/patched-production-audit.json)

## Remaining development advisories

`npm audit --json` reports **16 moderate and one high package entries, zero critical**. These include transitive dependents; they are not 17 distinct exploitable production vulnerabilities. `npm audit --omit=dev --json` reports zero. The installed dependency paths and 49 Production route trace files show no runtime reference to the affected development `minimatch` or `zod` packages. This narrows the demonstrated exposure; it does not waive their advisories or establish safety for arbitrary untrusted build inputs.

- **Minimatch, GHSA-g3hv-75wg-m249:** the [maintainer advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) identifies 10.2.6 and attacker-controlled glob patterns with `optimizationLevel >= 2`; npm reports the broader range `<11.0.1`. The installed development versions are 3.1.5 and 10.2.5, via ESLint/TypeScript tooling. No subscriber-supplied glob path or configuration enabling the affected optimisation was found. The discrepancy between vendor and npm ranges remains explicit. A forced 11.x override or npm's suggested incompatible ESLint downgrade would broaden this package without demonstrated runtime benefit.
- **Zod, GHSA-mrhx-c7xc-m3w5:** installed 4.3.6 is below the reported fix 4.6.6. It is a development dependency of `eslint-plugin-react-hooks` and `zod-validation-error`. Inspected calls parse compiler/configuration schemas, and no subscriber request path imports it. The [maintainer fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd) moves collection bounds before element parsing; the [maintainer discussion](https://github.com/colinhacks/zod/pull/6475) explains issue accumulation and early exit. This high development advisory remains for tooling review; it is not claimed fixed.

This package therefore closes the **three cited Next advisories in the candidate production tree**, not the entire development-tool backlog. [Full scan](evidence/patched-all-audit.json) · [Installed dependency tree](evidence/dependency-tree.json) · [Production trace check](evidence/runtime-trace-check.json)

## Validation evidence

Environment: Windows x64, Node 24.14.1, npm 11.11.0. The new candidate worktree had no `node_modules` before `npm ci`; dependencies were installed from the corrected lockfile, not copied from an older checkout. The existing ignored local environment configuration was used without changing or publishing credentials.

| Check | Result and scope |
|---|---|
| Clean installation | `npm ci --no-audit --no-fund`: exit 0, 406 packages added in 38 seconds |
| Fresh advisory checks | Production scan: zero. All-dependency scan: 17 qualified development entries above |
| Type generation and type-check | `next typegen`, then `tsc --noEmit --incremental false`: pass |
| Lint | Whole-source `eslint .`: pass |
| Production build | `npm run build`, default Turbopack, Next 16.4.1: pass; 38 static pages generated and dynamic routes emitted |
| Functional and security regressions | 974/974 cases pass across 107 existing files; zero failures, skips or cancellations; 254.32 seconds |
| Runtime HTTP boundaries | Homepage/image 200, invalid image width 400, protected anonymous GET/form POST 307 to login, unsupported projection GET 405, anonymous projection POST 401, foreign-origin Working POST 403 |
| UI inspection | Populated B58 Analysis and Calibration checked against the canonical Production pages in the same native desktop browser; details below |
| Source and preservation | `git diff --check` passes. No application/UI/configuration/test/migration source changes. All 38 protected file hashes, original status and stash are unchanged; historical worktrees retain their heads and clean state |

The regression selection includes subscriber/beta access, same-origin boundaries, ownership and deletion rules, upload bounds, evidence integrity and expiry, durable source resolution, approved Analysis presentation, logger/identity/correlation logic, Calibration bootstrap/projection/cache/editing and Working-revision contracts. The exact file list and TAP output are retained. These are fresh A01 results; the larger earlier audit run is not added to the count. Separate `.test.tsx` browser harness files and the costly whole-catalog research sweep were not included in these 974 cases.

HTTP harness corrections are disclosed: an initial GET to the POST-only projection route correctly returned 405; an IP-origin probe returned 403. Repeating with the application's browser origin `http://localhost:3101` and the correct POST method returned 401 as expected. The initial receipts remain alongside the final eight passing checks. No authenticated deletion, source upload, Current assignment, Working creation/save or exploit payload was executed.

The existing Next middleware deprecation notice and Node module-type warnings remain. Starting a development server generated an `AGENTS.md` change in the new worktree; the server was stopped and only that generated change was restored to the baseline. No development preview was substituted for the populated Production-build checks.

[Validation summary](evidence/validation-summary.json) · [Raw TAP](evidence/regressions.tap) · [Test file list](evidence/regression-files.txt) · [Build log](evidence/production-build.log) · [HTTP checks](evidence/http-regressions.json) · [Preservation receipt](evidence/preservation-after.json)

## Populated UI and interaction checks

The candidate ran locally with `next start` on loopback port 3101. The comparator was `https://tunesight-beta.vercel.app`. The native DuckDuckGo browser used its existing authenticated session; no session credentials were extracted. Screenshots cover the same desktop window, approximately 1523 by 824 including browser chrome. The Production-only Vercel overlay and different browser-local remembered table selections are excluded from application-layout comparisons.

| Surface | Observed result |
|---|---|
| B58 Analysis summary | Same owner vehicle/log, 42 source-derived intervals, six checks and two channel blockers; typography, colours, borders, spacing and navigation visually retained |
| Telemetry workspace | Same 144 RPM samples, one detected pull and 46 detected events; chart structure and qualified units retained; section anchor and run/gear disclosure work |
| Recorded gear link | Click changed the URL to the exact interval anchor. This check did not independently verify every resulting chart sample; exact interval logic is also covered by the Node regressions |
| Investigation and Calibration Context | Separate full-width stacked sections in the approved order, with aligned page margins and working section navigation |
| B58 Calibration | Existing Current-only session loads 1,175 tables, seven qualified and 1,168 unclassified; Reference remains unavailable, Working not created, export/flash locked |
| Table search and selection | `Boost Ceiling` filters to 28 tables. Selecting `Boost Ceiling (Relative) (Gear x RPM) (FF)` loads the same populated grid and values as Production |
| Grid, 2D and Inspector | Grid/2D switching works; matching 2D chart compared with Production; Engineer/Standard mode toggles work; selecting R2/C2 updates the Inspector. 3D remains disabled for this source's degenerate coordinate evidence on both versions |

The local Analysis Calibration context remained unavailable on two loads even though the standalone Calibration session loaded. Its displayed reason was: “No explicit Current assignment or owner-scoped source-hash locator is available. The owned Calibration context is temporarily unavailable. No recovery or persistence was attempted.” Production displayed the admitted source. A fresh isolated copy of released commit `63d1fa4`, with the unchanged 16.3.8 lockfile, clean installation, successful normal Turbopack Production build and the same local configuration, reproduced the same displayed failure on port 3103. This demonstrates that the observed local failure also occurs before the dependency correction. Its underlying cause is unresolved; full populated Analysis-to-Calibration content equivalence is not claimed. No recovery, source substitution or application repair was introduced.

The released-copy build initially could not fetch fonts inside the sandbox, then encountered a Turbopack worker/cache failure. An exploratory webpack build failed on an existing `node:crypto` client import. Preserving the generated cache and making a clean normal Turbopack build succeeded without changing code, fonts or dependencies. These diagnostic attempts are retained separately from the candidate's passing normal build.

[Released local comparison](evidence/baseline-runtime-comparison.json) · [Released local context](evidence/ui/released-local-b58-context.png) · [Candidate context](evidence/ui/candidate-b58-context.png)

The N54 Production Calibration page opened in an unresolved state; no restore/upload was performed to manufacture a populated session. No new mobile, screen-reader, exhaustive browser-console, cross-browser, all-platform, live two-principal RLS, physical-vehicle or complete edit/save/reload acceptance is claimed. Compilation alone is not the basis for the bounded UI result.

[Analysis summary before](evidence/ui/baseline-b58-analysis-summary.png) · [after](evidence/ui/candidate-b58-analysis-summary.png) · [Approved stacked sections](evidence/ui/candidate-b58-analysis-stacked.png)

[Calibration header before](evidence/ui/baseline-b58-calibration-header.png) · [after](evidence/ui/candidate-b58-calibration-header.png) · [2D before](evidence/ui/baseline-b58-boost-2d.png) · [after](evidence/ui/candidate-b58-boost-2d.png) · [Cell selection](evidence/ui/candidate-b58-cell-selection.png)

## Deployment evidence and review boundary

The authenticated [Vercel deployment dashboard](https://vercel.com/beau-n54s-projects/tunesight/HSgCfFP8zgHH2AS9a2gehGVRe7gR) was inspected read-only. It shows Ready / Latest / Production / Current, source `main` at [63d1fa4](https://github.com/beau-n54/TuneSight/commit/63d1fa4ef2aebdb6bd21692ca93f4e2f544c988d), and the canonical domain `tunesight-beta.vercel.app` alongside `tunesight-59ygdqoi1-beau-n54s-projects.vercel.app`. The 24 October build log states `Detected Next.js version: 16.3.8` and `Next.js 16.3.8 (Turbopack)`. This confirms the baseline and remaining live Next finding. The actual deployed sharp/runtime package inventory was not independently inspected; the lockfile workaround is not promoted into a deployed sharp assertion.

[Current deployment screenshot](evidence/ui/vercel-current-deployment.png) · [Deployed Next version screenshot](evidence/ui/vercel-deployed-next-16.3.8.png)

No pushes, PR publication, deployments, migrations or changes to existing acceptance records were made. No BM3 correction or other backlog implementation was started. The original modified files, stash, complete audit documents and all historical worktrees remain preserved.

Review may approve this dependency candidate within the stated evidence. Full operational A01 closure still requires a separately authorised deployment, its exact source/package receipt and a bounded deployed smoke check. The development advisories and the local Analysis evidence limitation remain explicitly qualified; neither is erased by the successful build.

[Remote evidence](evidence/remote-evidence.json) · [Artifact hashes](evidence/artifact-manifest.json)
