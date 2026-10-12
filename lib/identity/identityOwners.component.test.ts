import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as nodeModule from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
// Test-only TSX loader uses the existing TypeScript/React dependencies. No production loader/config changes.
const root = path.resolve(".");
// Node 24 supplies synchronous hooks; the repository's older Node type package predates them.
type ResolveContext = { parentURL?: string };
type ResolveResult = { url: string };
type LoadContext = Readonly<Record<string, unknown>>;
type LoadResult = { format?: string | null; source?: string | ArrayBufferView | ArrayBuffer | null; shortCircuit?: boolean };
const { registerHooks } = nodeModule as typeof nodeModule & { registerHooks(hooks: {
  resolve(specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => ResolveResult): ResolveResult;
  load(url: string, context: LoadContext, next: (url: string, context: LoadContext) => LoadResult): LoadResult;
}): unknown };
registerHooks({
  resolve(specifier, context, next) {
    const local = specifier.startsWith("@/") ? path.join(root, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:") ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    if (local && !path.extname(local)) {
      const match = [".ts", ".tsx", ".js"].map(extension => local + extension).find(file => fs.existsSync(file));
      if (match) return next(pathToFileURL(match).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".tsx")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
const { default: Summary } = await import("../../components/IdentityOwnerSummary.tsx");
const { default: WorkingPanel } = await import("../../app/dashboard/vehicles/[id]/calibration/working-calibration-panel.tsx");
const { workingPanelFixture } = await import("./identityOwners.presentation.fixtures.ts");
test("R01 rendered Working detail preserves repeated findings and unique labelled controls", () => {
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(WorkingPanel, workingPanelFixture()), React.createElement(WorkingPanel, workingPanelFixture())));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(item => item[1]);
  assert.equal(ids.length, 4); assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(html.includes(`for="${id}"`));
  for (const name of ["workingOperation", "workingOperand"]) assert.equal(html.split(`name="${name}"`).length - 1, 2);
  assert.equal(html.split('data-finding-source="editAuthority.blockers"').length - 1, 4);
  assert.equal(html.split('data-finding-source="editAuthority.warnings"').length - 1, 2);
  assert.equal(html.split('data-finding-source="workingEditPreview.findings"').length - 1, 2);
  assert.match(html, />CURRENT<\/button>/); assert.match(html, />WORKING<\/button>/); assert.match(html, /Export BIN · LOCKED/);
});
test("R01 rendered identity labels explicitly separate saved identity and controller absence", () => {
  const html = renderToStaticMarkup(React.createElement(Summary, { vehicle: { engine_code: "B58 Gen 2", make: "Toyota", model: "Supra" } }));
  assert.match(html, /Saved engine label \(owner-declared\)/); assert.match(html, /B58 Gen 2/);
  assert.match(html, /Observed DME\/controller family: Not observed/);
  assert.match(html, /Observed controller ROM\/software: Not observed/);
  assert.match(html, /Saved chassis<\/dt><dd>Not supplied by saved vehicle record/);
});
test("R01 active subscriber dashboard describes accepted and unavailable evidence without preview wording", () => {
  const source = fs.readFileSync("app/dashboard/vehicles/[id]/page.tsx", "utf8");
  assert.doesNotMatch(source, /Development Evidence Preview|Development Preview/);
  assert.match(source, /Current-only/); assert.match(source, /qualified Reference/); assert.match(source, /Export and Flash remain locked/);
});
