import { protectSubscriberRequest } from "@/lib/security/subscriberAccess.server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { readLatestSubscriberWorkshopSession, readSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";
import { loadSubscriberTableProjection } from "@/lib/calibration-workshop/sharedWorkspaceProjectionLoader";
import { loadSubscriberWorkspace } from "@/lib/calibration-workshop/sharedWorkspaceBootstrap";

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
    const owners = {
      authenticate: async () => { const { data: { user } } = await supabase.auth.getUser(); return user ? { id: user.id, scope: createHash("sha256").update(user.id).digest("hex").slice(0, 24) } : null; },
      ownsVehicle: async (ownerId: string, vehicleId: string) => { const { data, error } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", ownerId).single(); return !error && Boolean(data); },
      readSession: (id: string, ownerId: string, vehicleId: string) => readSubscriberWorkshopSession(id, ownerId, vehicleId, record),
      readLatest: (ownerId: string, vehicleId: string) => readLatestSubscriberWorkshopSession(ownerId, vehicleId, record),
      onTiming: record,
    };
    function record(phase: string, durationMs: number) { if (Number.isFinite(durationMs)) timings.push(`${phase};dur=${Math.max(0, durationMs).toFixed(1)}`); }
    const result = input?.kind === "workspace" ? await loadSubscriberWorkspace(input, owners) : await loadSubscriberTableProjection(input, owners);
    // Durations only: no owner, vehicle, session, Definition, path or evidence value.
    const serializeStart = performance.now(), body = JSON.stringify(result);
    record("serialization", performance.now() - serializeStart);
    headers.set("Server-Timing", timings.join(", "));
    headers.set("Content-Type", "application/json");
    return new Response(body, { status: result.status === "unavailable" ? result.code === "AUTH_REQUIRED" ? 401 : 409 : 200, headers });
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
