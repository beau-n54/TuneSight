import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("declares the permanent Engineering Workspace hierarchy once and in order", () => {
  const source = readFileSync(
    new URL("./EngineeringWorkspaceShell.tsx", import.meta.url),
    "utf8"
  );
  const expectedIds = [
    "engineering-summary",
    "engineering-telemetry",
    "primary-engineering-results",
    "engineering-investigation",
    "calibration-context",
    "engineering-evidence",
  ];
  const declaredIds = [
    ...source.matchAll(/\{ id: "([^"]+)", label:/g),
  ].map((match) => match[1]);

  assert.deepEqual(declaredIds, expectedIds);
  assert.equal(new Set(declaredIds).size, expectedIds.length);
});
