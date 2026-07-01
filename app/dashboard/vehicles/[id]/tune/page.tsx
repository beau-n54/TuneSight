import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBinaryTuneFile } from "@/lib/tunes/parseBinaryTune";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TunePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
  data: { user },
} = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (vehicleError || !vehicle) {
    notFound();
  }

  const { data: tunes } = await supabase
    .from("tunes")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

    const tuneIds = tunes?.map((t) => t.id) ?? [];

const { data: tuneProfiles } = await supabase
  .from("tune_profiles")
  .select("*")
  .in("tune_id", tuneIds);

  const tunesWithProfiles =
  tunes?.map((tune) => {
    const profile = tuneProfiles?.find((p) => p.tune_id === tune.id);

    return {
      ...tune,
      rom_platform: profile?.rom_platform ?? null,
      ecu_family: profile?.ecu_family ?? null,
      rom_family: profile?.rom_family ?? null,
      xdf_suggested: profile?.xdf_suggested ?? null,
      rom_confidence: profile?.rom_confidence ?? null,
    };
  }) ?? [];

    const latestTune = tunes?.[0];
    const stockTunes =
      tunes?.filter((t) => t.is_stock_reference) ?? [];

    const { data: latestTuneProfile } = await supabase
  .from("tune_profiles")
  .select("*")
  .eq("vehicle_id", vehicle.id)
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

