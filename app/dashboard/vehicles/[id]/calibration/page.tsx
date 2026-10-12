import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import Link from "next/link";
import IdentityOwnerSummary from "@/components/IdentityOwnerSummary";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { developmentCalibrationWorkshopProvider, readDevelopmentWorkspaceEvidence, selectN54PreviewRom } from "@/lib/calibration-workshop/developmentFixtureProvider.server";
import SharedWorkspaceClient, { EmptySharedWorkspace } from "./shared-workspace-client";
import { workspaceCatalogue, buildSharedWorkspacePayload, compactWorkspaceProjection, exactWorkspaceDefinition, projectWorkspaceTable, sharedWorkspaceContextKey, type SharedWorkspacePayload } from "@/lib/calibration-workshop/sharedWorkspaceAdapter";
import { maskRetainedWorkspace } from "@/lib/calibration-workshop/sharedWorkspaceDispatch";
import { buildWorkshopDeepLink } from "@/lib/calibration-workshop/workshopNavigation";
import { readLatestSubscriberWorkshopSession, readSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";
import UploadCalibration from "./upload-calibration";
import { selectRestoredSubscriberWorkshop } from "@/lib/calibration-workshop/selectRestoredSubscriberWorkshop";
import { publicWorkshopFailureDiagnostic } from "@/lib/calibration-workshop/workshopFailureDiagnostic";
import type { CurrentOnlyWorkshopViewModel } from "@/lib/calibration-workshop/currentOnlyViewModel";
import type { WorkshopViewModel } from "@/lib/calibration-workshop/viewModel";
import { createHash } from "node:crypto";
import { resolveSubscriberWorkshopSession, selectSubscriberWorkshopEntry } from "@/lib/calibration-workshop/subscriberWorkshopEntry";
import { resolveVehicleOwnedCalibrationEvidence } from "@/lib/calibration-workshop/vehicleOwnedCalibrationEvidence";
import RestoreCalibrationSession from "./restore-calibration-session";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ definition?: string | string[]; previewRom?: string | string[]; session?: string | string[] }>;
};

// Cold, fail-closed Dataset materialization parses controlled XDF/BIN Evidence.
// Deployment platforms consume this static route value from the Next build output.
export const maxDuration = 60;


