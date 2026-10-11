/** Abort the actual fetch so a timed-out auth request cannot later change the session. */
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  // Fetch resolves at response headers. Keep the deadline attached while its
  // JSON/blob body is consumed so a stalled body cannot bypass the timeout.
  const deadline = AbortSignal.timeout(timeoutMs);
  const existing = init.signal ?? (input instanceof Request ? input.signal : undefined);
  const signal = existing ? AbortSignal.any([existing, deadline]) : deadline;
  return fetch(input, { ...init, signal });
}
