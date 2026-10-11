import { protectSubscriberRequest } from "@/lib/security/subscriberAccess.server";
import { createClient } from "@/lib/supabase/server";
import { claimUpload } from "@/lib/security/uploadAttempts.server";
import { UUID_PATTERN, validTuneUpload } from "@/lib/security/uploadPolicy";

async function prepare(request: Request) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { vehicleId, fileName, fileType, fileSize, digest } = await request.json();
  if (typeof vehicleId !== "string" || !UUID_PATTERN.test(vehicleId) || typeof fileName !== "string" || fileName.length > 255
    || typeof fileType !== "string" || typeof fileSize !== "number" || !validTuneUpload({ name: fileName, type: fileType, size: fileSize })
    || typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) return Response.json({ error: "Choose a BIN or DTF file up to 32 MiB." }, { status: 400 });
  const { data: vehicle } = await client.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", user.id).single();
  if (!vehicle) return Response.json({ error: "Vehicle unavailable." }, { status: 404 });
  const attempt = await claimUpload(client, vehicleId, "tune", digest);
  if (attempt.outcome === "busy") return Response.json({ error: "This file is already being processed. Retry after the upload lease expires (at most 30 minutes)." }, { status: 409 });
  return Response.json({ attempt, storagePath: `${user.id}/${vehicleId}/${attempt.resource_id}.${fileName.toLowerCase().endsWith(".dtf") ? "dtf" : "bin"}` }, { headers: { "Cache-Control": "no-store" } });
}
export const POST = protectSubscriberRequest(prepare, 4096);
