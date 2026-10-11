import { createClient } from "@/lib/supabase/server";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { protectSubscriberRequest } from "@/lib/security/subscriberAccess.server";
import { ownedStoragePath, UUID_PATTERN } from "@/lib/security/uploadPolicy";

async function download(request: Request): Promise<Response> {
  const url = new URL(request.url), kind = url.searchParams.get("kind"), id = url.searchParams.get("id");
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if ((kind !== "log" && kind !== "tune") || !id || !UUID_PATTERN.test(id)) return Response.json({ error: "Source unavailable." }, { status: 404, headers });
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers });
  const { data: row, error } = await client.from(kind === "log" ? "logs" : "tunes").select(kind === "log" ? "vehicle_id,raw_source_storage_path,file_url" : "vehicle_id,storage_path,file_url").eq("id", id).eq("user_id", user.id).single();
  if (error || !row) return Response.json({ error: "Source unavailable." }, { status: 404, headers });
  const source = row as unknown as { vehicle_id: string; raw_source_storage_path?: string; storage_path?: string; file_url?: string };
  const { data: vehicle } = await client.from("vehicles").select("id").eq("id", source.vehicle_id).eq("user_id", user.id).single();
  if (!vehicle) return Response.json({ error: "Source unavailable." }, { status: 404, headers });
  let path = kind === "log" ? source.raw_source_storage_path : source.storage_path;
  // Legacy records may contain only a signed URL. Extract a same-project,
  // same-bucket owned path, never follow the old bearer URL or an arbitrary host.
  if (!path && source.file_url) {
    try {
      const legacy = new URL(source.file_url), configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
      const prefix = `/storage/v1/object/sign/${kind === "log" ? "logs" : "tunes"}/`;
      if (legacy.origin === configured.origin && legacy.pathname.startsWith(prefix)) path = decodeURIComponent(legacy.pathname.slice(prefix.length));
    } catch { /* unrecognised legacy URL remains unavailable */ }
  }
  if (!ownedStoragePath(path, user.id, source.vehicle_id)) return Response.json({ error: "Original source path unavailable. Reopen the original file." }, { status: 404, headers });
  const signed = await createTrustedServerClient().storage.from(kind === "log" ? "logs" : "tunes").createSignedUrl(path, 60, { download: true });
  if (signed.error || !signed.data) return Response.json({ error: "Source download is temporarily unavailable. Retry this link." }, { status: 503, headers });
  return new Response(null, { status: 303, headers: { ...headers, Location: signed.data.signedUrl } });
}
export const GET = protectSubscriberRequest(download, 0);
