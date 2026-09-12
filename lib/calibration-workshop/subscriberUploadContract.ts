export const MAX_SUBSCRIBER_RESPONSE_BYTES = 64 * 1024;

export type SubscriberUploadOutcome =
  | { outcome: "upload_ready"; uploadId: string; uploadPath: string; uploadToken: string; lease: string }
  | { outcome: "workshop_ready" | "coverage_unavailable" | "invalid_upload"; session: string; status: string }
  | { outcome: "provider_rejection" | "session_failure" | "storage_failure" | "infrastructure_failure"; error: string };

async function readBoundedBody(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_SUBSCRIBER_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Calibration service returned an oversized response."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function decodeSubscriberUploadResponse(response: Response): Promise<SubscriberUploadOutcome> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SUBSCRIBER_RESPONSE_BYTES) throw new Error("Calibration service returned an oversized response.");
  const body = await readBoundedBody(response);
  if (!contentType.includes("application/json")) throw new Error(`Calibration service returned a non-JSON response (${response.status}).`);
  if (!body.trim()) throw new Error(`Calibration service returned an empty response (${response.status}).`);
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { throw new Error(`Calibration service returned invalid JSON (${response.status}).`); }
  if (!payload || typeof payload !== "object" || !("outcome" in payload)) throw new Error("Calibration service returned an invalid response contract.");
  const result = payload as SubscriberUploadOutcome;
  if (!response.ok) throw new Error("error" in result && typeof result.error === "string" ? result.error : `Calibration service request failed (${response.status}).`);
  return result;
}
