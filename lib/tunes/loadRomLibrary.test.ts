import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadRomLibrary } from "./loadRomLibrary.ts";

test("legacy ROM loader runs under the repository Node runner and preserves empty-source truth", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tunesight-rom-test-"));
  try {
    const result = loadRomLibrary(root);
    assert.deepEqual(result.files, []);
    assert.deepEqual(result.library, []);
    assert.equal(result.summary.totalEntries, 0);
    assert.equal(result.summary.entriesWithStockBin, 0);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(root, { recursive: true });
  }
});

test("optional private ROM library metadata remains internally consistent", { skip: !process.env.ROM_LIBRARY_ROOT && "ROM_LIBRARY_ROOT is not configured; private fixture is optional." }, () => {
  const result = loadRomLibrary(process.env.ROM_LIBRARY_ROOT!);
  assert.equal(result.summary.totalEntries, result.library.length);
  assert.ok(result.summary.entriesWithXdf <= result.summary.totalEntries);
  assert.ok(result.summary.entriesWithStockBin <= result.summary.totalEntries);
});