export default async function CalibrationWorkshopPage({ params, searchParams }: PageProps) {
  await requireSubscriberPage();
  const { id } = await params;
  const query = await searchParams;
  const definition = Array.isArray(query.definition) ? query.definition[0] : query.definition;
  const requestedPreviewRom = Array.isArray(query.previewRom) ? query.previewRom[0] : query.previewRom;
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

  const session = await resolveSubscriberWorkshopSession({ requestedSession: query.session, ownerId: user.id, vehicleId: vehicle.id }, {
    readSession: readSubscriberWorkshopSession,
    readLatest: readLatestSubscriberWorkshopSession,
    recoverVehicle: async () => null,
  });
  const activeSubscriberSession = session.sessionId;
  const subscriberResult = session.result;
  const vehicleEvidence = resolveVehicleOwnedCalibrationEvidence({ ownerId: user.id, vehicleId: vehicle.id, result: subscriberResult });
  const subscriberSuccess = vehicleEvidence.workshop;
  const entry = selectSubscriberWorkshopEntry({ subscriberReady: Boolean(subscriberSuccess), explicitSession: session.explicit, requestedPreviewRom, runtimeEnvironment: process.env.NODE_ENV });
  if (entry.mode === "session_unavailable") {
    const result = subscriberResult?.status !== "workshop_ready" ? subscriberResult : null;
    return <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-4xl space-y-6"><Link href={`/dashboard/vehicles/${vehicle.id}`} className="inline-flex text-sm text-zinc-400 hover:text-white">← Back to Vehicle</Link><header className="bmw-border rounded-2xl bg-zinc-900 p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Calibration Workshop</p><h1 className="mt-2 text-3xl font-bold">{vehicle.nickname || "Unnamed Vehicle"}</h1><IdentityOwnerSummary vehicle={vehicle}/><div className="mt-5"><UploadCalibration vehicleId={vehicle.id}/></div></header><section className={`rounded-2xl border p-6 ${result?.coverage?.outcome === "CONFLICT" ? "border-red-400/40 bg-red-400/10" : "border-amber-400/35 bg-amber-400/10"}`} role="alert"><p className="text-xs font-bold uppercase tracking-[0.18em]">{result?.title ?? "Calibration session unavailable"}</p><h2 className="mt-3 text-2xl font-bold">{result?.message ?? "The bounded localhost session expired or is unavailable. Re-open the Calibration file."}</h2>{result&&<dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2"><dt className="text-zinc-500">ROM/software</dt><dd>{result.identity ?? "Not established"}</dd><dt className="text-zinc-500">Container</dt><dd>{result.container ?? "Unresolved"}</dd><dt className="text-zinc-500">Byte size</dt><dd>{result.byteLength?.toLocaleString() ?? "Unavailable"}</dd><dt className="text-zinc-500">Binary digest</dt><dd className="break-all font-mono text-xs">{result.digest ?? "Unavailable"}</dd><dt className="text-zinc-500">Definition coverage</dt><dd>{result.coverage?.outcome ?? "INVALID"}</dd></dl>}{result?.coverage?.findings.map(finding=><p key={finding} className="mt-3 text-sm text-zinc-300">{finding}</p>)}{result?.coverage?.discoveryPackage&&<p className="mt-3 break-all font-mono text-xs text-zinc-400">Discovery Evidence: {result.coverage.discoveryPackage.packageRevision}</p>}<p className="mt-4 text-sm">TuneSight did not guess or fall back to a Development Evidence Preview.</p></section></div></main>;
  }

  const sharedContext = { ownerId: createHash("sha256").update(user.id).digest("hex").slice(0, 24), vehicleId: vehicle.id, sessionId: activeSubscriberSession ?? null, sourceMode: entry.mode === "development_preview" ? "development_fixture" as const : "subscriber" as const };
  if (entry.mode === "empty") return <EmptySharedWorkspace upload={<><UploadCalibration vehicleId={vehicle.id}/><RestoreCalibrationSession vehicleId={vehicle.id}/></>} vehicle={vehicle} context={sharedContext} reason={subscriberResult && subscriberResult.status !== "workshop_ready" ? subscriberResult.message : "Open Calibration File to begin."}/>;

  if (entry.mode === "development_preview" && previewSelection.status === "invalid") {
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

  const previewRom = entry.mode === "development_preview" && previewSelection.status === "valid" ? previewSelection.rom : undefined;
  let workshop: WorkshopViewModel | CurrentOnlyWorkshopViewModel;
  let sharedPayload: SharedWorkspacePayload | null = null;
  try {
    workshop = subscriberSuccess ? selectRestoredSubscriberWorkshop(subscriberSuccess, definition) : await developmentCalibrationWorkshopProvider.loadVehicleWorkshop(vehicle.id, user.id, definition, previewRom);
    if (subscriberSuccess) {
      workshop = maskRetainedWorkspace(workshop, subscriberSuccess);
      sharedPayload = buildSharedWorkspacePayload(workshop, subscriberSuccess, sharedContext, definition);
    } else {
      const evidence = await readDevelopmentWorkspaceEvidence(previewRom);
      const selected = exactWorkspaceDefinition(workshop, definition);
      sharedPayload = { identity: evidence.identity, container: evidence.container, byteLength: evidence.byteLength, referenceAvailable: true,
        projection: selected ? compactWorkspaceProjection(projectWorkspaceTable(workshop, evidence, sharedContext, selected.key)) : null,
        finding: selected ? null : "Exact development Table selection is unresolved." };
    }
  }
  catch (error) {
    const diagnostic = publicWorkshopFailureDiagnostic(error);
    console.error("CALIBRATION_WORKSHOP_FAILURE", diagnostic.errorId, error);
    return <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-4xl space-y-6"><Link href={`/dashboard/vehicles/${vehicle.id}`} className="inline-flex text-sm text-zinc-400 hover:text-white">← Back to Vehicle</Link><section className="rounded-2xl border border-red-400/30 bg-zinc-900 p-6" role="alert"><h1 className="text-xl font-bold">Calibration Evidence unavailable</h1><p className="mt-2 text-sm text-zinc-400">The controlled Workshop Evidence could not be loaded. No calibration values have been substituted.</p><dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2"><dt className="text-zinc-500">Diagnostic ID</dt><dd className="font-mono">{diagnostic.errorId}</dd><dt className="text-zinc-500">Failure stage</dt><dd>{diagnostic.stage}</dd><dt className="text-zinc-500">Elapsed</dt><dd>{diagnostic.elapsedMs} ms</dd></dl>{Object.entries(diagnostic.completedStageTimings).length > 0 && <p className="mt-4 font-mono text-xs text-zinc-500">Completed: {Object.entries(diagnostic.completedStageTimings).map(([stage, elapsed]) => `${stage} ${elapsed} ms`).join(" · ")}</p>}<p className="mt-4 text-sm text-zinc-400">No file paths, binary data, identities, tokens or resource names are included in this diagnostic.</p></section></div></main>;
  }
  return <SharedWorkspaceClient upload={<><UploadCalibration vehicleId={vehicle.id}/><RestoreCalibrationSession vehicleId={vehicle.id}/></>} key={JSON.stringify([sharedWorkspaceContextKey(sharedContext, workshop), definition ?? null])} workshop={workspaceCatalogue(workshop)} evidence={sharedPayload!} context={sharedContext} vehicle={vehicle} requestedKey={definition}/>;
}