const testTuneData = {
  detectedType:
    latestTuneProfile?.rom_platform ??
    latestTuneProfile?.detected_platform ??
    "CUSTOM binary tune profile",

  likelyRom:
    latestTuneProfile?.rom_family ??
    latestTuneProfile?.detected_rom ??
    "UNKNOWN",

  ecu:
    latestTuneProfile?.ecu_family ??
    "Unknown ECU",

  xdf:
    latestTuneProfile?.xdf_suggested ??
    "No XDF matched",

  confidence:
    typeof latestTuneProfile?.rom_confidence === "number"
      ? `${Math.round(latestTuneProfile.rom_confidence * 100)}%`
      : typeof latestTuneProfile?.confidence === "number"
        ? `${Math.round(latestTuneProfile.confidence * 100)}%`
        : "LOW",

  notes: [
    latestTuneProfile?.rom_platform
      ? `Platform detected: ${latestTuneProfile.rom_platform}`
      : "No platform detected.",
    latestTuneProfile?.ecu_family
      ? `ECU detected: ${latestTuneProfile.ecu_family}`
      : "No ECU detected.",
    latestTuneProfile?.rom_family
      ? `ROM detected: ${latestTuneProfile.rom_family}`
      : "No ROM detected.",
    latestTuneProfile?.xdf_suggested
      ? `XDF matched: ${latestTuneProfile.xdf_suggested}`
      : "No XDF matched.",
  ],
};

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/dashboard/vehicles/${id}`}
          className="inline-flex items-center text-zinc-400 transition hover:text-white"
        >
          ← Back to Vehicle
        </Link>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <h1 className="mb-2 text-3xl font-bold">Tune</h1>
          <p className="text-zinc-400">
            Upload and manage the tune file for this vehicle.
          </p>
        </div>

        <form
          action="/api/vehicles/update-tune"
          method="POST"
          encType="multipart/form-data"
          className="space-y-6"
        >
          <input type="hidden" name="vehicleId" value={id} />

          <div className="bmw-border rounded-2xl bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xl font-semibold">Upload Tune File</h2>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Tune File</label>
              <input
  type="file"
  name="tuneFile"
  accept=".bin,.hex,.rom"
  className="cursor-pointer block w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white file:cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-white hover:file:bg-zinc-700"
/>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Tune Name</label>
              <input
                type="text"
                name="tune_name"
                placeholder="Tune name (e.g. Stage 2 E50)"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>
          </div>
               <div className="flex items-center gap-3">
                 <input
                   type="checkbox"
                   id="is_stock_reference"
                   name="is_stock_reference"
                   className="h-4 w-4"
                 />

                 <label
                   htmlFor="is_stock_reference"
                   className="text-sm text-zinc-300"
                 >
                   Use as Stock Reference Tune
                 </label>
               </div>
               {stockTunes.length > 0 && (
  <div className="space-y-2">
    <label className="text-sm text-zinc-400">
      Compare Against Stock Reference
    </label>

    <select
      name="reference_tune_id"
      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
    >
      <option value="">
        No comparison reference selected
      </option>

      {stockTunes.map((stockTune) => (
        <option
          key={stockTune.id}
          value={stockTune.id}
        >
          {stockTune.tune_name ||
            stockTune.file_name ||
            "Unnamed Stock Tune"}
        </option>
      ))}
    </select>
  </div>
)}
          <button
  type="submit"
  className="bmw-border cursor-pointer rounded-xl bg-zinc-900 px-6 py-3 text-white transition hover:bg-zinc-800"
>
            Save Tune
          </button>
        </form>

<div className="bmw-border rounded-2xl bg-zinc-900 p-6">
  <h2 className="mb-4 text-xl font-semibold">
    Binary Tune Intelligence
  </h2>

  <div className="space-y-3 text-sm">
    <div>
      <span className="text-zinc-500">Detected Type:</span>{" "}
      <span className="text-white">
        {testTuneData.detectedType}
      </span>
    </div>

    <div>
      <span className="text-zinc-500">Likely ROM:</span>{" "}
      <span className="text-white">
        {testTuneData.likelyRom}
      </span>
    </div>

  <div>
  <span className="text-zinc-500">ECU:</span>{" "}
  <span className="text-white">
    {testTuneData.ecu}
  </span>
</div>

<div>
  <span className="text-zinc-500">XDF:</span>{" "}
  <span className="text-white">
    {testTuneData.xdf}
  </span>
</div>

    <div>
      <span className="text-zinc-500">Confidence:</span>{" "}
      <span className="text-yellow-400 uppercase">
        {testTuneData.confidence}
      </span>
    </div>

    <div className="pt-2">
      <p className="mb-2 text-zinc-500">Parser Notes</p>

      <ul className="space-y-1">
        {testTuneData.notes.map((note: string) => (
          <li
            key={note}   
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-zinc-300"
          >
            {note}
          </li>
        ))}
      </ul>
    </div>
  </div>
</div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">Tune History</h2>

          {tunesWithProfiles.length > 0 ? (
            <div className="space-y-3">
              {tunesWithProfiles.map((tune) => (
                <div
                  key={tune.id}
                  className="rounded-xl border border-white/10 bg-black/40 p-4"
                >
                  <p className="text-lg font-semibold text-white">
                    {tune.tune_name || tune.file_name || "Unnamed Tune"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">

  {tune.rom_platform && (
    <span className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-3 py-1 text-cyan-300">
      Platform: {tune.rom_platform}
    </span>
  )}

  {tune.ecu_family && (
    <span className="rounded-full bg-purple-500/20 border border-purple-400/40 px-3 py-1 text-purple-300">
      ECU: {tune.ecu_family}
    </span>
  )}

  {tune.rom_family && (
    <span className="rounded-full bg-green-500/20 border border-green-400/40 px-3 py-1 text-green-300">
      ROM: {tune.rom_family}
    </span>
  )}

  {tune.xdf_suggested && (
    <span className="rounded-full bg-yellow-500/20 border border-yellow-400/40 px-3 py-1 text-yellow-300">
      XDF: {tune.xdf_suggested}
    </span>
  )}

  {tune.rom_confidence && (
    <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-white">
      Confidence: {(tune.rom_confidence * 100).toFixed(0)}%
    </span>
  )}

</div>
{tune.binary_changed_bytes > 0 && (
  <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
    <p className="text-sm font-semibold text-orange-300">
      Binary Comparison Detected
    </p>

    <div className="mt-2 space-y-1 text-xs text-zinc-300">
      <p>
        Changed Bytes:{" "}
        <span className="text-white">
          {tune.binary_changed_bytes.toLocaleString()}
        </span>
      </p>

      <p>
        Modified Regions:{" "}
        <span className="text-white">
          {tune.binary_changed_regions?.length || 0}
        </span>
      </p>
    </div>
  </div>
)}

                  {tune.is_stock_reference && (
                    <div className="mt-2 inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-300">
                      Stock Reference Tune
                    </div>
                  )}
                  {tune.comparison_ready && (
                    <div className="mt-2 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                      Comparison Ready
                    </div>
                  )}

                  {tune.file_name && (
                    <p className="mt-1 text-sm text-zinc-400">
                      File: {tune.file_name}
                    </p>
                  )}

                  {tune.created_at && (
                    <p className="mt-1 text-sm text-zinc-500">
                      Uploaded: {new Date(tune.created_at).toLocaleString()}
                    </p>
                  )}

                  {tune.binary_changed_bytes > 0 && (
  <div className="mt-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm text-orange-200">
    <div className="font-semibold text-orange-300">
      Binary Comparison Detected
    </div>

    <div className="mt-2">
      Changed Bytes: {tune.binary_changed_bytes}
    </div>

    <div>
      Modified Regions:{" "}
      {tune.binary_changed_regions?.length ?? 0}
    </div>
  </div>
)}

                  {tune.file_url && (
                    <a
                      href={tune.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-sm text-blue-400 transition hover:text-blue-300"
                    >
                      Open Tune File
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-400">No tunes uploaded yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}