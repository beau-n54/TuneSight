export const REQUEST_LIMITS = {
  metadata: 32 * 1024,
  logUpload: 4 * 1024 * 1024 + 64 * 1024,
  tuneMetadata: 128 * 1024,
} as const;

export class RequestBoundaryError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Bound bytes while reading, including chunked requests without Content-Length. */
export async function boundedRequest(request: Request, maxBytes: number, timeoutMs = 20_000): Promise<Request> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new RequestBoundaryError(413, "Request is too large.");
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new RequestBoundaryError(408, "Request timed out.")); void reader.cancel().catch(() => undefined); }, timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RequestBoundaryError(413, "Request is too large.");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Request(request.url, { method: request.method, headers: request.headers, body: bytes, signal: request.signal });
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
