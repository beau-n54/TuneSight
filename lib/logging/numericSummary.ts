/** Iterate instead of spreading log samples into function arguments. Six
 * cylinder channels can contain 600,000 values at the supported row bound. */
export function minimumObserved(values: readonly number[]): number | null {
  if (!values.length) return null;
  return values.reduce((minimum, value) => Math.min(minimum, value), Infinity);
}

export function maximumObserved(values: readonly number[]): number | null {
  if (!values.length) return null;
  return values.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
}
