import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildActionableFixes } from "@/lib/analysis/actionableFixes";
import { validateBoostAgainstTune } from "@/lib/analysis/boostValidation";
import type { AnalysisWarning } from "@/lib/analysis/core/analysisWarning";
import type { RoutedEvent } from "@/lib/analysis/types";
import { WorkshopDiagnosticCard } from "@/lib/components/diagnostics/WorkshopDiagnosticCard";
import { groupDiagnosticEvents } from "@/lib/diagnostics/groupDiagnosticEvents";
import { buildHistoricalDiagnosticEvents } from "@/lib/diagnostics/buildHistoricalDiagnosticEvents";
import TelemetryGraphV1 from "./TelemetryGraphV1";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type FlagTone = "good" | "warn" | "bad" | "info";

type AnalysisFlag = {
  title: string;
  message: string;
  tone: FlagTone;
};

type SuggestedFix = {
  title: string;
  action: string;
};

type EngineQuickVerdict = {
  status?: "healthy" | "caution" | "critical";
  summary?: string;
  confidence?: number;
  pullQuality?: "strong" | "usable" | "questionable";
};

type EngineWarning = {
  id?: string;
  title?: string;
  severity?: "low" | "medium" | "high" | "critical";
  summary?: string;
  rpmRange?: [number, number];
  confidence?: number;
  supportingEvidence?: string[];
};

type EngineFix = {
  id?: string;
  title?: string;
  recommendation?: string;
  rationale?: string;
};

type EngineEvent = {
  id?: string;
  type?: string;
  severity?: "low" | "medium" | "high" | "critical";
  confidence?: number;
  rpmStart?: number;
  rpmEnd?: number;
  evidence?: string[];
  supportingChannels?: string[];
  metrics?: Record<string, number | string | boolean | null>;
};

type LikelyCause = {
  label?: string;
  score?: number;
  reason?: string;
};

type EngineCrossReference = {
  eventId?: string;
  primaryTuneAreas?: string[];
  secondaryTuneAreas?: string[];
  protectionAreas?: string[];
  hardwareFactors?: string[];
  likelyCauses?: LikelyCause[];
  notes?: string[];
};

type EngineV2 = {
  quickVerdict?: EngineQuickVerdict;
  warnings?: EngineWarning[];
  pipelineWarnings?: AnalysisWarning[];
  suggestedFixes?: EngineFix[];
  pullWindows?: unknown[];
  events?: EngineEvent[];
  routedEvents?: RoutedEvent[];
  crossReferences?: EngineCrossReference[];
  telemetry?: unknown;
  worstCylinder?: string | null;
  diagnosticTimeline?: {
  timestamp: number;
  event: string;
  severity: "low" | "medium" | "high" | "critical";
}[];
};

type TuneProfileRow = {
  id?: string;
  tune_id?: string | null;
  detected_platform?: string | null;
  detected_strategy?: string | null;
  detected_rom?: string | null;
  parsing_status?: string | null;
  confidence?: number | null;
  boost_intent?: string | null;
  ignition_intent?: string | null;
  fueling_intent?: string | null;
  categories?: string[] | null;
  notes?: string[] | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  file_hash?: string | null;
  created_at?: string | null;
};

