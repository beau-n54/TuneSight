import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./EngineeringTerrainRenderer.tsx", import.meta.url),
  "utf8"
);

test("Terrain is an independent Canvas 2D renderer", () => {
  assert.match(source, /<canvas aria-hidden="true"/);
  assert.match(source, /canvas\.getContext\("2d"\)/);
  assert.doesNotMatch(source, /from "recharts"|<Line|<Area|<ReferenceLine/);
});

test("Terrain has no continuous animation or random generation", () => {
  assert.doesNotMatch(source, /Math\.random|setInterval|requestAnimationFrame/);
  assert.match(source, /ResizeObserver/);
  assert.match(source, /observer\.disconnect\(\)/);
});

test("Canvas display width cannot create ResizeObserver feedback", () => {
  assert.match(source, /container\.clientWidth/);
  assert.match(source, /container\.clientHeight/);
  assert.match(source, /availableHeight - 48/);
  assert.match(source, /const viewportWidth = window\.innerWidth/);
  assert.match(source, /getTerrainResponsiveProfile\(viewportWidth\)/);
  assert.match(source, /className="block w-full"/);
  assert.doesNotMatch(source, /canvas\.style\.width/);
});

test("Terrain exposes exact disclosure and keyboard traversal", () => {
  assert.match(
    source,
    /Visual terrain only\. Engineering values are represented by the highlighted ridge\./
  );
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /event\.key === "Home"/);
  assert.match(source, /event\.key === "End"/);
  assert.match(source, /event\.key === "Escape"/);
});

test("Terrain tooltip receives the original resolved point", () => {
  assert.match(source, /resolveTerrainPointer\(authoritativeVertices/);
  assert.match(source, /point=\{activePoint\}/);
  assert.match(source, /point\[series\.id\]/);
  assert.doesNotMatch(source, /getImageData|toDataURL/);
});

test("Terrain always renders exact Sample Sequence and preserves series colour language", () => {
  assert.match(
    source,
    /\(vertex\.sourcePoint\.index \+ 1\)\.toLocaleString\(\)/
  );
  assert.match(source, /Sample Sequence \{\(point\.index \+ 1\)\.toLocaleString\(\)\}/);
  assert.match(source, /recorded RPM/);
  assert.doesNotMatch(source, /usesRpm/);
  assert.match(source, /drawHorizontalAxis\(/);
  assert.match(source, /profile\.profile === "desktop" \? 6/);
  assert.match(source, /colorWithAlpha\(color/);
  assert.match(
    source,
    /drawTerrainRows\(\s*context,\s*projectedTerrain\.rows,\s*series\.color,\s*meshLuminosity\s*\)/
  );
});

test("Terrain restores restrained value ticks without deriving engineering values", () => {
  assert.match(source, /heightfield\.majorValueTicks/);
  assert.match(source, /drawValueAxis\(context, heightfield, size, series\.color\)/);
  assert.match(source, /meshLuminosity = series\.id === "afr" \? 0\.72 : 1/);
  assert.match(source, /heightfield\.majorColumnPositions/);
  assert.doesNotMatch(source, /horizontalAxisLabel === "Engine Speed \(RPM\)"/);
});

test("Terrain draws deterministic cross-grid connectivity", () => {
  assert.match(source, /projectedTerrainColumn\(terrain, normalizedPosition\)/);
  assert.match(source, /drawColumns\(/);
  assert.match(source, /heightfield\.minorColumnPositions/);
  assert.match(source, /heightfield\.majorColumnPositions/);
});

test("decorative mesh weight recedes toward the horizon", () => {
  assert.match(source, /context\.createLinearGradient\(/);
  assert.match(source, /gradient\.addColorStop\(0,/);
  assert.match(source, /gradient\.addColorStop\(0\.48,/);
  assert.match(source, /gradient\.addColorStop\(1,/);
});

test("Terrain failure remains local and preserves a Line escape path", () => {
  assert.match(source, /Canvas 2D is unavailable in this browser/);
  assert.match(source, /Terrain renderer could not draw this telemetry/);
  assert.match(source, /Use Line view for conventional inspection/);
});
