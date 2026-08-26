import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { developmentCalibrationWorkshopProvider } from "@/lib/calibration-workshop/developmentFixtureProvider";
import WorkshopClient from "./workshop-client";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ definition?: string }>;
};

export default async function CalibrationWorkshopPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { definition } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("id,nickname,year,make,model,engine_code")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !vehicle) notFound();

  const workshop = await developmentCalibrationWorkshopProvider.loadVehicleWorkshop(
    vehicle.id,
    user.id,
    definition,
  );

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <Link href={`/dashboard/vehicles/${vehicle.id}`} className="inline-flex text-sm text-zinc-400 transition hover:text-white">
          ← Back to Vehicle
        </Link>

        <header className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Calibration Workshop</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">{vehicle.nickname || "Unnamed Vehicle"}</h1>
              <p className="mt-2 text-zinc-400">
                {vehicle.year || "Unknown Year"} {vehicle.make || "Unknown Make"} {vehicle.model || "Unknown Model"}
                <span className="text-zinc-600"> · </span>{vehicle.engine_code || "Engine unknown"}
              </p>
            </div>
            <p className="font-mono text-xs text-zinc-500">READ-ONLY WORKSPACE</p>
          </div>
        </header>

        <section className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-5" role="status">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Development Evidence Preview</p>
          <p className="mt-2 text-sm leading-6 text-amber-50">
            This Workshop displays controlled qualified Calibration Evidence for interface development. It is not derived from this vehicle.
          </p>
          <p className="mt-2 font-mono text-xs text-amber-200/70">{workshop.source.label} · {workshop.source.fixtureIdentity}</p>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Calibration states">
          {workshop.states.map((state) => (
            <article key={state.id} className={`rounded-2xl border p-4 ${state.availability === "available" ? "border-blue-400/30 bg-zinc-900" : "border-zinc-800 bg-zinc-950"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{state.label}</p>
              <p className={`mt-3 text-sm font-semibold ${state.availability === "available" ? "text-blue-200" : "text-zinc-500"}`}>{state.message}</p>
              {state.sourceRole && <p className="mt-1 text-xs text-zinc-500">Source role: {state.sourceRole}</p>}
            </article>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-label="Comparison summary">
          {[
            ["Definitions", workshop.comparison.totalDefinitions],
            ["Changed", workshop.comparison.changed],
            ["Unchanged", workshop.comparison.unchanged],
            ["Axis Changed", workshop.comparison.axisChanged],
            ["Unavailable", workshop.comparison.unavailable],
            ["Conflicts", workshop.comparison.conflicts],
            ["Changed Cells", workshop.comparison.changedCells],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-white">{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </section>

        <WorkshopClient workshop={workshop} vehicleId={vehicle.id} />

        <details className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <summary className="cursor-pointer font-semibold text-zinc-200">Workshop concepts and evidence boundaries</summary>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-zinc-400 md:grid-cols-2 xl:grid-cols-4">
            <p><strong className="text-zinc-200">Reference:</strong> the qualified comparison baseline. Stock Candidate is not Verified Stock.</p>
            <p><strong className="text-zinc-200">Current Modified:</strong> the qualified MapSwitch Dataset compared against Reference.</p>
            <p><strong className="text-zinc-200">Changed cells:</strong> measured engineering-value differences; a change is Evidence, not danger.</p>
            <p><strong className="text-zinc-200">Unavailable:</strong> no numeric value is substituted when extraction or conversion cannot qualify a Definition.</p>
            <p><strong className="text-zinc-200">Engineering values:</strong> raw bytes converted under the bound Definition equation and units.</p>
            <p><strong className="text-zinc-200">TuneSight Suggested:</strong> reserved until authorised recommendation Evidence exists.</p>
            <p><strong className="text-zinc-200">Working Calibration:</strong> reserved for a future governed editing workflow.</p>
            <p><strong className="text-zinc-200">Semantics:</strong> engineering semantic interpretation is not yet bound.</p>
          </div>
        </details>
      </div>
    </main>
  );
}
