import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function VehicleDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !vehicle) {
    notFound();
  }

  const { data: latestLog } = await supabase
    .from("logs")
    .select("log_name")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestTune } = await supabase
    .from("tunes")
    .select("tune_name")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/garage"
          className="inline-flex items-center text-zinc-400 transition hover:text-white"
        >
          ← Back to Garage
        </Link>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <p className="mb-2 text-sm text-zinc-400">Vehicle Dashboard</p>
          <h1 className="text-3xl font-bold">
            {vehicle.nickname || "Unnamed Vehicle"}
          </h1>
          <p className="mt-2 text-zinc-400">
            {vehicle.year || "Unknown Year"} {vehicle.make || "Unknown Make"}{" "}
            {vehicle.model || "Unknown Model"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Engine Code: {vehicle.engine_code || "Unknown"}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <InfoCard title="Fuel Type" value={vehicle.fuel_type || "Not set"} />
          <InfoCard
            title="Transmission"
            value={vehicle.transmission || "Not set"}
          />
          <InfoCard
            title="Tune Status"
            value={latestTune?.tune_name || "No tune uploaded"}
          />
          <InfoCard
            title="Log Status"
            value={latestLog?.log_name || "No log uploaded"}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <ActionCard
            href={`/dashboard/vehicles/${vehicle.id}/edit`}
            label="Vehicle Setup"
            value="Edit Vehicle Setup"
          />

          <ActionCard
            href={`/dashboard/vehicles/${vehicle.id}/logs`}
            label="Logs"
            value="Open Logs"
          />

          <ActionCard
            href={`/dashboard/vehicles/${vehicle.id}/tune`}
            label="Tune"
            value="Open Tune"
          />

          <ActionCard
            href={`/dashboard/vehicles/${vehicle.id}/analysis`}
            label="Analysis"
            value="Open Analysis"
          />
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bmw-border rounded-2xl bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ActionCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="bmw-border rounded-2xl bg-zinc-900 p-5 text-white transition hover:bg-zinc-800"
    >
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </Link>
  );
}