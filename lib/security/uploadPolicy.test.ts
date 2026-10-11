import test from "node:test";
import assert from "node:assert/strict";
import { ownedStoragePath, TUNE_MAX_BYTES, validLogUpload, validTuneUpload } from "./uploadPolicy.ts";
import { LOG_MAX_ROWS, parseBoundedLogCsv } from "../logging/boundedCsv.ts";
import { maximumObserved, minimumObserved } from "../logging/numericSummary.ts";

test("six-cylinder summaries at the accepted row bound do not exceed the function argument limit", () => {
  const values = Array.from({ length: LOG_MAX_ROWS * 6 }, (_, i) => i === LOG_MAX_ROWS * 6 - 1 ? -12 : 0);
  assert.equal(minimumObserved(values), -12);
  assert.equal(maximumObserved(values), 0);
  assert.equal(minimumObserved([]), null);
  assert.equal(maximumObserved([]), null);
});
test("upload extensions, MIME and actual sizes must agree", () => {
  assert.equal(validLogUpload({ name: "run.csv", type: "text/csv", size: 100 }), true);
  assert.equal(validLogUpload({ name: "run.csv", type: "text/csv", size: 4 * 1024 * 1024 }), true);
  assert.equal(validLogUpload({ name: "run.csv", type: "text/csv", size: 4 * 1024 * 1024 + 1 }), false);
  for (const file of [{ name: "run.exe", type: "text/csv", size: 100 }, { name: "run.csv", type: "text/html", size: 100 }, { name: "run.csv", type: "text/csv", size: 16 * 1024 * 1024 }, { name: "run.csv", type: "text/csv", size: 0 }]) assert.equal(validLogUpload(file), false);
  assert.equal(validTuneUpload({ name: "current.bin", type: "application/octet-stream", size: TUNE_MAX_BYTES }), true);
  assert.equal(validTuneUpload({ name: "current.bin", type: "application/octet-stream", size: TUNE_MAX_BYTES + 1 }), false);
  assert.equal(validTuneUpload({ name: "current.dtf", type: "text/html", size: 5 }), false);
});
test("storage paths cannot cross owner/vehicle, traverse directories or select another bucket", () => {
  assert.equal(ownedStoragePath("alice/car-a/current.bin", "alice", "car-a"), true);
  for (const path of ["bob/car-a/current.bin", "alice/car-b/current.bin", "alice/car-a/../secret", "alice/car-a/%2e%2e", "alice/car-a/sub/file", "https://evil.test", null]) assert.equal(ownedStoragePath(path, "alice", "car-a"), false);
});
test("CSV preserves missingness and zero, rejects ambiguous headers, malformed and unbounded structure", () => {
  assert.deepEqual(parseBoundedLogCsv("Time,RPM\n0,\n1,0").rows, [{ Time: 0, RPM: null }, { Time: 1, RPM: 0 }]);
  for (const text of ["Time,Time\n0,1", "Time,RPM\n0", "Time,RPM\n0,\"1", "Time,RPM\n0,1\u0000", "Time,RPM"]) assert.throws(() => parseBoundedLogCsv(text));
  assert.equal(parseBoundedLogCsv("Time,RPM\n0,123rpm").rows[0].RPM, null);
});
test("CSV rejects misplaced quotes instead of manufacturing numeric observations", () => {
  for (const value of ['1"23"', '"12"3', '"12""', '"1" "2"']) {
    assert.throws(() => parseBoundedLogCsv(`Time,RPM\n0,${value}`));
  }
  assert.deepEqual(parseBoundedLogCsv('"Time","RPM"\n"0","123"').rows, [{ Time: 0, RPM: 123 }]);
  assert.equal(parseBoundedLogCsv('Time,RPM\n0,"1""2"').rows[0].RPM, null);
});
