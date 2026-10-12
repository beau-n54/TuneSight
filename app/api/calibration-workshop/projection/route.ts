import { protectSubscriberRequest, type SubscriberRequestAuthority } from "@/lib/security/subscriberAccess.server";
import { createHash } from "node:crypto";
import { readLatestSubscriberWorkshopSession, readSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";
import { loadSubscriberTableProjection } from "@/lib/calibration-workshop/sharedWorkspaceProjectionLoader";
import { loadSubscriberWorkspace } from "@/lib/calibration-workshop/sharedWorkspaceBootstrap";
import { durableWorkingRequest, readWorkingCandidate, type WorkingCandidate } from "@/lib/calibration-workshop/durableWorking.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Read-only projection request: no recovery, upload, session creation or persistence. */
async function handlePOST(request: Request, authority: SubscriberRequestAuthority) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  const timings: string[] = [];
  try {
    const text = await request.text();
    if (text.length > 32768) return Response.json({ status: "unavailable", code: "INVALID_REQUEST", finding: "Projection request is too large." }, { status: 413, headers });
    const input = JSON.parse(text);
    const { supabase, user } = authority;
    record("entitlement_auth", authority.authorizationMs);
    // Per-request promise only; no entitlement/session/revision cache. An early
    // database read overlaps storage and is unusable until exact admission passes.
    const candidates = new Map<string, Promise<{ rows: WorkingCandidate[] } | null>>();
    const startWorking = (id: string, ownerId: string, vehicleId: string) => {
      if (input?.kind === "workspace" && !candidates.has(id)) candidates.set(id,
        readWorkingCandidate(ownerId, vehicleId, id).then(rows => ({ rows }), () => null));
    };
    const owners = {
      authenticate: async () => ({ id: user.id, scope: createHash("sha256").update(user.id).digest("hex").slice(0, 24) }),
      ownsVehicle: async (ownerId: string, vehicleId: string) => { const { data, error } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", ownerId).single(); return !error && Boolean(data); },
      readSession: (id: string, ownerId: string, vehicleId: string) => { startWorking(id, ownerId, vehicleId); return readSubscriberWorkshopSession(id, ownerId, vehicleId, record); },
      readLatest: async (ownerId: string, vehicleId: string, hint?: string) => {
        if (hint) startWorking(hint, ownerId, vehicleId);
        const found = await readLatestSubscriberWorkshopSession(ownerId, vehicleId, record, hint);
        if (found) startWorking(found.sessionId, ownerId, vehicleId);
        return found;
      },
      readWorking: async (sessionId: string, session: Parameters<NonNullable<import("@/lib/calibration-workshop/sharedWorkspaceBootstrap").WorkspaceBootstrapOwners["readWorking"]>>[1]) => {
        try {
          const candidate = await candidates.get(sessionId);
          if (!candidate || session.status !== "workshop_ready") return { status: "unavailable" as const };
          const snapshot = await durableWorkingRequest({ action: "read", sessionId, vehicleId: input.vehicleId,
            datasetId: session.material.current.datasetId, datasetRevision: session.material.current.datasetRevision }, authority, { session, candidate: candidate.rows });
          return { status: "ready" as const, snapshot };
        } catch { return { status: "unavailable" as const }; }
      },
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
