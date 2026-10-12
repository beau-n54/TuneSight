import { protectSubscriberRequest } from "@/lib/security/subscriberAccess.server";
import { durableWorkingRequest } from "@/lib/calibration-workshop/durableWorking.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const handle = protectSubscriberRequest(async (request, authority) => {
  try {
    const snapshot = await durableWorkingRequest(await request.json(), authority);
    return Response.json({ status: "ready", ...snapshot });
  } catch (error) {
    const code = error instanceof Error && /^WORKING_[A-Z_]+$/.test(error.message) ? error.message : "WORKING_STORE_UNAVAILABLE";
    return Response.json({ status: "unavailable", code, finding: code === "WORKING_RETENTION_LIMIT"
      ? "This vehicle reached its bounded revision-history limit. Existing history is preserved; no revision was discarded."
      : code.includes("CONFLICT")
      ? "Working changed on another device. Your edits are preserved here; reload durable history before choosing a continuation."
      : "Working could not be restored or saved. Keep this page open and retry; existing history is preserved." }, { status: 409 });
  }
}, 2 * 1024 * 1024 + 8192);
export async function POST(request: Request) {
  const response = await handle(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
