import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { developmentCalibrationWorkshopProvider, selectN54PreviewRom } from "@/lib/calibration-workshop/developmentFixtureProvider.server";
import WorkshopClient from "./workshop-client";
import CurrentOnlyWorkshopClient from "./current-only-workshop-client";
import { buildWorkshopDeepLink } from "@/lib/calibration-workshop/workshopNavigation";
import { isSubscriberWorkshopSessionId, readSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";
import UploadCalibration from "./upload-calibration";
import { buildSubscriberWorkshop } from "@/lib/calibration-workshop/subscriberCalibrationProvider";
import { publicWorkshopFailureDiagnostic } from "@/lib/calibration-workshop/workshopFailureDiagnostic";
import type { CurrentOnlyWorkshopViewModel } from "@/lib/calibration-workshop/currentOnlyViewModel";
import type { WorkshopViewModel } from "@/lib/calibration-workshop/viewModel";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ definition?: string | string[]; previewRom?: string | string[]; session?: string | string[] }>;
};

// Cold, fail-closed Dataset materialization parses controlled XDF/BIN Evidence.
// Deployment platforms consume this static route value from the Next build output.
export const maxDuration = 60;

function isCurrentOnlyWorkshop(workshop: WorkshopViewModel | CurrentOnlyWorkshopViewModel): workshop is CurrentOnlyWorkshopViewModel { return "mode" in workshop && workshop.mode === "current_only"; }

