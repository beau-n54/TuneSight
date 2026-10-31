# A01 release verification — 31 October 2026

> Repository archive — 31 October 2026. This is the sanitised final application-release receipt, originally completed at 11:01 UTC (21:01 Brisbane). Ready/Current and alias mapping below describe that verification time. A later documentation deployment is separate. Hashes of the original local receipt and artifacts are retained in [source provenance](source-artifact-manifest.json); [archive sanitisation](sanitization-record.json) records the bounded omissions and link changes.

**A01’s approved Next advisory correction is released and closed within scope.** The development advisories, reproduced local evidence-loading failure and existing Calibration restoration warning remain open. This is not a new Security/Trust ratification or a blanket dependency clean bill.

Released commit: [d0b8d17a5a7a7d541a83d7f6e79dff6c3a609ca3](https://github.com/beau-n54/TuneSight/commit/d0b8d17a5a7a7d541a83d7f6e79dff6c3a609ca3). Parent: `63d1fa4ef2aebdb6bd21692ca93f4e2f544c988d`. Branch: `codex/a01-dependency-security`.

Remote main was fetched before committing and immediately before pushing; it had not advanced. `git push origin HEAD:main` completed as a normal fast-forward. No force-push, reset of another checkout, or overwrite of newer work occurred. Final connected GitHub verification returns the released SHA as main.

## Exact released scope

- `next` and `@next/env`: 16.3.8 → 16.4.1.
- Eight matching `@next/swc-*` packages: 16.3.8 → 16.4.1 (Darwin arm64/x64; Linux arm64/x64 GNU/musl; Windows arm64/x64 MSVC).
- Next’s optional sharp range: ^0.35.4 → ^0.35.5. Resolved sharp remains 0.35.5.
- React/React DOM remain 19.2.4; eslint-config-next remains 16.3.8. No unrelated dependency upgrade.
- Only package.json and package-lock.json change existing tracked files. The 66 new review/evidence files are additive. All application/UI/configuration/test/migration source remains identical to the released baseline.

The [reviewed candidate and applicability analysis](../README.md) body is retained unchanged as historical pre-release evidence. This receipt records the later authorisation and release outcome.

## Production identity

| Evidence | Verified value |
| --- | --- |
| Canonical alias | https://tunesight-beta.vercel.app |
| Deployment | dpl_8Yn19gxzdhs4SwTvatQqTyHCniPf |
| Immutable deployment URL | https://tunesight-ikwo9yy6l-beau-n54s-projects.vercel.app |
| Source | main → d0b8d17a5a7a7d541a83d7f6e79dff6c3a609ca3 |
| Vercel state | Ready / Latest / Production / Current; 3m 48s |
| GitHub Vercel status | success |
| Deployed Next version evidence | Detected Next.js version: 16.4.1; Next.js 16.4.1 (Turbopack) in this deployment’s build log |

[Vercel dashboard](https://vercel.com/beau-n54s-projects/tunesight/8Yn19gxzdhs4SwTvatQqTyHCniPf) · [Final alias/commit screenshot](ui/vercel-final-current-production.png) · [Next version screenshot](ui/vercel-next-16.4.1.png) · [GitHub receipt](github-final-status.json)

Vercel restored the previous build cache and changed three installed platform packages. The local clean-install evidence remains valid and was not represented as a fresh clean Vercel installation. Deployed sharp’s binary inventory was not independently inspected.

## Validation and UI preservation

The reviewed package hashes and all 64 evidence artifact hashes match. Application/configuration/test inputs did not change, so completed checks were reused as authorised: clean npm ci (406 packages), production advisory scan (zero), type generation, type-check, lint, normal Production build, and 974/974 tests across 107 files. The full scan retains 17 development entries. Production route traces contain no zod/minimatch runtime references.

All [eight new deployed HTTP checks](production-http.json) pass: homepage/image 200, invalid image width 400, protected anonymous GET and benign POST 307, unsupported projection GET 405, unauthenticated projection POST 401, foreign-origin Working POST 403.

Authenticated smoke used the existing Windows DuckDuckGo session and the canonical alias after network reload. The B58 vehicle and selected log match the reviewed baseline:

- Analysis: 42 intervals, six checks, two channel blockers; 144 RPM samples, one pull and 46 events. Summary, context, Investigation and telemetry navigation work. Source and run/gear disclosures open.
- Gear 4 selection shows source rows 103–126 and 24 RPM samples at `#analysis-interval-102-125`; Return to whole log restores 144 samples.
- Calibration Context finishes loading **Exact source admitted**, `00003076501103 / B58GEN1`, with 21 channels, zero direct, 13 related-system and six source-described relationships. The exact source disclosure loads the durable owner-scoped match and engineering SHA-256.
- Analysis retains the approved stacked full-width Investigation and Calibration Context sections, aligned margins, typography, colours and navigation in the inspected desktop view.
- Calibration loads the existing Current dataset and 1,175 tables (seven qualified, 1,168 unclassified). Dataset/binary identity expands; `Boost Ceiling` filters to 28 tables. The FF Gear × RPM grid retains its values. Engineer/Standard switching, R2/C2 Inspector selection and 2D view work. Existing 3D qualification and export/flash restrictions remain.

The prior Production summary and 2D screenshots were visually compared with the new observations. Browser tabs, pointer state, scroll position and restored table selections differ; no global pixel-equality claim is made. No new Production regression was observed in this bounded check. Compilation alone is not the basis of the UI conclusion.

[Admitted source](ui/production-analysis-context-admitted.png) · [Gear selection](ui/production-analysis-selected-interval.png). The original local receipt also retains summary, stacked-section, expanded-source and whole-log screenshots; unnecessary owner identifiers and hover URLs are not copied into this archive. The structured receipt preserves the completed observations.

[R2/C2 selection](ui/production-calibration-cell-r2c2.png) · [2D view](ui/production-calibration-2d.png). Other original local screenshots are retained locally; this archive omits owner nickname and detailed source-record identity views.

## Closure and explicitly open findings

The three cited Next advisories—GHSA-p3m5-59mp-jv5r, GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr—are removed from the production dependency tree by deployed 16.4.1. The vendor conditions and prior mitigations remain qualified in the review; this does not assert that all three were demonstrated exploitable.

**Still open:**

- Development minimatch and zod advisories: 16 moderate and one high package entry, zero critical. They were neither fixed nor waived by this release.
- The local Analysis evidence-loading failure reproduced on both clean released 16.3.8 and candidate 16.4.1. Production succeeds as it did before; this does not resolve the local cause.
- The existing Calibration warning: “Restore failed. Existing history is preserved; retry restoration before editing.” It was observed before release and again afterward. Populated read-only Current data loads; durable editing/restoration is not signed off.

Existing Security/Trust acceptance under TS-RAT-026 remains valid only within its recorded scope. No new mobile, cross-browser, screen-reader, exhaustive console, live two-principal RLS, physical-vehicle or edit/save acceptance is claimed. No source upload, explicit recovery, Working creation/save, deletion or exploit payload was performed.

## Preservation and record handling

Final checks confirm all 38 protected hashes, original modified files, audit documents and stash are unchanged. Historical worktrees retain their heads and states; the A01 worktree is clean. The previous local main checkout was left at its historical commit. No A02/BM3 or other implementation work started.

[Final preservation receipt](preservation-summary.json) · [Pre-release checks](preflight-summary.json) · [Structured release record](release-verification.json) · [Artifact hashes](artifact-manifest.json)

Raw reviewed logs were committed byte-for-byte, retaining CRLF and trailing whitespace so their hashes remain valid. Dependency/prose whitespace checks pass; the raw evidence is not claimed to pass a blanket whitespace check.

This receipt was initially saved locally after the application release commit. It is now archived by the authorised documentation-only closure. It supersedes only the pre-release review’s pending-release status. Any automatic documentation deployment is distinct from the verified application deployment above; no manual redeployment is initiated.
