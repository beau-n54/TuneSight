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
const { default: Gauge } = await import("../../components/LiveTelemetryGauge.tsx");
test("Live gauge renders units, axes, BMW border and timestamp-positioned observations without invented points", () => {
  const points = [{ at: 1000, value: 1000 }, { at: 1100, value: 2000 }, { at: 1500, value: 3000 }];
  const html = renderToStaticMarkup(React.createElement(Gauge, { channelKey: "engine.speed", title: "Engine speed", unit: "rpm", points, origin: 1000, connected: true,
    sample: { key: "engine.speed", state: "valid", value: 3000, unit: "rpm" } }));
  assert.match(html, /bmw-border/); assert.match(html, /Elapsed time \(s\)/); assert.match(html, /Value \(rpm\)/);
  assert.match(html, /display scale, not a validated operating limit/); assert.match(html, /4.00 observed samples\/s/);
  assert.match(html, /cx="58"/); assert.match(html, /cx="82.8"/); assert.match(html, /cx="182"/);
  assert.equal((html.match(/<title>/g) ?? []).length, 3); assert.doesNotMatch(html, /polyline|<animate/);
});
test("Disconnected gauge cannot label a retained observation as a current live reading", () => {
  const html = renderToStaticMarkup(React.createElement(Gauge, { channelKey: "engine.speed", title: "Engine speed", unit: "rpm", points: [], origin: 0, connected: false,
    sample: { key: "engine.speed", state: "valid", value: 4321, unit: "rpm" } }));
  assert.match(html, /Not live/); assert.doesNotMatch(html, /4321/);
});
test("RPM, oil and coolant dials use the BMW border palette with decorative red at the high end", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  for (const colour of ["#00aaff", "#0046ff", "#ff1e1e"]) assert.ok(css.includes(colour));
  for (const [channelKey, unit] of [["engine.speed", "rpm"], ["oil.temperature", "°C"], ["coolant.temperature", "°C"]]) {
    const html = renderToStaticMarkup(React.createElement(Gauge, { channelKey, title: channelKey, unit, points: [], origin: 0, connected: true }));
    assert.match(html, /x1="40" y1="126" x2="280" y2="126"/);
    assert.match(html, /offset="0%" stop-color="#00aaff"/);
    assert.match(html, /offset="65%" stop-color="#0046ff"/);
    assert.match(html, /offset="85%" stop-color="#ff1e1e"/);
    assert.match(html, /offset="100%" stop-color="#ff1e1e"/);
    assert.match(html, /red is not a confirmed warning limit/);
    assert.ok(html.includes(channelKey === "engine.speed" ? "Connected-vehicle redline unverified." : "Connected-vehicle temperature warning limits unverified."));
    assert.match(html, /Scale is a display range, not a vehicle-qualified limit/);
    assert.ok(html.includes(`Value (${unit})`)); assert.match(html, /Elapsed time \(s\)/);
  }
});
test("Multiple live dials own distinct gradient IDs without sharing colour references", () => {
  const html = renderToStaticMarkup(React.createElement("section", null, ...["engine.speed", "oil.temperature", "coolant.temperature"].map(channelKey => React.createElement(Gauge, { key: channelKey, channelKey, title: channelKey, unit: channelKey === "engine.speed" ? "rpm" : "°C", points: [], origin: 0, connected: true }))));
  const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 6); assert.equal(new Set(ids).size, 6);
  for (const id of ids) assert.ok(html.includes(`stroke="url(#${id})"`));
});

test("Full eleven-gauge view keeps gloss static and retains colour, value, axes and limit notices", () => {
  const channels = [["engine.speed", "rpm"], ["map.absolute", "kPa"], ["coolant.temperature", "\u00B0C"], ["charge.temperature", "\u00B0C"], ["throttle.position", "%"], ["vehicle.speed", "km/h"], ["airflow.mass", "g/s"], ["ambient.pressure", "kPa"], ["oil.temperature", "\u00B0C"], ["control-module.voltage", "V"], ["boost.actual", "kPa"]];
  const html = renderToStaticMarkup(React.createElement("section", null, ...channels.map(([channelKey, unit]) => React.createElement(Gauge, { key: channelKey, channelKey, title: channelKey, unit, points: [{ at: 1000, value: 12 }], origin: 1000, connected: true, sample: { key: channelKey, state: "valid", value: 12, unit } }))));
  assert.equal((html.match(/stroke-width="9"/g) ?? []).length, 11);
  assert.equal((html.match(/stop-opacity="0.42"/g) ?? []).length, 11);
  assert.equal((html.match(/red is not a confirmed warning limit/g) ?? []).length, 11);
  assert.equal((html.match(/Elapsed time \(s\)/g) ?? []).length, 11);
  assert.doesNotMatch(html, /<filter|<animate|<feGaussianBlur|<canvas|transition|box-shadow/);
});
