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
    "primary-engineering-results",
    "engineering-telemetry",
    "engineering-evidence",
    "engineering-investigation",
    "calibration-context",
  ];
  const declaredIds = [
    ...source.matchAll(/\{ id: "([^"]+)", label:/g),
  ].map((match) => match[1]);

  assert.deepEqual(declaredIds, expectedIds);
  assert.equal(new Set(declaredIds).size, expectedIds.length);
});
