import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LogsPage({ params }: PageProps) {
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

  const { data: logs } = await supabase
    .from("logs")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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
          <h1 className="mb-2 text-3xl font-bold">Logs</h1>
          <p className="text-zinc-400">
            Upload and manage log files for this vehicle.
          </p>
        </div>

        <form
          action="/api/vehicles/update-log"
          method="POST"
          encType="multipart/form-data"
          className="space-y-6"
        >
          <input type="hidden" name="vehicleId" value={id} />

          <div className="bmw-border space-y-4 rounded-2xl bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Upload Log File</h2>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Log File</label>
              <input
                type="file"
                name="logFile"
                className="cursor-pointer block w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white file:cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-white hover:file:bg-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Log Name</label>
              <input
                type="text"
                name="log_name"
                placeholder="Log name (e.g. 3rd gear pull E50)"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bmw-border cursor-pointer rounded-xl bg-zinc-900 px-6 py-3 text-white transition hover:bg-zinc-800"
          >
            Save Log
          </button>
        </form>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">Log History</h2>

          {logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-white/10 bg-black/40 p-4"
                >
                  <p className="text-lg font-semibold text-white">
                    {log.log_name || log.file_name || "Unnamed Log"}
                  </p>

                  {log.file_name && (
                    <p className="mt-1 text-sm text-zinc-400">
                      File: {log.file_name}
                    </p>
                  )}

                  {log.created_at && (
                    <p className="mt-1 text-sm text-zinc-500">
                      Uploaded: {new Date(log.created_at).toLocaleString()}
                    </p>
                  )}

                  {log.file_url && (
                    <a
                      href={log.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-sm text-blue-400 transition hover:text-blue-300"
                    >
                      Open Log File
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-400">No logs uploaded yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}