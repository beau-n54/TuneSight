import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import * as presentation from "../../app/dashboard/vehicles/[id]/analysis/telemetryGraphPresentation.ts";

const require = createRequire(import.meta.url);
const React = require("react"), ts = require("typescript");
const {renderToStaticMarkup} = require("react-dom/server");
const source = readFileSync("app/dashboard/vehicles/[id]/analysis/EngineeringLineRenderer.tsx", "utf8");
const mod = {exports: {} as {default?: unknown}};
new Function("require", "module", "exports", ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
}).outputText)((id: string) => id === "./telemetryGraphPresentation" ? presentation : require(id), mod, mod.exports);

test("server chart reserves CSS-sized plot without rendering at unknown negative dimensions", () => {
  const warnings: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  let html: string;
  try {
    html = renderToStaticMarkup(React.createElement(mod.exports.default, {
      chartId: "rpm", chartTitle: "Engine Speed", focusedChannel: null,
      horizontalAxisLabel: "Elapsed Time (s)", points: [], regions: [],
      relevantRegions: [], series: [], units: "RPM", usesRpm: false,
    }));
  } finally { console.warn = warn; }
  assert.deepEqual(warnings, []);
  assert.match(html, /width:100%;height:100%;min-width:0/);
  assert.match(html, /Engine Speed exact-point telemetry plot/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /border-sky-950/);
});

test("chart uses measured CSS responsiveness within existing bounded grid geometry", () => {
  assert.match(source, /<ComposedChart\s+responsive/);
  assert.doesNotMatch(source, /ResponsiveContainer|initialDimension/);
  assert.match(source, /relative h-full min-w-\[680px\]/);
  const geometry = readFileSync("app/dashboard/vehicles/[id]/analysis/analysisPresentation.ts", "utf8");
  assert.match(geometry, /grid-rows-\[8\.5rem_minmax\(0,1fr\)_3\.75rem\]/);
});
