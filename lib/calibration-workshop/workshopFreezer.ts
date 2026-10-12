/** Revisit only work this freezer has completed, never trust a caller's shallow
 * Object.freeze. Weak membership retains no session, owner or evidence objects.
 * Copy mode recognizes only its own recursively copied/frozen output, so caller
 * values stay independent even when an outer input object is already frozen.
 */
export function createWorkshopFreezer(copy: boolean) {
  const completed = new WeakSet<object>();
  function visit<T>(value: T): T {
    if (!value || typeof value !== "object" || completed.has(value)) return value;
    let result: object;
    if (copy) {
      result = Array.isArray(value) ? value.map(visit)
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    } else {
      if (Array.isArray(value)) value.forEach(visit);
      else Object.values(value).forEach(visit);
      result = value;
    }
    Object.freeze(result);
    return result as T;
  }
  return function freeze<T>(value: T): T {
    const result = visit(value);
    // Remember completed subtrees passed at the public boundary, rather than
    // allocating weak membership for every cell tuple and scalar wrapper.
    if (result && typeof result === "object") completed.add(result);
    return result;
  };
}
