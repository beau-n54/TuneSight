import assert from "node:assert/strict";
import test from "node:test";
import { listPage } from "./listBounds.ts";
test("list offsets are bounded integer pages and never accept ambiguous or negative values",()=>{
  assert.equal(listPage("999"),999);assert.equal(listPage("2"),2);
  for(const value of [undefined,null,[],["1"],"-1","1e9","1000","Infinity","1.5"]) assert.equal(listPage(value),0);
});