export default async function CalibrationWorkshopPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const definition = Array.isArray(query.definition) ? query.definition[0] : query.definition;
  const requestedPreviewRom = Array.isArray(query.previewRom) ? query.previewRom[0] : query.previewRom;
  const requestedSubscriberSession = Array.isArray(query.session) ? query.session[0] : query.session;
  const subscriberSession = isSubscriberWorkshopSessionId(requestedSubscriberSession) ? requestedSubscriberSession : undefined;
  const previewSelection = selectN54PreviewRom(requestedPreviewRom);
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

  if (requestedSubscriberSession && !subscriberSession) redirect(`/dashboard/vehicles/${vehicle.id}/calibration`);

  const subscriberResult = subscriberSession ? await readSubscriberWorkshopSession(subscriberSession, user.id, vehicle.id) : null;
  if (subscriberSession && (!subscriberResult || subscriberResult.status !== "workshop_ready")) {
    const result = subscriberResult;
    return <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-4xl space-y-6"><Link href={`/dashboard/vehicles/${vehicle.id}`} className="inline-flex text-sm text-zinc-400 hover:text-white">← Back to Vehicle</Link><header className="bmw-border rounded-2xl bg-zinc-900 p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Calibration Workshop</p><h1 className="mt-2 text-3xl font-bold">{vehicle.nickname || "Unnamed Vehicle"}</h1><div className="mt-5"><UploadCalibration vehicleId={vehicle.id}/></div></header><section className={`rounded-2xl border p-6 ${result?.coverage?.outcome === "CONFLICT" ? "border-red-400/40 bg-red-400/10" : "border-amber-400/35 bg-amber-400/10"}`} role="alert"><p className="text-xs font-bold uppercase tracking-[0.18em]">{result?.title ?? "Calibration session unavailable"}</p><h2 className="mt-3 text-2xl font-bold">{result?.message ?? "The bounded localhost session expired or is unavailable. Re-open the Calibration file."}</h2>{result&&<dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2"><dt className="text-zinc-500">ROM/software</dt><dd>{result.identity ?? "Not established"}</dd><dt className="text-zinc-500">Container</dt><dd>{result.container ?? "Unresolved"}</dd><dt className="text-zinc-500">Byte size</dt><dd>{result.byteLength?.toLocaleString() ?? "Unavailable"}</dd><dt className="text-zinc-500">Binary digest</dt><dd className="break-all font-mono text-xs">{result.digest ?? "Unavailable"}</dd><dt className="text-zinc-500">Definition coverage</dt><dd>{result.coverage?.outcome ?? "INVALID"}</dd></dl>}{result?.coverage?.findings.map(finding=><p key={finding} className="mt-3 text-sm text-zinc-300">{finding}</p>)}{result?.coverage?.discoveryPackage&&<p className="mt-3 break-all font-mono text-xs text-zinc-400">Discovery Evidence: {result.coverage.discoveryPackage.packageRevision}</p>}<p className="mt-4 text-sm">TuneSight did not guess or fall back to a Development Evidence Preview.</p></section></div></main>;
  }

  if (!subscriberSession && previewSelection.status === "invalid") {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href={`/dashboard/vehicles/${vehicle.id}`} className="inline-flex text-sm text-zinc-400 transition hover:text-white">← Back to Vehicle</Link>
          <section className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-6" role="alert">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Development Evidence Preview unavailable</p>
            <h1 className="mt-3 text-2xl font-bold">Unknown preview ROM: {previewSelection.requested}</h1>
            <p className="mt-2 text-sm text-amber-50">No fixture was loaded and no fallback ROM was selected. Choose one governed current N54 preview.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const).map((rom) => <Link key={rom} href={buildWorkshopDeepLink({vehicleId:vehicle.id,previewRom:rom})} className="rounded-lg border border-amber-200/30 px-3 py-2 font-mono text-sm text-amber-100 hover:bg-amber-200/10">{rom}</Link>)}
            </div>
          </section>
        </div>
      </main>
    );
  }

  const subscriberSuccess = subscriberResult?.status === "workshop_ready" ? subscriberResult : null;
  const previewRom = previewSelection.status === "valid" ? previewSelection.rom : undefined;
  let workshop;
  try { workshop = subscriberSuccess ? buildSubscriberWorkshop(subscriberSuccess, definition) : await developmentCalibrationWorkshopProvider.loadVehicleWorkshop(vehicle.id, user.id, definition, previewRom); }
  catch (error) {
    const diagnostic = publicWorkshopFailureDiagnostic(error);
    console.error("CALIBRATION_WORKSHOP_FAILURE", diagnostic.errorId, error);
    return <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-4xl space-y-6"><Link href={`/dashboard/vehicles/${vehicle.id}`} className="inline-flex text-sm text-zinc-400 hover:text-white">← Back to Vehicle</Link><section className="rounded-2xl border border-red-400/30 bg-zinc-900 p-6" role="alert"><h1 className="text-xl font-bold">Calibration Evidence unavailable</h1><p className="mt-2 text-sm text-zinc-400">The controlled Workshop Evidence could not be loaded. No calibration values have been substituted.</p><dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2"><dt className="text-zinc-500">Diagnostic ID</dt><dd className="font-mono">{diagnostic.errorId}</dd><dt className="text-zinc-500">Failure stage</dt><dd>{diagnostic.stage}</dd><dt className="text-zinc-500">Elapsed</dt><dd>{diagnostic.elapsedMs} ms</dd></dl>{Object.entries(diagnostic.completedStageTimings).length > 0 && <p className="mt-4 font-mono text-xs text-zinc-500">Completed: {Object.entries(diagnostic.completedStageTimings).map(([stage, elapsed]) => `${stage} ${elapsed} ms`).join(" · ")}</p>}<p className="mt-4 text-sm text-zinc-400">No file paths, binary data, identities, tokens or resource names are included in this diagnostic.</p></section></div></main>;
  }
  const currentOnlyWorkshop = isCurrentOnlyWorkshop(workshop) ? workshop : null;
  const comparisonWorkshop = isCurrentOnlyWorkshop(workshop) ? null : workshop;

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
            <UploadCalibration vehicleId={vehicle.id}/>
          </div>
        </header>

        {subscriberSuccess ? <section className="rounded-2xl border border-blue-400/35 bg-blue-400/10 p-5" role="status"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Subscriber Calibration — Current</p><p className="mt-2 text-sm text-blue-50">This Workshop was materialized from the uploaded binary through exact governed Definition coverage. It is not the Development Evidence Preview.</p><dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><dt className="text-zinc-400">ROM/software</dt><dd>{subscriberSuccess.identity}</dd><dt className="text-zinc-400">Container / bytes</dt><dd>{subscriberSuccess.container} · {subscriberSuccess.byteLength.toLocaleString()}</dd><dt className="text-zinc-400">Exact digest</dt><dd className="break-all font-mono">{subscriberSuccess.digest}</dd><dt className="text-zinc-400">Coverage</dt><dd>{subscriberSuccess.coverage.outcome}</dd></dl></section> : <section className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-5" role="status">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Development Evidence Preview — {previewRom}</p>
          <p className="mt-2 text-sm leading-6 text-amber-50">
            This Workshop displays controlled qualified Calibration Evidence for interface development. It is not derived from this vehicle.
          </p>
          {comparisonWorkshop && <p className="mt-2 font-mono text-xs text-amber-200/70">{comparisonWorkshop.source.label} · {comparisonWorkshop.source.fixtureIdentity}</p>}
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Select development preview ROM">
            {(["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const).map((rom) => <Link key={rom} href={buildWorkshopDeepLink({vehicleId:vehicle.id,previewRom:rom})} aria-current={rom === previewRom ? "page" : undefined} className={`rounded-lg border px-3 py-2 font-mono text-xs ${rom === previewRom ? "border-amber-200 bg-amber-200/15 text-amber-50" : "border-amber-200/20 text-amber-200/70 hover:bg-amber-200/10"}`}>{rom}</Link>)}
          </div>
        </section>}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Calibration states">
          {workshop.states.map((state) => (
            <article key={state.id} className={`rounded-2xl border p-4 ${state.availability === "available" ? "border-blue-400/30 bg-zinc-900" : "border-zinc-800 bg-zinc-950"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{"label" in state ? state.label : state.id}</p>
              <p className={`mt-3 text-sm font-semibold ${state.availability === "available" ? "text-blue-200" : "text-zinc-500"}`}>{state.message}</p>
              {"sourceRole" in state && state.sourceRole && <p className="mt-1 text-xs text-zinc-500">Source role: {state.sourceRole}</p>}
            </article>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-label={currentOnlyWorkshop ? "Current Dataset summary" : "Comparison summary"}>
          {(currentOnlyWorkshop ? [
            ["Definitions", currentOnlyWorkshop.summary.totalDefinitions],
            ["Current available", currentOnlyWorkshop.summary.currentAvailable],
            ["Unavailable", currentOnlyWorkshop.summary.unavailable],
            ["Quarantined", currentOnlyWorkshop.summary.quarantined],
            ["Reference", "Not established"],
            ["Comparison", "Unavailable"],
          ] : [
            ["Definitions", comparisonWorkshop!.comparison.totalDefinitions],
            ["Changed", comparisonWorkshop!.comparison.changed],
            ["Unchanged", comparisonWorkshop!.comparison.unchanged],
            ["Axis Changed", comparisonWorkshop!.comparison.axisChanged],
            ["Unavailable", comparisonWorkshop!.comparison.unavailable],
            ["Conflicts", comparisonWorkshop!.comparison.conflicts],
            ["Changed Cells", comparisonWorkshop!.comparison.changedCells],
          ]).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
            </div>
          ))}
        </section>

        {currentOnlyWorkshop ? <CurrentOnlyWorkshopClient workshop={currentOnlyWorkshop} vehicleId={vehicle.id} subscriberSession={subscriberSession}/> : <WorkshopClient workshop={comparisonWorkshop!} vehicleId={vehicle.id} previewRom={subscriberSuccess ? undefined : previewRom} subscriberSession={subscriberSuccess ? subscriberSession : undefined} />}

        <details className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <summary className="cursor-pointer font-semibold text-zinc-200">Workshop concepts and evidence boundaries</summary>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-zinc-400 md:grid-cols-2 xl:grid-cols-4">
            <p><strong className="text-zinc-200">Reference:</strong> the qualified comparison baseline. Stock Candidate is not Verified Stock.</p>
            <p><strong className="text-zinc-200">Current Calibration:</strong> {subscriberSuccess ? "the qualified Dataset materialized from the subscriber-supplied binary." : "the qualified MapSwitch Dataset compared against Reference."}</p>
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
