import assert from "node:assert/strict";
import test from "node:test";
import { createWorkshopFreezer } from "./workshopFreezer.ts";

test("copy freezer never trusts a caller's shallow-frozen cells, axes, semantics or capability", () => {
  const freeze = createWorkshopFreezer(true);
  const input = Object.freeze({ cells: [{ value: 12 }], axes: [{ values: [1000, 2000] }],
    semantic: { assertions: ["qualified"] }, capability: { blockers: ["locked"] } });
  const output = freeze(input);
  assert.deepEqual(output, input); assert.notEqual(output, input);
  assert.equal(Object.isFrozen(input.cells), false); assert.equal(Object.isFrozen(input.cells[0]), false);
  assert.equal(Object.isFrozen(input.axes[0].values), false);
  input.cells[0].value = 99; input.axes[0].values[0] = 999; input.semantic.assertions.push("caller change"); input.capability.blockers.length = 0;
  assert.equal(output.cells[0].value, 12); assert.equal(output.axes[0].values[0], 1000);
  assert.deepEqual(output.semantic.assertions, ["qualified"]); assert.deepEqual(output.capability.blockers, ["locked"]);
  for (const value of [output, output.cells, output.cells[0], output.axes, output.axes[0].values, output.semantic.assertions, output.capability.blockers])
    assert.equal(Object.isFrozen(value), true);
});

for (const copy of [false, true]) test(`completed deep-freeze traversal is not repeated (copy=${copy})`, () => {
  const freeze = createWorkshopFreezer(copy); let reads = 0;
  const input = new Proxy({ children: [{ value: 1 }] }, { ownKeys(target) { reads++; return Reflect.ownKeys(target); } });
  const first = freeze(input), baseline = reads;
  const outer = freeze({ first, repeated: first, array: [first] });
  assert.equal(reads, baseline); assert.equal(outer.first, first); assert.equal(outer.repeated, first); assert.equal(outer.array[0], first);
  assert.equal(freeze(first), first);
});

test("in-place freezer still descends into shallow-frozen inputs and keeps existing object identity", () => {
  const freeze = createWorkshopFreezer(false), child = { values: [1, 2] }, input = Object.freeze({ child });
  assert.equal(freeze(input), input); assert.equal(Object.isFrozen(child), true); assert.equal(Object.isFrozen(child.values), true);
});

test("a separate caller input is copied independently despite equal values", () => {
  const freeze = createWorkshopFreezer(true), input = { cells: [{ value: 1 }] };
  const first = freeze(input), second = freeze(input);
  assert.deepEqual(first, second); assert.notEqual(first, second); assert.notEqual(first.cells, second.cells);
  input.cells[0].value = 2; assert.equal(freeze(input).cells[0].value, 2); assert.equal(first.cells[0].value, 1);
});
