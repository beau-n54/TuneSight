import assert from "node:assert/strict";
import test from "node:test";
import { completeObjectDeletion } from "./deletionWorkflow.ts";
test("interrupted object cleanup never removes its owning record and can be retried idempotently", async () => {
  const inventory = [{bucket:"logs",path:"owner/car/log.csv"},{bucket:"tunes",path:"owner/car/tune.bin"}];
  const removed = new Set<string>();let completed=0;
  await assert.rejects(completeObjectDeletion(inventory,async(bucket,paths)=>{if(bucket==="tunes")throw new Error("temporary");paths.forEach(path=>removed.add(path));},async()=>{completed++;}));
  assert.equal(completed,0);assert.equal(removed.size,1);
  await completeObjectDeletion(inventory,async(_bucket,paths)=>{paths.forEach(path=>removed.add(path));},async()=>{completed++;});
  assert.equal(completed,1);assert.equal(removed.size,2);
});
test("cleanup requests are bounded and unknown scopes never finish", async () => {
  const batchSizes:number[]=[];
  await completeObjectDeletion(Array.from({length:205},(_,i)=>({bucket:"logs",path:`owner/car/${i}`})),async(_bucket,paths)=>{batchSizes.push(paths.length);},async()=>undefined);
  assert.deepEqual(batchSizes,[100,100,5]);
  await assert.rejects(completeObjectDeletion([{bucket:"public",path:"wrong"}],async()=>assert.fail(),async()=>assert.fail()));
});
