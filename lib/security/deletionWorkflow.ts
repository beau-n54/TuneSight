export type DeletionObject = Readonly<{ bucket: string; path: string }>;
/** Sequential, bounded batches; no owner record is removed until every object
 * deletion is confirmed. The durable inventory is supplied again after failure. */
export async function completeObjectDeletion(objects: readonly DeletionObject[], remove: (bucket: string, paths: string[]) => Promise<void>, finish: () => Promise<void>): Promise<void> {
  if (objects.length > 10016) throw new Error("Deletion inventory is too large.");
  if (objects.some(object => !["logs","tunes","subscriber-calibration-private"].includes(object.bucket) || !object.path)) throw new Error("Unknown deletion scope.");
  for (const bucket of ["logs", "tunes", "subscriber-calibration-private"]) {
    const paths = [...new Set(objects.filter(object => object.bucket === bucket).map(object => object.path))];
    for (let index = 0; index < paths.length; index += 100) await remove(bucket, paths.slice(index,index+100));
  }
  await finish();
}
