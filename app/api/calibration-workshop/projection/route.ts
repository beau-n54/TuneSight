import { protectSubscriberRequest } from "@/lib/security/subscriberAccess.server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { readSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";
import { loadSubscriberTableProjection } from "@/lib/calibration-workshop/sharedWorkspaceProjectionLoader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Read-only projection request: no recovery, upload, session creation or persistence. */
async function handlePOST(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  const timings: string[] = [];
  try {
    const text = await request.text();
    if (text.length > 32768) return Response.json({ status: "unavailable", code: "INVALID_REQUEST", finding: "Projection request is too large." }, { status: 413, headers });
    const input = JSON.parse(text);
    const supabase = await createClient();
    const result = await loadSubscriberTableProjection(input, {
      authenticate: async () => { const { data: { user } } = await supabase.auth.getUser(); return user ? { id: user.id, scope: createHash("sha256").update(user.id).digest("hex").slice(0, 24) } : null; },
      ownsVehicle: async (ownerId, vehicleId) => { const { data, error } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", ownerId).single(); return !error && Boolean(data); },
      readSession: readSubscriberWorkshopSession,
      onTiming: (phase, durationMs) => { if (Number.isFinite(durationMs)) timings.push(`${phase};dur=${Math.max(0, durationMs).toFixed(1)}`); },
    });
    // Durations only: no owner, vehicle, session, Definition, path or evidence value.
    headers.set("Server-Timing", timings.join(", "));
    return Response.json(result, { status: result.status === "ready" ? 200 : result.code === "AUTH_REQUIRED" ? 401 : 409, headers });
  } catch {
    return Response.json({ status: "unavailable", code: "REQUEST_FAILED", finding: "Projection evidence is unavailable." }, { status: 400, headers });
  }
}

const protectedPOST = protectSubscriberRequest(handlePOST, 32768);
export async function POST(request: Request) {
  const start = performance.now(), response = await protectedPOST(request);
  // The shared guard sets no-store. Preserve the stricter private boundary here,
  // including rejected requests, without changing unrelated subscriber routes.
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.append("Server-Timing", `total;dur=${(performance.now() - start).toFixed(1)}`);
  return response;
}