export default async function AnalysisPage({ params }: PageProps) {
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

  const { data: latestLog } = await supabase
    .from("logs")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestTune } = await supabase
    .from("tunes")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestTuneProfile: TuneProfileRow | null = null;

  if (latestTune?.id) {
    const { data } = await supabase
      .from("tune_profiles")
      .select("*")
      .eq("tune_id", latestTune.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestTuneProfile = (data as TuneProfileRow | null) || null;
  }

  if (!latestTuneProfile) {
    const { data } = await supabase
      .from("tune_profiles")
      .select("*")
      .eq("vehicle_id", vehicle.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestTuneProfile = (data as TuneProfileRow | null) || null;
  }

  const { data: latestSummary } = latestLog
  ? await supabase
      .from("log_summaries")
      .select("*")
      .eq("log_id", latestLog.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  : { data: null };

const { data: historicalSummaries } = await supabase
  .from("log_summaries")
  .select("*")
  .eq("vehicle_id", vehicle.id)
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(5);

  const effectiveTuneProfile =
  latestTuneProfile &&
  Number(latestSummary?.ethanol_content ?? 0) >= 50 &&
  latestTuneProfile.fueling_intent === "pump"
    ? {
        ...latestTuneProfile,
        fuelingIntent: "full_ethanol",
        fueling_intent: "full_ethanol",
      }
    : latestTuneProfile;

  const throttleClosureText =
    latestSummary?.throttle_closure_detected === true
      ? "Yes"
      : latestSummary?.throttle_closure_detected === false
      ? "No"
      : "No data";

  const boostError = calculateBoostError(
    latestSummary?.max_boost,
    latestSummary?.max_boost_target
  );

  const engineV2 = getEngineV2(latestSummary);

  const fallbackWarnings = buildWarnings(latestSummary, boostError, vehicle);
  const fallbackFlags = buildAnalysisFlags(latestSummary, boostError, vehicle);
  const fallbackFixes = buildSuggestedFixes(latestSummary, boostError, vehicle);

const legacyPipelineWarnings: EngineWarning[] =
  (engineV2?.pipelineWarnings ?? []).map((warning) => ({
    id: warning.id,
    title: warning.title,
    summary: warning.message,
    severity:
      warning.severity === "critical"
        ? "critical"
        : warning.severity === "warning"
          ? "medium"
          : "low",
  }));

  const routedEvents = engineV2?.routedEvents ?? [];

const renderedWarnings =
  engineV2?.warnings?.length || legacyPipelineWarnings.length
    ? [
        ...(engineV2?.warnings ?? []),
        ...legacyPipelineWarnings,
      ]
        .filter(
          (warning, index, array) =>
            index ===
            array.findIndex(
              (item) =>
                item.title === warning.title &&
                (item.summary ?? "") === (warning.summary ?? "")
            )
        )
        .sort(sortWarnings)
        .map(mapLegacyWarningToFlag)
    : fallbackWarnings;

  const renderedFixes = engineV2?.suggestedFixes?.length
    ? engineV2.suggestedFixes.map(mapEngineFixToCard)
    : fallbackFixes;

  const renderedVerdictFlags = engineV2?.quickVerdict
    ? buildVerdictFlagsFromEngine(engineV2.quickVerdict)
    : fallbackFlags;

  const enginePullCount = Array.isArray(engineV2?.pullWindows)
    ? engineV2.pullWindows.length
    : 0;

  const engineEventCount = Array.isArray(engineV2?.events)
    ? engineV2.events.length
    : 0;

  const engineEvents = Array.isArray(engineV2?.events)
    ? [...engineV2.events].sort(sortEvents)
    : [];

  const worstCylinder = engineV2?.worstCylinder ?? null;

  const diagnosticTimeline: {
  timestamp: number;
  event: string;
  severity: "low" | "medium" | "high" | "critical";
}[] = engineV2?.diagnosticTimeline ?? [];

const worstCylinderCorrection =
  worstCylinder && latestSummary?.cylTimingCorrections
    ? latestSummary.cylTimingCorrections[worstCylinder] ?? null
    : null;

const worstCylinderSeverity =
  typeof worstCylinderCorrection === "number" && worstCylinderCorrection <= -5
    ? "bad"
    : typeof worstCylinderCorrection === "number" && worstCylinderCorrection <= -3
      ? "warn"
      : "good";

  const engineCrossReferences = Array.isArray(engineV2?.crossReferences)
    ? engineV2.crossReferences
    : [];

const xdfCrossReferences = Array.isArray((engineV2 as any)?.xdfCrossReferences)
  ? (engineV2 as any).xdfCrossReferences
  : [
    
      {
        tableName: "Fuel Pressure Target / HPFP Control",
        category: "fueling",
        matchReason: "Fallback XDF reference for rail pressure and HPFP capacity findings",
      },
      {
        tableName: "Low Pressure Fuel Pump Control",
        category: "fueling",
        matchReason: "Fallback XDF reference for LPFP drop findings",
      },
      {
        tableName: "Boost Target Main",
        category: "boost",
        matchReason: "Fallback XDF reference for boost target findings",
      },
      {
        tableName: "Wastegate Duty Cycle Base",
        category: "boost",
        matchReason: "Fallback XDF reference for WGDC and boost control findings",
      },
      {
        tableName: "Ignition Timing Main",
        category: "timing",
        matchReason: "Fallback XDF reference for timing correction findings",
      },
      {
        tableName: "Torque / Load Limiters",
        category: "torque",
        matchReason: "Fallback XDF reference for throttle closure and torque intervention findings",
      },
    ];
console.log("XDF CROSS REFERENCES:", xdfCrossReferences);
const tuneProfile = effectiveTuneProfile;

const tuneReasoningFlags = buildTuneReasoningFlags(
  tuneProfile,
  latestSummary,
  vehicle,
  engineCrossReferences,
  engineEvents
);

const actionableFixes = buildActionableFixes({
  tuneProfile,
  summary: latestSummary,
  tuneReasoningFlags,
  warnings: renderedWarnings,
  routedEvents,
  engineFixes: engineV2?.suggestedFixes || [],
  historicalSummaries: historicalSummaries || [],
});

const historicalDiagnosticEvents =
  buildHistoricalDiagnosticEvents(
    historicalSummaries || []
  );

function getRelatedXdfTablesForEvent(event: any, xdfCrossReferences: any[] = []) {
  if (!event || !Array.isArray(xdfCrossReferences)) return [];

  const eventText = [
    event.title,
    event.name,
    event.message,
    event.description,
    event.category,
    event.type,
    event.source,
    event.reason,
    event.action,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return xdfCrossReferences.filter((xdf) => {
    const xdfText = [
      xdf.tableName,
      xdf.name,
      xdf.category,
      xdf.description,
      xdf.axis,
      xdf.matchReason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!xdfText || !eventText) return false;

    const isHpfpEvent =
  eventText.includes("hpfp") ||
  eventText.includes("rail") ||
  eventText.includes("fuel pressure") ||
  eventText.includes("fuel pressure target");

const isLpfpEvent =
  eventText.includes("lpfp") ||
  eventText.includes("low pressure") ||
  eventText.includes("low pressure fuel");

const isThrottleEvent =
  eventText.includes("throttle") ||
  eventText.includes("closure") ||
  eventText.includes("torque") ||
  eventText.includes("load limit");

const isTimingEvent =
  eventText.includes("timing") ||
  eventText.includes("ignition") ||
  eventText.includes("multi cyl") ||
  eventText.includes("correction");

const isTopEndTaperEvent =
  eventText.includes("top end") ||
  eventText.includes("taper") ||
  eventText.includes("boost target") ||
  eventText.includes("wgdc");

const isOverboostEvent =
  eventText.includes("overboost") ||
  eventText.includes("overshoot") ||
  eventText.includes("boost control") ||
  eventText.includes("boost above target");  

return (
  (isHpfpEvent &&
    (xdfText.includes("fuel pressure target") ||
      xdfText.includes("hpfp") ||
      xdfText.includes("high pressure fuel") ||
      xdfText.includes("rail pressure"))) ||

  (isLpfpEvent &&
    (xdfText.includes("lpfp") ||
      xdfText.includes("low pressure fuel") ||
      xdfText.includes("fuel pump"))) ||

  (isThrottleEvent &&
    (xdfText.includes("throttle") ||
      xdfText.includes("torque") ||
      xdfText.includes("load limiter") ||
      xdfText.includes("load limit"))) ||

  (isTimingEvent &&
    (xdfText.includes("ignition timing") ||
      xdfText.includes("timing main") ||
      xdfText.includes("timing correction") ||
      xdfText.includes("spark"))) ||

    (isOverboostEvent &&
    (xdfText.includes("boost target") ||
      xdfText.includes("wgdc") ||
      xdfText.includes("wastegate") ||
      xdfText.includes("boost ceiling") ||
      xdfText.includes("boost control"))) ||    

  (isTopEndTaperEvent &&
    (xdfText.includes("boost target") ||
      xdfText.includes("wgdc") ||
      xdfText.includes("wastegate") ||
      xdfText.includes("boost ceiling")))
);
  }).slice(0, 6);
}

const renderedRoutedEvents = [
  ...routedEvents,
  ...historicalDiagnosticEvents,
].sort((a, b) => b.priority - a.priority);

const groupedDiagnosticEvents =
  groupDiagnosticEvents(renderedRoutedEvents);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href={`/dashboard/vehicles/${id}`}
          className="inline-flex items-center text-zinc-400 transition hover:text-white"
        >
          ← Back to Vehicle
        </Link>
      </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <p className="mb-2 text-sm text-zinc-400">Analysis</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {vehicle.nickname || "Unnamed Vehicle"}
              </h1>
              <p className="mt-2 text-zinc-400">
                {engineV2
                  ? "Engine v2 analysis loaded from the latest uploaded log."
                  : "First-pass analysis using the latest uploaded log and tune."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={
                  engineV2?.quickVerdict?.status
                    ? humanizeStatus(engineV2.quickVerdict.status)
                    : "Summary"
                }
                tone={
                  engineV2?.quickVerdict?.status === "critical"
                    ? "bad"
                    : engineV2?.quickVerdict?.status === "caution"
                    ? "warn"
                    : "good"
                }
              />
              <StatusBadge
                label={
                  tuneProfile?.parsing_status
                    ? `Tune: ${tuneProfile.parsing_status}`
                    : latestTune
                    ? "Tune: no profile"
                    : "No tune"
                }
                tone={
                  !latestTune
                    ? "info"
                    : tuneProfile?.parsing_status === "profiled"
                    ? "good"
                    : "warn"
                }
              />
              <StatusBadge
                label={
                  engineV2?.quickVerdict?.pullQuality
                    ? `Pull: ${engineV2.quickVerdict.pullQuality}`
                    : "Pull: unknown"
                }
                tone={
                  engineV2?.quickVerdict?.pullQuality === "strong"
                    ? "good"
                    : engineV2?.quickVerdict?.pullQuality === "usable"
                    ? "info"
                    : "warn"
                }
              />
            </div>
          </div>
        </div>

        <TelemetryGraphV1 telemetry={engineV2?.telemetry ?? null} />

        <div className="grid gap-4 md:grid-cols-4">
          <InfoCard
            title="Latest Log"
            value={latestLog?.log_name || "No log uploaded"}
          />
          <InfoCard
            title="Latest Tune"
            value={latestTune?.tune_name || "No tune uploaded"}
          />
          <InfoCard
            title="Tune Profile"
            value={
              tuneProfile?.parsing_status
                ? tuneProfile.parsing_status
                : latestTune
                ? "No tune profile yet"
                : "No tune uploaded"
            }
          />
          <InfoCard
            title="Summary Status"
            value={
              latestSummary
                ? engineV2
                  ? "Engine v2 available"
                  : "Summary available"
                : "No summary yet"
            }
          />
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Tune Profile V1</h2>
            <StatusBadge
              label={
                tuneProfile?.parsing_status
                  ? tuneProfile.parsing_status
                  : latestTune
                  ? "missing"
                  : "none"
              }
              tone={
                !latestTune
                  ? "info"
                  : tuneProfile?.parsing_status === "profiled"
                  ? "good"
                  : "warn"
              }
            />
          </div>

          {!latestTune && <p className="text-zinc-400">No tune uploaded yet.</p>}

          {latestTune && !tuneProfile && (
            <p className="text-zinc-400">
              Tune uploaded, but no tune profile record was found yet.
            </p>
          )}

          {latestTune && tuneProfile && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard
                  title="Detected Platform"
                  value={tuneProfile.detected_platform || "Unknown"}
                />
                <InfoCard
                  title="Parsing Status"
                  value={tuneProfile.parsing_status || "Unknown"}
                />
                <InfoCard
                  title="Confidence"
                  value={
                    typeof tuneProfile.confidence === "number"
                      ? `${Math.round(tuneProfile.confidence * 100)}%`
                      : "No data"
                  }
                />

                <InfoCard
                  title="Boost Intent"
                  value={tuneProfile.boost_intent || "Unknown"}
                />
                <InfoCard
                  title="Ignition Intent"
                  value={tuneProfile.ignition_intent || "Unknown"}
                />
                <InfoCard
                  title="Fueling Intent"
                 value={
                   effectiveTuneProfile?.fueling_intent ??
                   "Unknown"
                 }
                />
              </div>

              {tuneProfile.categories && tuneProfile.categories.length > 0 && (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-sm font-medium text-zinc-200">Categories</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tuneProfile.categories.map((category, index) => (
                      <MiniPill key={index} label={humanizeToken(category)} />
                    ))}
                  </div>
                </div>
              )}

              {tuneProfile.notes && tuneProfile.notes.length > 0 && (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-sm font-medium text-zinc-200">Notes</p>
                  <div className="mt-2 space-y-1">
                    {tuneProfile.notes.map((note, index) => (
                      <p key={index} className="text-sm leading-relaxed text-zinc-300">
                        • {note}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
{latestSummary?.analysis?.fuelValidation && (
  <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Fuel Tune Validation</h2>
      <StatusBadge
        label={latestSummary.analysis.fuelValidation.status.toUpperCase()}
        tone={
          latestSummary.analysis.fuelValidation.status === "fail"
            ? "bad"
            : latestSummary.analysis.fuelValidation.status === "warning"
            ? "warn"
            : "good"
        }
      />
    </div>

    <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
      <p className="text-sm text-zinc-400">Detected Fuel</p>
      <p className="mt-1 text-lg font-semibold">
        {humanizeToken(latestSummary.analysis.fuelValidation.detectedFuel)}
      </p>

      <p className="mt-4 text-sm text-zinc-400">Validation Message</p>
      <p className="mt-1 text-zinc-200">
        {latestSummary.analysis.fuelValidation.message}
      </p>
    </div>
  </div>
)}
        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Tune-Aware Reasoning</h2>
            <StatusBadge
              label={`${tuneReasoningFlags.length} signals`}
              tone={
                tuneReasoningFlags.some((flag) => flag.tone === "bad")
                  ? "bad"
                  : tuneReasoningFlags.some((flag) => flag.tone === "warn")
                  ? "warn"
                  : "info"
              }
            />
          </div>

          {!latestTune && (
            <p className="text-zinc-400">
              No tune uploaded yet, so tune-aware reasoning is unavailable.
            </p>
          )}

          {latestTune && tuneReasoningFlags.length === 0 && (
            <p className="text-zinc-400">
              No major tune-aware signals were surfaced from the current data.
            </p>
          )}

          {latestTune && tuneReasoningFlags.length > 0 && (
            <div className="space-y-3">
              {tuneReasoningFlags.map((flag, index) => (
                <FlagCard
                 key={`${flag.title}-${index}`}
                 title={flag.title}
                 tone={flag.tone}
                 message={
                 typeof flag.message === "string"
                 ? flag.message
                 : Array.isArray(flag.message)
                 ? (flag.message as string []).join(" • ")
                 : JSON.stringify(flag.message)
                    }
                 />
               ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <AnalysisCard
            title="Average Boost"
            value={formatValue(latestSummary?.avg_boost, 2)}
          />
          <AnalysisCard
            title="Max Boost"
            value={formatValue(latestSummary?.max_boost, 1)}
          />
          <AnalysisCard
            title="Average Boost Target"
            value={formatValue(latestSummary?.avg_boost_target, 1)}
          />
          <AnalysisCard
            title="Max Boost Target"
            value={formatValue(latestSummary?.max_boost_target, 1)}
          />

          <AnalysisCard
            title="Boost Error"
            value={
              boostError !== null ? `${formatValue(boostError, 1)} psi` : "No data"
            }
          />
          <AnalysisCard
            title="Max IAT"
            value={formatValue(latestSummary?.max_iat, 0)}
          />
          <AnalysisCard
            title="Min AFR"
            value={formatValue(latestSummary?.min_afr, 2)}
          />
          <AnalysisCard
            title="Max WGDC"
            value={formatValue(latestSummary?.max_wgdc, 1)}
          />

          <AnalysisCard
            title="Min Rail Pressure"
            value={formatValue(latestSummary?.min_rail_pressure, 0)}
          />
          <AnalysisCard
            title="Min LPFP"
            value={formatValue(latestSummary?.min_lpfp, 1)}
          />
          <AnalysisCard
            title="Ethanol Content"
            value={formatValue(latestSummary?.ethanol_content, 0)}
          />
          <AnalysisCard
            title="Throttle Closure Detected"
            value={throttleClosureText}
          />
        </div>

        {engineV2 && (
          <div className="grid gap-4 md:grid-cols-3">
            <AnalysisCard title="Pull Windows" value={String(enginePullCount)} />
            <AnalysisCard title="Detected Events" value={String(engineEventCount)} />
            <AnalysisCard
              title="Pull Quality"
              value={engineV2.quickVerdict?.pullQuality || "Unknown"}
            />
          </div>
        )}

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Per-Cylinder Timing Corrections
          </h2>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <AnalysisCard
              title="Cylinder 1"
              value={formatValue(latestSummary?.cyl1_max_timing_correction, 1)}
            />
            <AnalysisCard
              title="Cylinder 2"
              value={formatValue(latestSummary?.cyl2_max_timing_correction, 1)}
            />
            <AnalysisCard
              title="Cylinder 3"
              value={formatValue(latestSummary?.cyl3_max_timing_correction, 1)}
            />
            <AnalysisCard
              title="Cylinder 4"
              value={formatValue(latestSummary?.cyl4_max_timing_correction, 1)}
            />
            <AnalysisCard
              title="Cylinder 5"
              value={formatValue(latestSummary?.cyl5_max_timing_correction, 1)}
            />
            <AnalysisCard
              title="Cylinder 6"
              value={formatValue(latestSummary?.cyl6_max_timing_correction, 1)}
            />
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Quick Verdict</h2>
            {engineV2?.quickVerdict?.status && (
              <StatusBadge
                label={humanizeStatus(engineV2.quickVerdict.status)}
                tone={
                  engineV2.quickVerdict.status === "critical"
                    ? "bad"
                    : engineV2.quickVerdict.status === "caution"
                    ? "warn"
                    : "good"
                }
              />
            )}
          </div>

          {!latestLog && (
            <p className="text-zinc-400">
              No log uploaded yet. Upload a log to begin analysis.
            </p>
          )}

          {latestLog && !latestSummary && (
            <p className="text-zinc-400">
              Log found, but no summary data is available yet.
            </p>
          )}

          {latestLog && latestSummary && (
            <div className="space-y-3">
              {renderedVerdictFlags.map((flag, index) => (
                <FlagCard
                  key={`${flag.title}-${index}`}
                  title={flag.title}
                  message={flag.message}
                  tone={flag.tone}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Intelligent Warnings</h2>
            <StatusBadge
              label={`${renderedRoutedEvents.length} events`}
              tone={
                renderedRoutedEvents.some(
                  (event) =>
                    ("surfaceAs" in event ? event.surfaceAs : undefined) === "critical"
                )
                  ? "bad"
                  : renderedRoutedEvents.some(
                      (event) =>
                        ("surfaceAs" in event ? event.surfaceAs : undefined) === "warning"
                    )
                  ? "warn"
                  : "good"
              }
            />
          </div>

          {!latestLog && (
            <p className="text-zinc-400">
              No log uploaded yet. Upload a log to begin analysis.
            </p>
          )}

          {latestLog && !latestSummary && (
            <p className="text-zinc-400">
              Log found, but no summary data is available yet.
            </p>
          )}

         {latestLog && latestSummary && (
  <>
    <div className="space-y-3">
      {renderedRoutedEvents.length > 0 ? (
  Object.entries(groupedDiagnosticEvents).map(([groupName, events]) =>
    events.length > 0 ? (
      <div key={groupName} className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-800" />

          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {groupName}
          </h3>

          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {events.map((event, index) => (
          <WorkshopDiagnosticCard
            key={`workshop-${groupName}-${index}`}
            title={event.category || "Diagnostic Event"}
            severity={"tone" in event ? String(event.tone) : undefined}
            source={event.source}
            rpm={
              typeof event.event?.rpmStart === "number"
                ? event.event.rpmStart
                : null
            }
            action={"message" in event ? String(event.message) : undefined}
            evidence={
              Array.isArray(event.reasoning)
                ? event.reasoning
                : event.reasoning
                  ? [String(event.reasoning)]
                  : []
            }
            supportingChannels={event.event?.type ? [event.event.type] : []}
            relatedXdfTables={xdfCrossReferences}
            metrics={[
              ...("source" in event && event.source === "historical-comparison"
                ? [
                    {
                     label: "Trend Type",
                     value: "Repeated Pattern",
                    },
                  ]
                : []),

                ...(
                  event.category === "Cylinder Correction Trend" &&
                  typeof event.message === "string"
                    ? [
                        {
                          label: "Cylinder Pattern",
                          value: "Repeated Correction",
                        },
                      ]
                  : []
                ),

                ...(
                  event.event?.type === "historical_cylinder_correction"
                    ? [
                        {
                          label: "Diagnostic Focus",
                          value: "Ignition / Fueling",
                        },
                      ]
                  : []
                ),

                ...(
                  event.category === "Thermal Trend"
                    ? [
                       {
                        label: "Direction",
                        value: "Worsening ↗",
                       },
                      ]
                  : []
               ),

               ...(
                 event.category === "Fuel Pressure Trend"
                   ? [
                       {
                        label: "Direction",
                        value: "Pressure Declining ↘",
                       },
                     ]
                  : []
                ),
                ...("event" in event && event.event?.confidence
                  ? [
                     {
                      label: "Confidence",
                      value: `${Math.round(event.event.confidence * 100)}%`,
                     },
                    ]
                : []),

              ...(typeof event.event?.rpmStart === "number"
                ? [{ label: "RPM Start", value: event.event.rpmStart }]
                : []),
              ...(typeof event.event?.rpmEnd === "number"
                ? [{ label: "RPM End", value: event.event.rpmEnd }]
                : []),
              ...(typeof event.priority === "number"
                ? [{ label: "Priority", value: event.priority }]
                : []),
              ...(event.source
                ? [{ label: "Source", value: event.source }]
                : []),
              ...(event.category
                ? [{ label: "Category", value: event.category }]
                : []),
              ...(event.event?.type
                ? [{ label: "Event Type", value: event.event.type }]
                : []),
            ]}
          />
        ))}
      </div>
    ) : null
  )
) : (
       
        <WorkshopDiagnosticCard
          title="No major warnings"
          severity="good"
          action="No major warning conditions were triggered by the current analysis."
        />
      )}
    </div>

    {worstCylinder && (
  <WorkshopDiagnosticCard
    title={`Cylinder Intelligence: ${worstCylinder}`}
    severity={worstCylinderSeverity}
    action={
      worstCylinderCorrection !== null
        ? `Worst timing correction detected: ${worstCylinderCorrection.toFixed(1)}°`
        : "Cylinder timing corrections available"
    }
    evidence={[
      `Worst cylinder: ${worstCylinder}`,
      `Correction: ${
        worstCylinderCorrection !== null
          ? `${worstCylinderCorrection.toFixed(1)}°`
          : "N/A"
      }`,
    ]}
  />
)}

{diagnosticTimeline.length > 0 && (
  <WorkshopDiagnosticCard
    title={`Diagnostic Timeline (${diagnosticTimeline.length} Events)`}
    severity={
  diagnosticTimeline.some((item) => item.severity === "high" || item.severity === "critical")
    ? "bad"
    : diagnosticTimeline.some((item) => item.severity === "medium")
      ? "warn"
      : "good"
}
    action={diagnosticTimeline.map((item) => item.event).join(" • ")}
    evidence={diagnosticTimeline.map(
      (item) => `${item.severity.toUpperCase()}: ${item.event}`
    )}
  />
)}

    <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Detected Events</h2>
        <StatusBadge
          label={`${engineEvents.length} events`}
          tone={
            engineEvents.some(
              (event) =>
                event.severity === "critical" || event.severity === "high"
            )
              ? "bad"
              : engineEvents.some((event) => event.severity === "medium")
                ? "warn"
                : "info"
          }
        />
      </div>

      {engineEvents.length > 0 ? (
        <div className="space-y-4">
          {engineEvents.map((event, index) => (
            <EventCard key={event.id || `event-${index}`} event={event} />
          ))}
        </div>
      ) : (
        <p className="text-zinc-400">
          No detected events were returned by the engine for this log.
        </p>
      )}
    </div>
  </>
)}

        {engineV2 && (
          <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Cross-Reference Details</h2>
              <StatusBadge
                label={`${engineCrossReferences.length} maps`}
                tone={engineCrossReferences.length > 0 ? "info" : "warn"}
              />
            </div>

            {engineCrossReferences.length > 0 ? (
              <div className="space-y-4">
                {engineCrossReferences.map((crossRef, index) => {
                  const linkedEvent =
                    engineEvents.find((event) => event.id === crossRef.eventId) ||
                    null;

                  return (
                    <CrossReferenceCard
                      key={crossRef.eventId || `crossref-${index}`}
                      crossRef={crossRef}
                      linkedEvent={linkedEvent}
                      relatedXdfTables={getRelatedXdfTablesForEvent(linkedEvent, xdfCrossReferences)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-zinc-400">
                No cross-reference details were returned by the engine for this log.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function getEngineV2(summaryRow: any): EngineV2 | null {
  const raw = summaryRow?.summary?.engine_v2;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  return raw as EngineV2;
}

function buildTuneReasoningFlags(
  tuneProfile: TuneProfileRow | null,
  summary: any,
  vehicle: any,
  crossReferences: EngineCrossReference[],
  engineEvents: any[] = []
): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];

  if (!tuneProfile) return flags;

  const detectedPlatform = tuneProfile?.detected_platform ?? "Unknown platform";
 if (false) {
  flags.push({
    title: "Tune platform detected",
    message: `Tune profile is active and the latest tune was identified as ${detectedPlatform}.`,
    tone: "info",
  });
}

   const boostValidation = validateBoostAgainstTune({
  platform:
    vehicle?.engine_code ||
    vehicle?.platform ||
    "unknown",

  fuelType:
    vehicle?.fuel_type ||
    "Unknown",

  maxBoost:
    summary?.max_boost ??
    summary?.maxBoost,

  maxBoostTarget:
    summary?.max_boost_target ??
    summary?.maxBoostTarget,

  maxWgdc:
    summary?.max_wgdc ??
    summary?.maxWgdc,

  boostIntent: null,
})

  flags.push({
    title: "Boost Tune Validation",
    message: boostValidation.message,
    tone:
      boostValidation.status === "fail"
        ? "bad"
        : boostValidation.status === "warning"
        ? "warn"
        : "good",
  });

  const hpfpCapacityEvent = engineEvents.find((x: any) => {
  const eventType = x.eventType ?? x.event_type ?? x.type;

  return eventType === "hpfp_capacity_limit";
});

if (hpfpCapacityEvent) {
  flags.push({
    title: "HPFP Capacity Warning",
    message:
      "Fuel rail pressure indicates the high-pressure fuel pump is reaching its support limit under load. Tune demand, ethanol blend, or airflow may exceed current HPFP capacity.",
    tone: "bad",
  });
}

const lpfpSupplyEvent = engineEvents.find((x: any) => {
  const eventType = x.eventType ?? x.event_type ?? x.type;

  return eventType === "lpfp_supply_limit" || eventType === "lpfp_drop";
});

if (lpfpSupplyEvent) {
  flags.push({
    title: "LPFP Supply Warning",
    message:
      "Low-pressure fuel supply is dropping under load. The in-tank pump, fuel lines, filter/regulator, wiring, or ethanol demand may be limiting fuel delivery before the HPFP.",
    tone: "bad",
  });
}
const timingCorrectionEvent = engineEvents.find((x: any) => {
  const eventType = x.eventType ?? x.event_type ?? x.type;

  return (
    eventType === "timing_correction" ||
    eventType === "multi_cyl_timing_correction"
  );
});

  if (tuneProfile.fueling_intent === "pump") {
    flags.push({
      title: "Ethanol-based fueling strategy detected",
      message:
        "This calibration appears designed for ethanol content. Because ethanol requires significantly more fuel volume, HPFP/LPFP performance and injector headroom should be judged more critically under load.",
      tone: "info",
    });
  }

  if (
    tuneProfile.fueling_intent &&
    (tuneProfile.fueling_intent === "ethanol_blend" ||
      tuneProfile.fueling_intent === "full_ethanol")
  ) {
    flags.push({
      title: "Ethanol fueling strategy detected",
      message:
        "The tune profile suggests ethanol-based fueling. Fuel pressure, injector headroom, and lambda control should be evaluated more critically under load because ethanol demand is substantially higher than pump fuel.",
      tone: "info",
    });
  }

  if (tuneProfile.boost_intent === "aggressive") {
    flags.push({
      title: "Aggressive boost intent detected",
      message:
        "The uploaded tune profile suggests a more aggressive boost strategy. If the log shows boost taper or WGDC saturation, the tune may be asking more than the setup can comfortably deliver.",
      tone: "warn",
    });
  }

  if (tuneProfile.boost_intent === "low") {
    flags.push({
      title: "Low boost calibration detected",
      message:
        "The tune appears to target a modest boost level. If the vehicle still shows elevated fuel stress, timing correction, or thermal load at this boost target, that suggests an efficiency or hardware issue rather than simple overboost.",
      tone: "info",
    });
  }

  if (tuneProfile.ignition_intent === "conservative") {
    flags.push({
      title: "Conservative ignition strategy detected",
      message:
        "This calibration appears to use a safer ignition strategy. If meaningful timing correction is still present, the issue is more likely related to fuel quality, intake temperature, ignition hardware, or transient load rather than excessive ignition advance.",
      tone: "info",
    });
  }

  const ethanolContent = toNumber(summary?.ethanol_content);
  if (
    tuneProfile.fueling_intent === "pump" &&
    ethanolContent !== null &&
    ethanolContent >= 20
  ) {
    flags.push({
      title: "Fuel mismatch detected",
      message:
        "The tune profile looks pump-based, but the log shows meaningful ethanol content. That can distort how the tune behaves versus what the profile suggests.",
      tone: "bad",
    });
  }

  const minRailPressure = toNumber(summary?.min_rail_pressure);
  if (
    tuneProfile.fueling_intent === "pump" &&
    minRailPressure !== null &&
    minRailPressure < 1500
  ) {
    flags.push({
      title: "Unexpected rail pressure weakness",
      message:
        "Rail pressure is weaker than expected for a pump-oriented tune profile. That points more toward fuel system stress or real fuel mismatch.",
      tone: "warn",
    });
  }

  const minLpfp = toNumber(summary?.min_lpfp);
  if (
    tuneProfile.fueling_intent === "pump" &&
    minLpfp !== null &&
    minLpfp < 50
  ) {
    flags.push({
      title: "Unexpected LPFP weakness",
      message:
        "The tune profile looks pump-oriented, but low-pressure fuel is dropping harder than expected.",
      tone: "warn",
    });
  }

  const cyl2 = toNumber(summary?.cyl2_max_timing_correction);
  const cyl3 = toNumber(summary?.cyl3_max_timing_correction);
  const worstTiming = Math.min(
    ...( [cyl2, cyl3].filter((v): v is number => v !== null) )
  );

  if (
  tuneProfile.ignition_intent === "conservative" &&
  Number.isFinite(worstTiming)
  )
   
   if (worstTiming <= -6) {
  flags.push({
    title: "Severe knock despite conservative timing profile",
    message:
      "The tune profile suggests conservative ignition timing, yet the log shows severe timing correction. This points strongly toward fuel quality limitations, ignition system weakness, excessive intake temperature, or unstable combustion under load.",
    tone: "bad",
  });
} else if (worstTiming <= -3) {
  flags.push({
    title: "Knock despite conservative timing profile",
    message:
      "The tune profile suggests conservative ignition timing, but the log still shows meaningful timing correction. That points more toward fuel quality, heat, plug/coil health, or load conditions rather than an overly aggressive timing map.",
    tone: "bad",
  });
} else if (worstTiming <= -1.5) {
  flags.push({
    title: "Minor correction under conservative ignition strategy",
    message:
      "Small timing corrections were observed despite the tune using a conservative ignition strategy. Mild correction can occur during transient load or heat soak, but repeated activity may still justify reviewing fuel quality or ignition components.",
    tone: "warn",
  });
}

  const notesFromCrossRefs = crossReferences
    .flatMap((ref) => ref.notes || [])
    .filter(Boolean);

  const uniqueNotes = Array.from(new Set(notesFromCrossRefs))
    .filter((note) => note.toLowerCase() !== "no tune profile available.")
    .slice(0, 4);

  

  return sortFlags(flags);
}

function buildVerdictFlagsFromEngine(
  quickVerdict: EngineQuickVerdict
): AnalysisFlag[] {
  const tone: FlagTone =
    quickVerdict.status === "critical"
      ? "bad"
      : quickVerdict.status === "caution"
      ? "warn"
      : "good";

  const flags: AnalysisFlag[] = [
    {
      title:
        quickVerdict.status === "critical"
          ? "Critical verdict"
          : quickVerdict.status === "caution"
          ? "Caution verdict"
          : "Healthy verdict",
      message:
        quickVerdict.summary ||
        "Engine verdict is available, but no summary text was returned.",
      tone,
    },
  ];

  if (quickVerdict.pullQuality) {
    flags.push({
      title: "Pull quality",
      message: `Primary pull quality was rated as ${quickVerdict.pullQuality}.`,
      tone:
        quickVerdict.pullQuality === "strong"
          ? "good"
          : quickVerdict.pullQuality === "usable"
          ? "info"
          : "warn",
    });
  }

  if (typeof quickVerdict.confidence === "number") {
    flags.push({
      title: "Engine confidence",
      message: `Analysis confidence: ${(quickVerdict.confidence * 100).toFixed(0)}%.`,
      tone: "info",
    });
  }

  return sortFlags(flags);
}

function mapLegacyWarningToFlag(warning: EngineWarning): AnalysisFlag {
  const rpmText =
    Array.isArray(warning.rpmRange) && warning.rpmRange.length === 2
      ? ` RPM ${Math.round(warning.rpmRange[0])}–${Math.round(warning.rpmRange[1])}.`
      : "";

  const confidenceText =
    typeof warning.confidence === "number"
      ? ` Confidence ${(warning.confidence * 100).toFixed(0)}%.`
      : "";

  const evidenceText =
    warning.supportingEvidence && warning.supportingEvidence.length > 0
      ? ` ${warning.supportingEvidence[0]}`
      : "";

  return {
    title: warning.title || "Engine warning",
    message: `${warning.summary || "Issue detected."}${rpmText}${confidenceText}${evidenceText}`,
    tone: mapSeverityToTone(warning.severity),
  };
}

function mapEngineFixToCard(fix: EngineFix): SuggestedFix {
  const rationale = fix.rationale ? ` Why: ${fix.rationale}` : "";

  return {
    title: fix.title || "Suggested fix",
    action: `${fix.recommendation || "Review the related tune and hardware systems."}${rationale}`,
  };
}

function mapSeverityToTone(
  severity: "low" | "medium" | "high" | "critical" | undefined
): FlagTone {
  if (severity === "critical" || severity === "high") return "bad";
  if (severity === "medium") return "warn";
  if (severity === "low") return "info";
  return "info";
}

function severityWeight(tone: FlagTone): number {
  if (tone === "bad") return 4;
  if (tone === "warn") return 3;
  if (tone === "info") return 2;
  return 1;
}

function sortFlags(flags: AnalysisFlag[]): AnalysisFlag[] {
  return [...flags].sort((a, b) => severityWeight(b.tone) - severityWeight(a.tone));
}

function sortWarnings(a: EngineWarning, b: EngineWarning): number {
  const rank = (severity?: string) => {
    if (severity === "critical") return 4;
    if (severity === "high") return 3;
    if (severity === "medium") return 2;
    return 1;
  };

  const severityDiff = rank(b.severity) - rank(a.severity);
  if (severityDiff !== 0) return severityDiff;

  return (b.confidence || 0) - (a.confidence || 0);
}

function sortEvents(a: EngineEvent, b: EngineEvent): number {
  const rank = (severity?: string) => {
    if (severity === "critical") return 4;
    if (severity === "high") return 3;
    if (severity === "medium") return 2;
    return 1;
  };

  const severityDiff = rank(b.severity) - rank(a.severity);
  if (severityDiff !== 0) return severityDiff;

  return (b.confidence || 0) - (a.confidence || 0);
}

function humanizeEventType(value: string | undefined) {
  if (!value) return "Detected Event";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeToken(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function calculateBoostError(
  maxBoost: number | null | undefined,
  maxBoostTarget: number | null | undefined
) {
  const boost = toNumber(maxBoost);
  const target = toNumber(maxBoostTarget);

  if (boost === null || target === null) {
    return null;
  }

  return target - boost;
}

function buildWarnings(
  summary: any,
  boostError: number | null,
  vehicle: any
): AnalysisFlag[] {
  if (!summary) return [];

  const warnings: AnalysisFlag[] = [];

  const minAfr = toNumber(summary.min_afr);
  const minRailPressure = toNumber(summary.min_rail_pressure);
  const minLpfp = toNumber(summary.min_lpfp);
  const maxTimingCorrection = toNumber(summary.max_timing_correction);
  const maxIat = toNumber(summary.max_iat);
  const maxWgdc = toNumber(summary.max_wgdc);
  const throttleDetected = summary.throttle_closure_detected;
  const ethanolContent = toNumber(summary.ethanol_content);

  const fuelType = String(vehicle?.fuel_type || "").toLowerCase();

  if (maxTimingCorrection !== null && maxTimingCorrection <= -3) {
    warnings.push({
      title: "Knock-related timing correction",
      message:
        "One or more cylinders showed meaningful timing correction. Review fuel quality, IAT, and ignition advance.",
      tone: "bad",
    });
  }

  if (minAfr !== null && minAfr > 13) {
    warnings.push({
      title: "Lean AFR warning",
      message:
        "AFR did not drop as expected under load. This can point to fueling or tune calibration issues.",
      tone: "bad",
    });
  }

  if (minRailPressure !== null && minRailPressure < 1500) {
    warnings.push({
      title: "Fuel rail pressure drop",
      message:
        "Rail pressure dropped to a level that suggests the high-pressure side may be struggling.",
      tone: "bad",
    });
  }

  if (minLpfp !== null && minLpfp < 45) {
    warnings.push({
      title: "Low-pressure fuel drop",
      message:
        "Low-pressure fuel reading dropped hard. This can indicate LPFP limitation or supply weakness.",
      tone: "bad",
    });
  }

  if (
    fuelType.includes("e") &&
    ethanolContent !== null &&
    ethanolContent >= 30 &&
    minLpfp !== null &&
    minLpfp < 55
  ) {
    warnings.push({
      title: "LPFP low for ethanol blend",
      message:
        "The car is on ethanol content high enough to demand more fuel supply, but LPFP is dipping lower than ideal.",
      tone: "warn",
    });
  }

  if (throttleDetected === true) {
    warnings.push({
      title: "Throttle closure event",
      message:
        "The log suggests throttle is closing during the pull. That can indicate torque intervention or a control limit being hit.",
      tone: "warn",
    });
  }

  if (boostError !== null && boostError > 2 && maxWgdc !== null && maxWgdc > 75) {
    warnings.push({
      title: "High WGDC with boost shortfall",
      message:
        "The system is commanding strong wastegate duty but still missing boost target. Check for boost leak or turbo efficiency issues.",
      tone: "bad",
    });
  }

  if (maxIat !== null && maxIat > 50) {
    warnings.push({
      title: "High intake air temperature",
      message:
        "IAT is elevated enough to hurt consistency and increase knock sensitivity.",
      tone: "warn",
    });
  }

  return sortFlags(warnings);
}

function buildSuggestedFixes(
  summary: any,
  boostError: number | null,
  vehicle: any
): SuggestedFix[] {
  if (!summary) return [];

  const fixes: SuggestedFix[] = [];

  const minAfr = toNumber(summary.min_afr);
  const minRailPressure = toNumber(summary.min_rail_pressure);
  const minLpfp = toNumber(summary.min_lpfp);
  const maxTimingCorrection = toNumber(summary.max_timing_correction);
  const maxWgdc = toNumber(summary.max_wgdc);
  const throttleDetected = summary.throttle_closure_detected;
  const fuelType = String(vehicle?.fuel_type || "").toLowerCase();

  if (minRailPressure !== null && minRailPressure < 1500) {
    fixes.push({
      title: "HPFP Limitation",
      action:
        "Consider reducing load or boost, or upgrading the HPFP if the setup demands more fuel on the high-pressure side.",
    });
  }

  if (minLpfp !== null && minLpfp < 45) {
    fixes.push({
      title: "LPFP Limitation",
      action:
        "Review LPFP capacity, pump wiring, voltage supply, and any controller setup. Upgrade LPFP if the setup needs it.",
    });
  }

  if (fuelType.includes("e") && minLpfp !== null && minLpfp < 55) {
    fixes.push({
      title: "Ethanol Fuel Supply Check",
      action:
        "Because the car is on ethanol, verify low-pressure fuel supply is strong enough for the current blend and load.",
    });
  }

  if (maxTimingCorrection !== null && maxTimingCorrection <= -3) {
    fixes.push({
      title: "Timing Correction Fix",
      action:
        "Reduce ignition timing in the tune, improve fuel quality, or lower IAT with better cooling and airflow.",
    });
  }

  if (minAfr !== null && minAfr > 13) {
    fixes.push({
      title: "Lean AFR Fix",
      action:
        "Increase fueling, review injector data, and verify fuel pressure is staying healthy under load.",
    });
  }

  if (boostError !== null && boostError > 2 && maxWgdc !== null && maxWgdc > 75) {
    fixes.push({
      title: "Boost Leak / Turbo Efficiency Check",
      action:
        "Pressure test the system, inspect charge pipes and intercooler joins, and review turbo condition and wastegate control.",
    });
  }

  if (throttleDetected === true) {
    fixes.push({
      title: "Throttle Closure Fix",
      action:
        "Review torque limits, load targets, and boost control logic in the tune. Throttle closure often points to intervention logic.",
    });
  }

  return fixes;
}

function buildAnalysisFlags(
  summary: any,
  boostError: number | null,
  vehicle: any
): AnalysisFlag[] {
  if (!summary) return [];

  const flags: AnalysisFlag[] = [];

  const maxBoost = toNumber(summary.max_boost);
  const maxBoostTarget = toNumber(summary.max_boost_target);
  const maxIat = toNumber(summary.max_iat);
  const minAfr = toNumber(summary.min_afr);
  const maxTimingCorrection = toNumber(summary.max_timing_correction);
  const minRailPressure = toNumber(summary.min_rail_pressure);
  const minLpfp = toNumber(summary.min_lpfp);
  const maxWgdc = toNumber(summary.max_wgdc);
  const ethanolContent = toNumber(summary.ethanol_content);
  const throttleDetected = summary.throttle_closure_detected;

  const fuelType = String(vehicle?.fuel_type || "").toLowerCase();
  const fuelingSetup = String(vehicle?.fueling_setup || "").toLowerCase();
  const turboSetup = String(vehicle?.turbo_setup || "").toLowerCase();
  const horsepowerGoal = toNumber(vehicle?.horsepower_goal);

  if (boostError !== null && maxBoostTarget !== null) {
    if (boostError > 3) {
      flags.push({
        title: "Boost significantly below target",
        message: `Boost is ${formatValue(
          boostError,
          1
        )} psi under target. Possible causes: boost leak, WGDC ceiling, turbo inefficiency, or throttle intervention.`,
        tone: "bad",
      });
    } else if (boostError > 1.5) {
      flags.push({
        title: "Boost under target",
        message: `Boost is slightly under target. Check WGDC, throttle closure, and turbo response.`,
        tone: "warn",
      });
    } else {
      flags.push({
        title: "Boost tracking well",
        message: "Boost is closely matching target.",
        tone: "good",
      });
    }
  }

  if (throttleDetected === true) {
    flags.push({
      title: "Throttle closure detected",
      message:
        "The DME is likely intervening. Possible causes include torque limits, boost control issues, or safety logic.",
      tone: "warn",
    });
  }

  if (maxTimingCorrection !== null) {
    if (maxTimingCorrection <= -3) {
      flags.push({
        title: "Timing correction detected",
        message:
          "Knock correction is present. Possible causes: fuel quality, timing too aggressive, high IAT, or cylinder imbalance.",
        tone: "warn",
      });
    } else if (maxTimingCorrection < 0) {
      flags.push({
        title: "Minor timing correction",
        message: `Some correction is present, with a worst value of ${formatValue(
          maxTimingCorrection,
          1
        )}.`,
        tone: "info",
      });
    } else {
      flags.push({
        title: "Timing correction looks clean",
        message: "No negative timing correction was detected in the tracked channels.",
        tone: "good",
      });
    }
  }

  if (minRailPressure !== null) {
    if (fuelType.includes("e") && minRailPressure < 1700) {
      flags.push({
        title: "Rail pressure low for ethanol",
        message:
          "On ethanol, rail pressure should stay stronger. This suggests the HPFP may be near its limit.",
        tone: "bad",
      });
    } else if (minRailPressure < 1500) {
      flags.push({
        title: "Rail pressure low",
        message:
          "Fuel system may be struggling. Possible HPFP limitation or fuel demand exceeding supply.",
        tone: "bad",
      });
    } else if (minRailPressure < 2000) {
      flags.push({
        title: "Rail pressure soft",
        message:
          "Rail pressure is holding, but softer than ideal. Keep an eye on HPFP performance.",
        tone: "warn",
      });
    } else {
      flags.push({
        title: "Rail pressure stable",
        message: `Rail pressure held to a minimum of ${formatValue(
          minRailPressure,
          0
        )} psi.`,
        tone: "good",
      });
    }
  }

  if (minLpfp !== null) {
    if (fuelType.includes("e") && minLpfp < 55) {
      flags.push({
        title: "LPFP low for ethanol",
        message:
          "Low pressure fuel is dropping too much for ethanol content. LPFP may be insufficient.",
        tone: "bad",
      });
    } else if (minLpfp < 45) {
      flags.push({
        title: "LPFP low",
        message: "Low pressure fuel is weaker than ideal under load.",
        tone: "bad",
      });
    } else if (minLpfp < 55) {
      flags.push({
        title: "LPFP worth watching",
        message:
          "Low pressure fuel is acceptable but worth monitoring, especially on higher ethanol blends.",
        tone: "warn",
      });
    } else {
      flags.push({
        title: "LPFP looks healthy",
        message: `Minimum LPFP was ${formatValue(minLpfp, 1)} psi.`,
        tone: "good",
      });
    }
  }

  if (maxWgdc !== null && boostError !== null && boostError > 2) {
    if (maxWgdc > 75) {
      flags.push({
        title: "High WGDC but low boost",
        message:
          "Turbo system is working hard but not achieving target. Possible boost leak, restriction, or turbo inefficiency.",
        tone: "bad",
      });
    }
  }

  if (turboSetup.includes("19t") && maxBoost !== null && maxBoost < 18) {
    flags.push({
      title: "Boost low for turbo setup",
      message:
        "Given upgraded turbos, boost appears lower than expected. Check tune targets or boost control.",
        tone: "warn",
      });
  }

  if (maxIat !== null) {
    if (maxIat > 50) {
      flags.push({
        title: "High intake temps",
        message:
          "High IAT reduces power and increases knock risk. Consider intercooler efficiency or heat soak.",
        tone: "warn",
      });
    } else if (maxIat > 40) {
      flags.push({
        title: "IAT elevated",
        message:
          "Charge air temperature is acceptable but getting warm. Keep an eye on repeated pulls.",
        tone: "info",
      });
    } else {
      flags.push({
        title: "IAT looks reasonable",
        message: `Peak IAT was ${formatValue(maxIat, 0)}°C.`,
        tone: "good",
      });
    }
  }

  if (minAfr !== null) {
    if (minAfr > 13) {
      flags.push({
        title: "AFR potentially lean",
        message:
          "AFR did not drop as expected under load. Review fueling and tune calibration carefully.",
        tone: "bad",
      });
    } else if (minAfr < 10.5) {
      flags.push({
        title: "AFR very rich",
        message:
          "AFR is richer than expected. This may be conservative or may need cleanup in the tune.",
        tone: "info",
      });
    } else {
      flags.push({
        title: "AFR in expected range",
        message: `Minimum AFR reached ${formatValue(minAfr, 2)}.`,
        tone: "good",
      });
    }
  }

  if (ethanolContent !== null) {
    if (fuelType.includes("98") && ethanolContent > 10) {
      flags.push({
        title: "Fuel type mismatch",
        message:
          "Vehicle setup says pump fuel, but the log is showing meaningful ethanol content.",
        tone: "warn",
      });
    } else {
      flags.push({
        title: "Fuel content detected",
        message: `Logged ethanol content averaged ${formatValue(
          ethanolContent,
          0
        )}%.`,
        tone: "info",
      });
    }
  }

  if (fuelingSetup.includes("stock") && fuelType.includes("e")) {
    flags.push({
      title: "Fueling setup vs ethanol",
      message:
        "Vehicle setup suggests stock fueling while running ethanol. Cross-check whether the setup data is complete.",
      tone: "warn",
    });
  }

  if (horsepowerGoal !== null && horsepowerGoal >= 650 && minRailPressure !== null) {
    if (minRailPressure < 1800) {
      flags.push({
        title: "Fuel pressure soft for power goal",
        message:
          "For a high horsepower target, the observed rail pressure looks softer than ideal.",
        tone: "warn",
      });
    }
  }

  if (flags.length === 0) {
    flags.push({
      title: "No major issues detected",
      message:
        "Initial cross-reference checks did not detect major issues based on the current data.",
      tone: "good",
    });
  }

  return sortFlags(flags);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function formatValue(
  value: number | string | null | undefined,
  decimals = 1
): string {
  const num = toNumber(value);
  if (num === null) return "No data";
  return num.toFixed(decimals);
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}

function AnalysisCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bmw-border rounded-xl bg-zinc-950/80 p-4 opacity-70 shadow-lg shadow-black/20">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: FlagTone;
}) {
  const toneClasses =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-blue-500/30 bg-blue-500/10 text-blue-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses}`}
    >
      {label}
    </span>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
      {label}
    </span>
  );
}

function FlagCard({
  title,
  message,
  tone,
}: {
  title: string;
  message: string;
  tone: FlagTone;
}) {
  const toneClasses =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-blue-500/30 bg-blue-500/10 text-blue-200";

  const badgeLabel =
    tone === "good"
      ? "healthy"
      : tone === "warn"
      ? "warning"
      : tone === "bad"
      ? "high priority"
      : "info";

  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <StatusBadge label={badgeLabel} tone={tone} />
      </div>
      <p className="text-sm leading-relaxed">{message}</p>
    </div>
  );
}

function FixCard({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  const actionItems = action
    .split(" • ")
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="font-semibold text-white">{title}</p>
        <StatusBadge label="action" tone="info" />
      </div>

      <div className="space-y-2 text-sm text-zinc-300">
        {actionItems.map((item, index) => {
          let label = "Action";
          let color = "text-zinc-300";

          if (
            item.toLowerCase().includes("verify") ||
            item.toLowerCase().includes("confirm")
          ) {
            label = "Verify First";
            color = "text-amber-300";
          }

          if (
            item.toLowerCase().includes("do not") ||
            item.toLowerCase().includes("avoid")
          ) {
            label = "Avoid";
            color = "text-red-300";
          }

          if (
            item.toLowerCase().includes("table") ||
            item.toLowerCase().includes("scalar") ||
            item.toLowerCase().includes("target")
          ) {
            label = "Tune Area";
            color = "text-cyan-300";
          }

          return (
            <div
              key={`${item}-${index}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <p className={`mb-1 text-xs font-semibold uppercase ${color}`}>
                {label}
              </p>

              <p className="leading-relaxed">{item}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EngineEvent }) {
  const severityTone = mapSeverityToTone(event.severity);
  const toneClasses =
    severityTone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : severityTone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : severityTone === "bad"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-blue-500/30 bg-blue-500/10 text-blue-200";

  const rpmText =
    typeof event.rpmStart === "number" && typeof event.rpmEnd === "number"
      ? `${Math.round(event.rpmStart)}–${Math.round(event.rpmEnd)} RPM`
      : "RPM unavailable";

  const confidenceText =
    typeof event.confidence === "number"
      ? `${(event.confidence * 100).toFixed(0)}%`
      : "N/A";

  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold">{humanizeEventType(event.type)}</p>
          <p className="mt-1 text-sm opacity-90">{rpmText}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={event.severity || "unknown"}
            tone={severityTone}
          />
          <StatusBadge
            label={`confidence ${confidenceText}`}
            tone="info"
          />
        </div>
      </div>

      {event.evidence && event.evidence.length > 0 && (
        <div className="mt-3 space-y-1">
          {event.evidence.map((line, index) => (
            <p key={index} className="text-sm leading-relaxed opacity-95">
              • {line}
            </p>
          ))}
        </div>
      )}

      {event.supportingChannels && event.supportingChannels.length > 0 && (
        <p className="mt-3 text-xs opacity-80">
          Channels: {event.supportingChannels.join(", ")}
        </p>
      )}
    </div>
  );
}

function CrossReferenceCard({
  crossRef,
  linkedEvent,
  relatedXdfTables = [],
}: {
  crossRef: EngineCrossReference & {
    rootCauses?: any[];
  };
  linkedEvent: EngineEvent | null;
  relatedXdfTables?: any[];
}) {
  const severityTone = mapSeverityToTone(linkedEvent?.severity);
console.log("CARD XDF COUNT:", relatedXdfTables.length, relatedXdfTables);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold text-white">
            {linkedEvent?.type
              ? humanizeEventType(linkedEvent.type)
              : "Cross-reference"}
          </p>

          {linkedEvent &&
            typeof linkedEvent.rpmStart === "number" &&
            typeof linkedEvent.rpmEnd === "number" && (
              <p className="mt-1 text-sm text-zinc-400">
                {Math.round(linkedEvent.rpmStart)}–{Math.round(linkedEvent.rpmEnd)} RPM
              </p>
            )}
        </div>

        {linkedEvent?.severity && (
          <StatusBadge label={linkedEvent.severity} tone={severityTone} />
        )}
      </div>
       
      {crossRef.rootCauses &&
       crossRef.rootCauses.length > 0 && (
  <div className="mt-4">
   <div className="mt-2 space-y-3">
      {(crossRef.rootCauses || []).map((rootCause: any, index: number) => (
        <div
          key={index}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                {rootCause.cause}
              </p>

              <p className="text-xs text-zinc-400 uppercase">
                {rootCause.rank}
              </p>
            </div>

            <StatusBadge
              label={`${rootCause.confidence}% confidence`}
              tone="info"
            />
          </div>

          {rootCause.confidenceBreakdown?.length > 0 && (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs font-medium text-zinc-300">
                Why TuneSight selected this cause
              </p>
              {rootCause.reasoningNarrative && (
                <p className="mt-2 text-xs text-zinc-400">
                  {rootCause.reasoningNarrative}
                </p>
              )}

              <div className="mt-2 space-y-1">
                {rootCause.confidenceBreakdown
                  .filter((factor: any) => factor.contribution !== 0)
                  .map((factor: any, factorIndex: number) => (
                  <div
                    key={factorIndex}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-zinc-400">{factor.factor}</span>
                    <span className="text-zinc-200">
                      {factor.contribution > 0 ? `+${factor.contribution}` : "0"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs">
                <span className="text-zinc-400">Final Confidence</span>
                <span className="font-medium text-zinc-100">
                  {rootCause.confidence}%
                </span>
              </div>
            </div>
)}

{rootCause.candidateCauses?.length > 0 && (
  <div className="mt-3 border-t border-zinc-800 pt-3">
    <p className="text-xs font-medium text-zinc-300">
      Diagnostic Ranking
    </p>

    <div className="mt-2 space-y-1">
      {rootCause.candidateCauses.map(
        (candidate: any, candidateIndex: number) => (
          <div
  key={candidateIndex}
  className="text-xs"
>
      <div className="flex items-center justify-between">
        <span className="text-zinc-400">
          {candidate.cause}
        </span>

        <div className="text-right">
      <div className="text-zinc-200">
        {candidate.score} pts
      </div>

      {candidate.scoreGapToWinner !== undefined && (
        <div className="text-[10px] text-zinc-500">
          Gap: {candidate.scoreGapToWinner}
        </div>
      )}
    </div>
  </div>

  {candidate.evidence?.length > 0 && (
    <div className="ml-4 mt-1 space-y-1">
      {candidate.evidence
        .filter((factor: any) => factor.contribution !== 0)
        .map((factor: any, factorIndex: number) => (
          <div
              key={factorIndex}
              className="flex items-center justify-between text-[10px]"
            >
              <span className="text-zinc-500">
                • {factor.factor}
              </span>

              <span className="text-zinc-500">
                +{factor.contribution} pts
              </span>
            </div>
          )
        )}
      </div>
    )}
  </div>
        )
      )}
    </div>
  </div>
)}

          {rootCause.evidence?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-300">
                Evidence
              </p>

              <div className="mt-1 space-y-1">
                {rootCause.evidence.map(
                  (e: any, evidenceIndex: number) => (
                    <p
                      key={evidenceIndex}
                      className="text-xs text-zinc-400"
                    >
                      {e.passed ? "✓" : "✗"} {e.label}
                    </p>
                  )
                )}
              </div>
            </div>
          )}

          {rootCause.rejectedCauses?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-300">
                Rejected Causes
              </p>

              <div className="mt-1 space-y-1">
                {rootCause.rejectedCauses.map(
                  (rejected: any, rejectedIndex: number) => (
                    <div
                      key={rejectedIndex}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-zinc-500">
                        ✕ {rejected.cause}
                      </span>

                      {typeof rejected.confidence === "number" && (
                        <span className="text-zinc-400">
                          Rejected {rejected.confidence}%
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          {rootCause.relatedTables?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-300">
                Related XDF Tables
              </p>

              <div className="mt-1 space-y-1">
                {rootCause.relatedTables.map(
                  (table: string, tableIndex: number) => (
                    <div
                      key={tableIndex}
                      className="text-xs text-zinc-400"
                    >
                      • {table}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          <div className="mt-3 rounded-md bg-zinc-950 p-2">
            <p className="text-xs text-zinc-300">
              {rootCause.suggestedDirection}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

      {false && (
        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-200">Likely Causes</p>
          <div className="mt-2 space-y-2">
            {[].map((cause: any, index: number) => (
              <div
                key={index}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">
                    {cause.label || "Unknown cause"}
                  </p>
                  {typeof cause.score === "number" && (
                    <StatusBadge
                      label={`${(cause.score * 100).toFixed(0)}% confidence`}
                      tone="info"
                    />
                  )}
                </div>
                {cause.reason && (
                  <p className="mt-1 text-sm text-zinc-300">{cause.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {crossRef.notes && crossRef.notes.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-sm font-medium text-zinc-200">Tune Notes</p>
          <div className="mt-2 space-y-1">
            {crossRef.notes.map((note, index) => (
              <p key={index} className="text-sm text-zinc-300">
                • {note}
              </p>
            ))}
          </div>
        </div>
      )}

         {false && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ListBlock
            title="Primary Tune Areas"
            items={crossRef.primaryTuneAreas || []}
          />
          <ListBlock
            title="Secondary Tune Areas"
            items={crossRef.secondaryTuneAreas || []}
          />
          <ListBlock
            title="Protection Areas"
            items={crossRef.protectionAreas || []}
          />
          <ListBlock
            title="Hardware Factors"
            items={crossRef.hardwareFactors || []}
          />
        </div>
      )}

      {relatedXdfTables.length > 0 && (
        <ListBlock
          title="Related XDF Tables"
          items={relatedXdfTables.map(
            (xdf) => xdf.tableName || xdf.name || "Unknown XDF Table"
          )}
        />
      )}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-sm font-medium text-zinc-200">{title}</p>

      {items.length > 0 ? (
        <div className="mt-2 space-y-1">
          {items.map((item, index) => (
            <p key={index} className="text-sm text-zinc-300">
              • {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No data</p>
      )}
    </div>
  )
}
