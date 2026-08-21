import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { validateBoostAgainstTune } from "@/lib/analysis/boostValidation";
import { loadEvidenceReloadState } from "@/lib/analysis/authoritativeEvidenceReload";
import type { AnalysisWarning } from "@/lib/analysis/core/analysisWarning";
import type { EnginePlatform } from "@/lib/analysis/core/analysisContext";
import type { RootCauseEvidence } from "@/lib/analysis/rootCauseEngine";
import type { RoutedEvent } from "@/lib/analysis/types";
import {
  correlateEngineeringObservations,
  type ConservativeCorrelationResult,
  type CorrelationGroup,
} from "@/lib/correlation/conservativeCorrelation";
import { WorkshopDiagnosticCard } from "@/lib/components/diagnostics/WorkshopDiagnosticCard";
import {
  EngineeringWorkspaceShell,
  WorkspaceReservedPanel,
} from "@/components/EngineeringWorkspaceShell";
import { groupDiagnosticEvents } from "@/lib/diagnostics/groupDiagnosticEvents";
import { buildHistoricalDiagnosticEvents } from "@/lib/diagnostics/buildHistoricalDiagnosticEvents";
import TelemetryGraphV1 from "./TelemetryGraphV1";
import {
  classifyCrossReferenceNotes,
  groupEventsForPresentation,
  selectScopedPrimaryResults,
  type EventPresentationGroup,
  type GlobalPresentationNote,
  type ScopedPrimaryResult,
} from "./analysisPresentation";
import {
  buildCauseHierarchy,
  dedupeCrossReferencesByEventId,
  groupRepeatedEventObservations,
  observationCountLabel,
  orderRootCauses,
  type PresentationCrossReference,
  type RepeatedObservationGroup,
} from "./evidenceHierarchyPresentation";
import {
  buildCalibrationInspectionRecords,
  type CalibrationInspectionRecord,
  type PresentationXdfReference,
} from "./engineeringInvestigationPresentation";
import {
  buildCylinderIntelligencePresentation,
  humanizeCylinderChannel,
  humanizeCylinderIdentifiersInText,
  type CylinderIntelligencePresentation,
} from "./cylinderIntelligencePresentation";
import {
  buildIntelligentWarningsSummary,
  type IntelligentWarningsSummary,
} from "./intelligentWarningsPresentation";

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

type EngineEvent = {
  id?: string;
  type?: string;
  severity?: "low" | "medium" | "high" | "critical";
  confidence?: number;
  startIndex?: number;
  endIndex?: number;
  rpmStart?: number;
  rpmEnd?: number;
  evidence?: string[];
  supportingChannels?: string[];
  metrics?: Record<string, number | string | boolean | null>;
};

type EventDescriptor = EngineEvent & {
  title?: string;
  name?: string;
  message?: string;
  description?: string;
  category?: string;
  source?: string;
  reason?: string;
  action?: string;
  eventType?: string;
  event_type?: string;
};

type XdfCrossReference = PresentationXdfReference;

type LegacySummary = {
  max_boost?: unknown;
  max_boost_target?: unknown;
  max_iat?: unknown;
  min_afr?: unknown;
  min_rail_pressure?: unknown;
  min_lpfp?: unknown;
  max_wgdc?: unknown;
  ethanol_content?: unknown;
  max_timing_correction?: unknown;
  throttle_closure_detected?: unknown;
  cyl2_max_timing_correction?: unknown;
  cyl3_max_timing_correction?: unknown;
  maxBoost?: unknown;
  maxBoostTarget?: unknown;
  maxWgdc?: unknown;
};

type VehicleContext = {
  engine_code?: string | null;
  platform?: string | null;
  fuel_type?: string | null;
  fueling_setup?: string | null;
  turbo_setup?: string | null;
  horsepower_goal?: unknown;
};

type EnginePullWindow = {
  id?: string;
  startIndex?: number;
  endIndex?: number;
  quality?: "strong" | "usable" | "questionable";
};

type LikelyCause = {
  label?: string;
  score?: number;
  reason?: string;
};

type EngineCrossReference = PresentationCrossReference & {
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
  pullWindows?: EnginePullWindow[];
  events?: EngineEvent[];
  routedEvents?: RoutedEvent[];
  crossReferences?: EngineCrossReference[];
  xdfCrossReferences?: XdfCrossReference[];
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
  const userId = user.id;

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

  async function loadExactLog(logId: string) {
    const { data } = await supabase
      .from("logs")
      .select("*")
      .eq("id", logId)
      .eq("user_id", userId)
      .eq("vehicle_id", vehicle.id)
      .maybeSingle();
    return data;
  }

  async function loadExactSummary(summaryId: string) {
    const { data } = await supabase
      .from("log_summaries")
      .select("*")
      .eq("id", summaryId)
      .maybeSingle();
    return data;
  }

  const evidenceReloadState = latestLog?.id
    ? await loadEvidenceReloadState(
        {
          loadLog: loadExactLog,
          loadSummary: loadExactSummary,
        },
        {
          logId: latestLog.id,
          expectedUserId: userId,
          expectedVehicleId: vehicle.id,
        }
      )
    : null;

  const latestSummary =
    evidenceReloadState?.currentAuthority.state === "available"
      ? (evidenceReloadState.currentAuthority.summary as Awaited<
          ReturnType<typeof loadExactSummary>
        >)
      : null;

  const { data: historicalAuthorityLogs } = await supabase
    .from("logs")
    .select("authoritative_log_summary_id, created_at")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .not("authoritative_log_summary_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const historicalAuthorityIds = (historicalAuthorityLogs ?? []).flatMap(
    (log) =>
      typeof log.authoritative_log_summary_id === "string"
        ? [log.authoritative_log_summary_id]
        : []
  );
  const { data: historicalAuthorityRows } = historicalAuthorityIds.length
    ? await supabase
        .from("log_summaries")
        .select("*")
        .in("id", historicalAuthorityIds)
    : { data: [] };
  const historicalRowsById = new Map(
    (historicalAuthorityRows ?? []).map((summary) => [summary.id, summary])
  );
  const historicalSummaries = historicalAuthorityIds.flatMap((summaryId) => {
    const summary = historicalRowsById.get(summaryId);
    return summary ? [summary] : [];
  });

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
  const intelligentWarningsSummary =
    buildIntelligentWarningsSummary({
      events: engineEvents,
      warnings: [
        ...(engineV2?.warnings ?? []),
        ...legacyPipelineWarnings,
      ],
    });

  const diagnosticTimeline: {
  timestamp: number;
  event: string;
  severity: "low" | "medium" | "high" | "critical";
}[] = engineV2?.diagnosticTimeline ?? [];

  const engineCrossReferences = dedupeCrossReferencesByEventId(
    Array.isArray(engineV2?.crossReferences)
      ? engineV2.crossReferences
      : []
  ) as EngineCrossReference[];

  const repeatedUnresolvedEventGroups = groupRepeatedEventObservations(
    engineEvents,
    engineCrossReferences
  ).filter(
    (group) =>
      group.observations.every(
        ({ crossReference }) =>
          !crossReference.rootCauses?.length
      )
  );

  const groupedUnresolvedEventIds = new Set(
    repeatedUnresolvedEventGroups.flatMap((group) =>
      group.observations.flatMap(({ event }) =>
        event.id ? [event.id] : []
      )
    )
  );
  const eventPresentationGroups =
    groupEventsForPresentation(engineEvents);
  const noteHierarchy =
    classifyCrossReferenceNotes(engineCrossReferences);
  const scopedPrimaryResults = selectScopedPrimaryResults(
    engineEvents,
    engineCrossReferences
  );
  const cylinderIntelligencePresentations =
    buildCylinderIntelligencePresentation(
      engineEvents,
      engineCrossReferences
    );

  const correlationResult = correlateEngineeringObservations({
    analysisId:
      typeof latestSummary?.id === "string"
        ? latestSummary.id
        : undefined,
    events: engineEvents,
    pullWindows: engineV2?.pullWindows ?? [],
    crossReferences: engineCrossReferences,
  });

const xdfCrossReferences = Array.isArray(engineV2?.xdfCrossReferences)
  ? engineV2.xdfCrossReferences
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
const tuneProfile = effectiveTuneProfile;

const tuneReasoningFlags = buildTuneReasoningFlags(
  tuneProfile,
  latestSummary,
  vehicle,
  engineEvents
);

const historicalDiagnosticEvents =
  buildHistoricalDiagnosticEvents(
    historicalSummaries || []
  );

function getRelatedXdfTablesForEvent(
  event: EventDescriptor | null,
  xdfCrossReferences: readonly XdfCrossReference[] = []
) {
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
                    ? `Tune: ${humanizeToken(tuneProfile.parsing_status)}`
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

        <EngineeringWorkspaceShell
          summary={
            <EngineeringSummaryCard
              hasLog={!!latestLog}
              hasSummary={!!latestSummary}
              quickVerdict={engineV2?.quickVerdict}
              verdictFlags={renderedVerdictFlags}
            />
          }
          primaryResults={
            scopedPrimaryResults.length > 0 ? (
              <PrimaryEngineeringResults results={scopedPrimaryResults} />
            ) : (
              <WorkspaceReservedPanel title="No primary results available">
                Primary engineering results will appear here when the existing
                analysis produces scoped results for this record.
              </WorkspaceReservedPanel>
            )
          }
          telemetry={
            <TelemetryGraphV1
              events={engineV2?.events ?? []}
              pullWindows={engineV2?.pullWindows ?? []}
              telemetry={engineV2?.telemetry ?? null}
            />
          }
          evidence={
            <EngineeringCorrelationSurface result={correlationResult} />
          }
          investigation={
            <WorkspaceReservedPanel title="Investigation workspace">
              Detailed investigation surfaces remain below and retain their
              existing engineering ownership. Shared focus synchronisation is
              reserved for a later authorised slice.
            </WorkspaceReservedPanel>
          }
          calibrationContext={
            <WorkspaceReservedPanel title="Calibration context">
              Calibration context is reserved for governed calibration material.
              This shell does not infer, calculate or publish calibration
              intelligence.
            </WorkspaceReservedPanel>
          }
        />

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
                ? humanizeToken(tuneProfile.parsing_status)
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
                  ? humanizeToken(tuneProfile.parsing_status)
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
                  value={
                    tuneProfile.detected_platform
                      ? humanizeToken(tuneProfile.detected_platform)
                      : "Unknown"
                  }
                />
                <InfoCard
                  title="Parsing Status"
                  value={
                    tuneProfile.parsing_status
                      ? humanizeToken(tuneProfile.parsing_status)
                      : "Unknown"
                  }
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
                  value={
                    tuneProfile.boost_intent
                      ? humanizeToken(tuneProfile.boost_intent)
                      : "Unknown"
                  }
                />
                <InfoCard
                  title="Ignition Intent"
                  value={
                    tuneProfile.ignition_intent
                      ? humanizeToken(tuneProfile.ignition_intent)
                      : "Unknown"
                  }
                />
                <InfoCard
                  title="Fueling Intent"
                 value={
                   effectiveTuneProfile?.fueling_intent
                     ? humanizeToken(
                         effectiveTuneProfile.fueling_intent
                       )
                     : "Unknown"
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
            <h2 className="text-xl font-semibold">Intelligent Warnings</h2>
            <StatusBadge
              label={intelligentWarningsSummary.state.toUpperCase()}
              tone={
                intelligentWarningsSummary.state === "warning"
                  ? "bad"
                  : intelligentWarningsSummary.state === "caution"
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
    <IntelligentWarningsSummaryCard
      summary={intelligentWarningsSummary}
    />
    <div className="space-y-3">
      {renderedRoutedEvents.length > 0 &&
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
            source={
              event.source ? humanizeToken(event.source) : undefined
            }
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
            supportingChannels={
              event.event?.type
                ? [humanizeEventType(event.event.type)]
                : []
            }
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
                ? [
                    {
                      label: "Source",
                      value: humanizeToken(event.source),
                    },
                  ]
                : []),
              ...(event.category
                ? [{ label: "Category", value: event.category }]
                : []),
              ...(event.event?.type
                ? [
                    {
                      label: "Event Type",
                      value: humanizeEventType(event.event.type),
                    },
                  ]
                : []),
            ]}
          />
        ))}
      </div>
    ) : null
  )}
    </div>

    {cylinderIntelligencePresentations.map((presentation) => (
      <CylinderIntelligenceWarningCard
        key={presentation.eventId}
        presentation={presentation}
      />
    ))}

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
          {eventPresentationGroups.map((group) =>
            group.events.length > 1 ? (
              <RepeatedEventFamilyCard
                crossReferences={engineCrossReferences}
                group={group}
                key={group.eventType}
                pullWindows={engineV2?.pullWindows ?? []}
              />
            ) : (
              <EventCard
                key={
                  group.events[0]?.id ||
                  `event-${group.eventType}`
                }
                event={group.events[0] as EngineEvent}
              />
            )
          )}
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
                {repeatedUnresolvedEventGroups.map((group) => (
                  <RepeatedObservationGroupCard
                    key={group.eventType}
                    group={group}
                  />
                ))}

                {engineCrossReferences.map((crossRef, index) => {
                  if (
                    crossRef.eventId &&
                    groupedUnresolvedEventIds.has(crossRef.eventId)
                  ) {
                    return null;
                  }

                  const linkedEvent =
                    engineEvents.find((event) => event.id === crossRef.eventId) ||
                    null;

                  return (
                    <CrossReferenceCard
                      analysisId={
                        typeof latestSummary?.id === "string"
                          ? latestSummary.id
                          : undefined
                      }
                      key={crossRef.eventId || `crossref-${index}`}
                      crossRef={crossRef}
                      eventSpecificNotes={
                        crossRef.eventId
                          ? noteHierarchy.eventSpecificNotes.get(
                              crossRef.eventId
                            ) ?? []
                          : []
                      }
                      linkedEvent={linkedEvent}
                      observation={index + 1}
                      relatedXdfTables={getRelatedXdfTablesForEvent(linkedEvent, xdfCrossReferences)}
                      tuneId={
                        typeof latestTune?.id === "string"
                          ? latestTune.id
                          : undefined
                      }
                      vehicleId={id}
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

        {noteHierarchy.globalNotes.length > 0 && (
          <GlobalTuneNotesCard notes={noteHierarchy.globalNotes} />
        )}
      </div>
    </main>
  );
}

function getEngineV2(summaryRow: unknown): EngineV2 | null {
  if (!isRecord(summaryRow) || !isRecord(summaryRow.summary)) {
    return null;
  }

  const raw = summaryRow.summary.engine_v2;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  return raw as EngineV2;
}

function buildTuneReasoningFlags(
  tuneProfile: TuneProfileRow | null,
  summary: LegacySummary | null,
  vehicle: VehicleContext,
  engineEvents: EventDescriptor[] = []
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
  platform: toEnginePlatform(
    vehicle?.engine_code ||
    vehicle?.platform
  ),

  fuelType:
    vehicle?.fuel_type ||
    "Unknown",

  maxBoost: finiteNumberOrNullish(
    summary?.max_boost ??
    summary?.maxBoost
  ),

  maxBoostTarget: finiteNumberOrNullish(
    summary?.max_boost_target ??
    summary?.maxBoostTarget
  ),

  maxWgdc: finiteNumberOrNullish(
    summary?.max_wgdc ??
    summary?.maxWgdc
  ),

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

  const hpfpCapacityEvent = engineEvents.find((x) => {
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

const lpfpSupplyEvent = engineEvents.find((x) => {
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
  summary: LegacySummary | null,
  boostError: number | null,
  vehicle: VehicleContext
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

function buildAnalysisFlags(
  summary: LegacySummary | null,
  boostError: number | null,
  vehicle: VehicleContext
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

function humanizeEngineeringIdentifier(value: string) {
  return humanizeCylinderChannel(value) ?? humanizeToken(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumberOrNullish(
  value: unknown
): number | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toEnginePlatform(value: string | null | undefined): EnginePlatform {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "n54" ||
    normalized === "n55" ||
    normalized === "s55" ||
    normalized === "b58" ||
    normalized === "s58"
  ) {
    return normalized;
  }

  return "unknown";
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

function IntelligentWarningsSummaryCard({
  summary,
}: {
  summary: IntelligentWarningsSummary;
}) {
  const tone =
    summary.state === "warning"
      ? "bad"
      : summary.state === "caution"
        ? "warn"
        : "good";

  return (
    <div className="mb-4">
      <FlagCard
        message={summary.message}
        title={summary.title}
        tone={tone}
      />
    </div>
  );
}

function CylinderIntelligenceWarningCard({
  presentation,
}: {
  presentation: CylinderIntelligencePresentation;
}) {
  const rpmRange = presentation.rpmRange
    ? `${Math.round(presentation.rpmRange[0]).toLocaleString()}–${Math.round(
        presentation.rpmRange[1]
      ).toLocaleString()} RPM`
    : "RPM range unavailable";

  return (
    <details className="group mt-3 rounded-xl border border-amber-700/50 bg-amber-950/20">
      <summary className="cursor-pointer list-none p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {presentation.title}
            </p>
            <p className="mt-1 text-xs text-zinc-400">{rpmRange}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {presentation.severity && (
              <StatusBadge
                label={humanizeStatus(presentation.severity)}
                tone={mapSeverityToTone(
                  presentation.severity as EngineEvent["severity"]
                )}
              />
            )}
            {typeof presentation.eventConfidence === "number" && (
              <StatusBadge
                label={`${Math.round(
                  presentation.eventConfidence * 100
                )}% Event Confidence`}
                tone="info"
              />
            )}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-black/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Primary Engineering Result
          </p>
          {presentation.primaryCause ? (
            <>
              <p className="mt-1 font-semibold text-zinc-100">
                {presentation.primaryCause}
              </p>
              {typeof presentation.causeConfidence === "number" && (
                <p className="mt-1 text-xs text-zinc-400">
                  {presentation.causeConfidence}% Cause Confidence
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 font-semibold text-zinc-100">
                Qualified timing correction event detected.
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                No authoritative cause ranking is currently available.
              </p>
            </>
          )}
        </div>

        {presentation.affectedCylinders.length > 0 && (
          <p className="mt-3 text-xs text-zinc-300">
            Affected cylinders:{" "}
            {presentation.affectedCylinders
              .map((cylinder) =>
                cylinder.label.replace("Cylinder ", "")
              )
              .join(", ")}
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500 group-open:hidden">
          Expand for supporting evidence and explanation.
        </p>
      </summary>

      <div className="border-t border-amber-700/30 p-4">
        {presentation.affectedCylinders.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-300">
            Supporting Evidence
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {presentation.affectedCylinders.map((cylinder) => (
              <div
                className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2"
                key={cylinder.channel}
              >
                <p className="text-xs text-zinc-400">{cylinder.label}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-zinc-100">
                  {cylinder.value === null
                    ? "Correction observed"
                    : `${cylinder.value.toFixed(1)}°`}
                </p>
              </div>
            ))}
          </div>
        </div>
        )}

        <div className="mt-4 space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-sm text-zinc-300">
          <p className="text-xs font-medium text-zinc-300">
            Evidence and Explanation Detail
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {typeof presentation.eventConfidence === "number" && (
              <div>
                <p className="text-xs font-medium text-zinc-300">
                  Event Confidence
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Confidence that the detected timing event occurred:{" "}
                  {Math.round(presentation.eventConfidence * 100)}%.
                </p>
              </div>
            )}
            {typeof presentation.causeConfidence === "number" && (
              <div>
                <p className="text-xs font-medium text-zinc-300">
                  Cause Confidence
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Confidence that the selected engineering explanation is
                  correct: {presentation.causeConfidence}%.
                </p>
              </div>
            )}
          </div>
          {presentation.sourceEvidence.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400">
                Supplied event evidence
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {presentation.sourceEvidence.map((evidence, index) => (
                  <li key={`${evidence}-${index}`}>{evidence}</li>
                ))}
              </ul>
            </div>
          )}

          {presentation.rejectedAlternatives.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400">
                Rejected alternatives
              </p>
              <div className="mt-2 space-y-2">
                {presentation.rejectedAlternatives.map((alternative) => (
                  <div key={`${alternative.cause}-${alternative.reason}`}>
                    <p className="font-medium text-zinc-200">
                      {alternative.cause}
                      {typeof alternative.confidence === "number"
                        ? ` · ${alternative.confidence}%`
                        : ""}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {alternative.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {presentation.inspectionDirection && (
            <div>
              <p className="text-xs font-medium text-zinc-400">
                Inspection direction
              </p>
              <p className="mt-1">{presentation.inspectionDirection}</p>
            </div>
          )}

          <p className="text-xs text-zinc-500">
            Source: qualified Engineering Event with event-scoped Explanation.
          </p>
        </div>
      </div>
    </details>
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
              • {humanizeCylinderIdentifiersInText(line)}
            </p>
          ))}
        </div>
      )}

      {event.supportingChannels && event.supportingChannels.length > 0 && (
        <p className="mt-3 text-xs opacity-80">
          Channels:{" "}
          {event.supportingChannels
            .map(humanizeEngineeringIdentifier)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

function EngineeringSummaryCard({
  hasLog,
  hasSummary,
  quickVerdict,
  verdictFlags,
}: {
  hasLog: boolean;
  hasSummary: boolean;
  quickVerdict?: EngineQuickVerdict;
  verdictFlags: readonly AnalysisFlag[];
}) {
  return (
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Engineering Summary</h2>
        {quickVerdict?.status && (
          <StatusBadge
            label={humanizeStatus(quickVerdict.status)}
            tone={
              quickVerdict.status === "critical"
                ? "bad"
                : quickVerdict.status === "caution"
                  ? "warn"
                  : "good"
            }
          />
        )}
      </div>

      {!hasLog && (
        <p className="text-zinc-400">
          No log uploaded yet. Upload a log to begin analysis.
        </p>
      )}

      {hasLog && !hasSummary && (
        <p className="text-zinc-400">
          Log found, but no summary data is available yet.
        </p>
      )}

      {hasLog && hasSummary && (
        <div className="space-y-3">
          {verdictFlags.map((flag, index) => (
            <FlagCard
              key={`${flag.title}-${index}`}
              message={flag.message}
              title={flag.title}
              tone={flag.tone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PrimaryEngineeringResults({
  results,
}: {
  results: readonly ScopedPrimaryResult[];
}) {
  return (
    <section
      aria-labelledby="primary-engineering-results-heading"
      className="bmw-border rounded-2xl bg-zinc-900 p-6"
    >
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
          Event-scoped authoritative reasoning
        </p>
        <h2
          className="mt-1 text-xl font-semibold"
          id="primary-engineering-results-heading"
        >
          Primary Engineering Result
          {results.length === 1 ? "" : "s"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Each result is scoped to its detected event. It is not a global
          diagnosis for the complete analysis.
        </p>
      </header>

      <div className="mt-5 space-y-4">
        {results.map(({ event, rootCause }, index) => {
          const rejectedCauses = rootCause.rejectedCauses ?? [];
          const evidence = (rootCause.evidence ?? []).filter(
            (
              item
            ): item is RootCauseEvidence =>
              !!item &&
              typeof item === "object" &&
              "label" in item &&
              typeof item.label === "string" &&
              "passed" in item &&
              typeof item.passed === "boolean"
          );

          return (
            <article
              className="border border-sky-500/40 bg-sky-500/5 p-5"
              key={`${event.id ?? "event"}-${rootCause.cause ?? index}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                    Primary Engineering Result for{" "}
                    {humanizeEventType(event.type ?? "detected event")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {rootCause.cause ?? "Unidentified cause"}
                  </h3>
                  {typeof event.rpmStart === "number" &&
                    typeof event.rpmEnd === "number" && (
                      <p className="mt-1 font-mono text-xs text-zinc-400">
                        Event scope:{" "}
                        {Math.round(event.rpmStart).toLocaleString()}–
                        {Math.round(event.rpmEnd).toLocaleString()} RPM
                      </p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {event.severity && (
                    <StatusBadge
                      label={`${event.severity} severity`}
                      tone={mapSeverityToTone(
                        event.severity as EngineEvent["severity"]
                      )}
                    />
                  )}
                  {typeof rootCause.confidence === "number" && (
                    <StatusBadge
                      label={`${rootCause.confidence}% cause confidence`}
                      tone="info"
                    />
                  )}
                </div>
              </div>

              {rootCause.reasoningNarrative && (
                <DisclosureSection title="Evidence and Selection Logic">
                  <div>
                  <p className="text-xs font-semibold text-zinc-300">
                    Why this result was selected
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    {rootCause.reasoningNarrative}
                  </p>
                  </div>
                </DisclosureSection>
              )}

              {evidence.length > 0 && (
                <DisclosureSection title="Strongest Supplied Evidence">
                  <div>
                  <p className="text-xs font-semibold text-zinc-300">
                    Strongest supplied evidence
                  </p>
                  <div className="mt-2 space-y-1">
                    {evidence.map((item, evidenceIndex) => (
                      <p
                        className="text-xs text-zinc-400"
                        key={`${item.label}-${evidenceIndex}`}
                      >
                        {item.passed === false ? "✕" : "✓"} {item.label}
                      </p>
                    ))}
                  </div>
                  </div>
                </DisclosureSection>
              )}

              {rejectedCauses.length > 0 && (
                <DisclosureSection title="Rejected and Alternative Causes">
                  <div className="border-l-2 border-zinc-700 pl-3">
                  <p className="text-xs font-semibold text-zinc-300">
                    Important rejected causes
                  </p>
                  {rejectedCauses.map((rejected, rejectedIndex) => (
                    <p
                      className="mt-1 text-xs text-zinc-400"
                      key={`${rejected.cause}-${rejectedIndex}`}
                    >
                      {rejected.cause}
                      {typeof rejected.confidence === "number"
                        ? ` · ${rejected.confidence}%`
                        : ""}
                      {rejected.reason ? ` · ${rejected.reason}` : ""}
                    </p>
                  ))}
                  </div>
                </DisclosureSection>
              )}

              {rootCause.suggestedDirection && (
                <div className="mt-4 border-t border-zinc-800 pt-3">
                  <p className="text-xs font-semibold text-zinc-300">
                    Existing inspection direction
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {rootCause.suggestedDirection}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function eventPullLabels(
  event: EngineEvent,
  pullWindows: readonly EnginePullWindow[]
): string[] {
  if (
    typeof event.startIndex !== "number" ||
    typeof event.endIndex !== "number"
  ) {
    return [];
  }
  const eventStart = event.startIndex;
  const eventEnd = event.endIndex;

  return pullWindows.flatMap((pull, index) => {
    if (
      typeof pull.startIndex !== "number" ||
      typeof pull.endIndex !== "number"
    ) {
      return [];
    }
    const overlaps =
      eventStart <= pull.endIndex &&
      eventEnd >= pull.startIndex;

    return overlaps ? [`Pull ${index + 1}`] : [];
  });
}

function RepeatedEventFamilyCard({
  crossReferences,
  group,
  pullWindows,
}: {
  crossReferences: readonly EngineCrossReference[];
  group: EventPresentationGroup;
  pullWindows: readonly EnginePullWindow[];
}) {
  const crossReferenceByEventId = new Map(
    crossReferences.flatMap((crossReference) =>
      crossReference.eventId
        ? [[crossReference.eventId, crossReference] as const]
        : []
    )
  );
  const rankedObservationCount = group.events.filter((event) => {
    const crossReference = event.id
      ? crossReferenceByEventId.get(event.id)
      : undefined;
    return (crossReference?.rootCauses?.length ?? 0) > 0;
  }).length;

  return (
    <section className="border border-zinc-800 bg-zinc-950">
      <header className="border-b border-zinc-800 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Repeated detected event family
        </p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              {humanizeEventType(group.eventType)}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Observed across {group.events.length} distinct regions. Every
              event remains a separate engineering record.
            </p>
            {rankedObservationCount === 0 && (
              <p className="mt-2 text-xs text-amber-200">
                No authoritative cause ranking is available for these
                observations.
              </p>
            )}
          </div>
          <StatusBadge
            label={`${group.events.length} distinct observations`}
            tone="info"
          />
        </div>
      </header>

      <div className="grid gap-px bg-zinc-800 lg:grid-cols-2">
        {group.events.map((event, index) => {
          const crossReference = event.id
            ? crossReferenceByEventId.get(event.id)
            : undefined;
          const rootCauses = orderRootCauses(
            crossReference?.rootCauses ?? []
          );
          const pullLabels = eventPullLabels(
            event as EngineEvent,
            pullWindows
          );
          const minAfr = event.metrics?.minAfr;

          return (
            <article
              className="bg-zinc-950 p-4"
              key={event.id ?? `${group.eventType}-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-100">
                    Observation {index + 1}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {pullLabels.length > 0
                      ? pullLabels.join(", ")
                      : "Pull association unavailable"}
                  </p>
                  {typeof event.rpmStart === "number" &&
                    typeof event.rpmEnd === "number" && (
                      <p className="mt-1 font-mono text-xs text-zinc-400">
                        {Math.round(event.rpmStart).toLocaleString()}–
                        {Math.round(event.rpmEnd).toLocaleString()} RPM
                      </p>
                    )}
                </div>
                {event.severity &&
                  ["low", "medium", "high", "critical"].includes(
                    event.severity
                  ) && (
                  <StatusBadge
                    label={event.severity}
                    tone={mapSeverityToTone(
                      event.severity as EngineEvent["severity"]
                    )}
                  />
                  )}
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                {typeof event.confidence === "number" && (
                  <span>
                    {Math.round(event.confidence * 100)}% event confidence
                  </span>
                )}
                {typeof minAfr === "number" && (
                  <span>Minimum AFR {minAfr.toFixed(2)}</span>
                )}
              </div>

              {(event.evidence?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1">
                  {(event.evidence ?? []).map((evidence, evidenceIndex) => (
                    <p
                      className="text-xs leading-5 text-zinc-300"
                      key={`${evidence}-${evidenceIndex}`}
                    >
                      {humanizeCylinderIdentifiersInText(evidence)}
                    </p>
                  ))}
                </div>
              )}

              {(event.supportingChannels?.length ?? 0) > 0 && (
                <p className="mt-3 text-xs text-zinc-500">
                  Evidence channels:{" "}
                  {(event.supportingChannels ?? [])
                    .map(humanizeEngineeringIdentifier)
                    .join(", ")}
                </p>
              )}

              {rootCauses.length > 0 && (
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    Supplied cause ranking
                  </p>
                  {rootCauses.map((rootCause, rootCauseIndex) => (
                    <p
                      className="mt-1 text-xs text-zinc-300"
                      key={`${rootCause.rank}-${rootCause.cause}-${rootCauseIndex}`}
                    >
                      {rootCause.rank}: {rootCause.cause}
                      {typeof rootCause.confidence === "number"
                        ? ` · ${rootCause.confidence}%`
                        : ""}
                    </p>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GlobalTuneNotesCard({
  notes,
}: {
  notes: readonly GlobalPresentationNote[];
}) {
  return (
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
        Analysis-wide tune context
      </p>
      <h2 className="mt-1 text-xl font-semibold">Global Tune Notes</h2>
      <div className="mt-4 space-y-2">
        {notes.map((note) => (
          <div className="border-l-2 border-zinc-700 pl-3" key={note.text}>
            <p className="text-sm text-zinc-300">{note.text}</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Preserved from {note.sourceEventIds.length} event Cross
              Reference{note.sourceEventIds.length === 1 ? "" : "s"}.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EngineeringCorrelationSurface({
  result,
}: {
  result: ConservativeCorrelationResult;
}) {
  return (
    <section
      aria-labelledby="engineering-correlation-heading"
      className="bmw-border rounded-2xl bg-zinc-900 p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
            Qualified observation relationships
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            id="engineering-correlation-heading"
          >
            Engineering Correlation
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Deterministic relationships between existing events and evidence.
            Correlation does not establish a global diagnosis or inspection
            direction.
          </p>
        </div>

        <StatusBadge
          label={`${result.groups.length} qualified ${
            result.groups.length === 1 ? "relationship" : "relationships"
          }`}
          tone={result.groups.length > 0 ? "info" : "warn"}
        />
      </header>

      {result.groups.length > 0 ? (
        <div className="mt-5 space-y-4">
          {result.groups.map((group) => (
            <CorrelationGroupCard group={group} key={group.id} />
          ))}
        </div>
      ) : (
        <div className="mt-5 border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-300">
            No qualified cross-event relationship can be established from the
            available persisted analysis.
          </p>
        </div>
      )}

      {result.uncorrelatedEventIds.length > 0 && (
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          {result.uncorrelatedEventIds.length} event
          {result.uncorrelatedEventIds.length === 1 ? "" : "s"} remain
          {result.uncorrelatedEventIds.length === 1 ? "s" : ""} uncorrelated.
          Same-log membership alone does not establish a
          relationship.
        </p>
      )}
    </section>
  );
}

function CorrelationGroupCard({
  group,
}: {
  group: CorrelationGroup;
}) {
  const relationshipLabel = humanizeToken(group.relationshipType);
  const uniqueEvidence = group.supportingEvidence.filter(
    (evidence, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.eventId === evidence.eventId &&
          candidate.evidenceIndex === evidence.evidenceIndex
      ) === index
  );

  return (
    <article className="border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {relationshipLabel}
          </p>
          <h3 className="mt-1 text-base font-semibold text-zinc-100">
            {group.label}
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            {group.relatedEventIds.length} contributing events
            {group.relatedPullIds.length > 0
              ? ` across ${group.relatedPullIds.length} pull regions`
              : ""}
            .
          </p>
        </div>

        <StatusBadge
          label={`${humanizeToken(group.strength)} correlation`}
          tone={
            group.strength === "contradictory"
              ? "bad"
              : group.strength === "unresolved"
                ? "warn"
                : "info"
          }
        />
      </div>

      {group.sharedChannels.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          Shared channels:{" "}
          {group.sharedChannels
            .map(humanizeEngineeringIdentifier)
            .join(", ")}
        </p>
      )}

      {uniqueEvidence.length > 0 && (
        <details className="mt-4 border-t border-zinc-800 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-300">
            Supporting evidence references
          </summary>
          <div className="mt-2 space-y-1">
            {uniqueEvidence.map((evidence) => (
              <p
                className="text-xs leading-5 text-zinc-400"
                key={`${evidence.eventId}-${evidence.evidenceIndex}`}
              >
                {evidence.eventId}: {evidence.statement}
              </p>
            ))}
          </div>
        </details>
      )}

      {group.contradictingEvidence.length > 0 && (
        <div className="mt-4 border-l-2 border-red-500/70 pl-3">
          <p className="text-xs font-semibold text-red-200">
            Contradicting evidence
          </p>
          {group.contradictingEvidence.map((evidence) => (
            <p className="mt-1 text-xs text-zinc-400" key={evidence}>
              {evidence}
            </p>
          ))}
        </div>
      )}

      {group.unresolvedLimitations.length > 0 && (
        <div className="mt-4 border-l-2 border-amber-400/70 pl-3">
          <p className="text-xs font-semibold text-amber-200">
            Unresolved limitation
          </p>
          {group.unresolvedLimitations.map((limitation) => (
            <p className="mt-1 text-xs leading-5 text-zinc-400" key={limitation}>
              {limitation}
            </p>
          ))}
        </div>
      )}

      <details className="mt-4 border-t border-zinc-800 pt-3">
        <summary className="cursor-pointer text-xs font-medium text-zinc-400">
          Detailed provenance and rule identifiers
        </summary>
        <div className="mt-2 space-y-1 font-mono text-[11px] text-zinc-500">
          <p>Events: {group.provenance.eventIds.join(", ")}</p>
          <p>
            Pulls:{" "}
            {group.provenance.pullIds.length > 0
              ? group.provenance.pullIds.join(", ")
              : "not available"}
          </p>
          <p>Rules: {group.appliedRuleIds.join(", ")}</p>
        </div>
      </details>
    </article>
  );
}

function RepeatedObservationGroupCard({
  group,
}: {
  group: RepeatedObservationGroup;
}) {
  const isWgdc = group.eventType === "wgdc_saturation";
  const groupTitle = isWgdc
    ? "WGDC Control Saturation"
    : humanizeEventType(group.eventType);

  return (
    <section
      aria-label={`${groupTitle} observations`}
      className="border border-amber-500/30 bg-zinc-950"
    >
      <header className="border-b border-zinc-800 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Repeated observed event family
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {groupTitle}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Observed across {group.observations.length} distinct regions.{" "}
              {isWgdc
                ? "The available evidence establishes repeated wastegate control saturation but does not distinguish the underlying mechanical or calibration cause."
                : "The observations remain distinct engineering records, and no authoritative cause ranking is available for this event family."}
            </p>
          </div>

          <StatusBadge
            label={observationCountLabel(group.observations.length)}
            tone="warn"
          />
        </div>
      </header>

      <div className="grid gap-px bg-zinc-800 lg:grid-cols-3">
        {group.observations.map(
          ({ event, crossReference }, index) => {
            const avgWgdc = event.metrics?.avgWgdc;
            const minAfr = event.metrics?.minAfr;

            return (
              <article
                key={event.id ?? `wgdc-observation-${index}`}
                className="bg-zinc-950 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      Observation {index + 1}
                    </p>
                    {typeof event.rpmStart === "number" &&
                      typeof event.rpmEnd === "number" && (
                        <p className="mt-1 font-mono text-xs text-zinc-400">
                          {Math.round(event.rpmStart).toLocaleString()}–
                          {Math.round(event.rpmEnd).toLocaleString()} RPM
                        </p>
                      )}
                  </div>

                  {typeof event.confidence === "number" && (
                    <StatusBadge
                      label={`${Math.round(
                        event.confidence * 100
                      )}% event confidence`}
                      tone="info"
                    />
                  )}
                </div>

                {typeof avgWgdc === "number" && (
                  <div className="mt-3 border-l-2 border-amber-400 pl-3">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Average WGDC
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold text-amber-200">
                      {avgWgdc.toFixed(1)}%
                    </p>
                  </div>
                )}

                {typeof minAfr === "number" && (
                  <div className="mt-3 border-l-2 border-amber-400 pl-3">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                      Minimum AFR
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold text-amber-200">
                      {minAfr.toFixed(2)}
                    </p>
                  </div>
                )}

                {event.evidence && event.evidence.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {event.evidence.map((evidence) => (
                      <p
                        key={evidence}
                        className="text-xs leading-5 text-zinc-300"
                      >
                        {evidence}
                      </p>
                    ))}
                  </div>
                )}

                {event.supportingChannels &&
                  event.supportingChannels.length > 0 && (
                    <p className="mt-3 text-xs text-zinc-500">
                      Evidence channels:{" "}
                      {event.supportingChannels
                        .map(humanizeEngineeringIdentifier)
                        .join(", ")}
                    </p>
                  )}

                {crossReference.likelyCauses &&
                  crossReference.likelyCauses.length > 0 && (
                    <div className="mt-3 border-t border-zinc-800 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                        Existing reasoning context
                      </p>
                      {crossReference.likelyCauses.map((cause) => (
                        <p
                          key={cause.label}
                          className="mt-1 text-xs text-zinc-300"
                        >
                          {cause.label}
                        </p>
                      ))}
                    </div>
                  )}
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}

function CrossReferenceCard({
  analysisId,
  crossRef,
  eventSpecificNotes = [],
  linkedEvent,
  observation,
  relatedXdfTables = [],
  tuneId,
  vehicleId,
}: {
  analysisId?: string;
  crossRef: EngineCrossReference;
  eventSpecificNotes?: readonly string[];
  linkedEvent: EngineEvent | null;
  observation?: number;
  relatedXdfTables?: readonly XdfCrossReference[];
  tuneId?: string;
  vehicleId?: string;
}) {
  const severityTone = mapSeverityToTone(linkedEvent?.severity);
  const orderedRootCauses = orderRootCauses(crossRef.rootCauses ?? []);
  const causeHierarchy = buildCauseHierarchy(crossRef.rootCauses ?? []);
  const calibrationInspectionRecords = orderedRootCauses.flatMap(
    (rootCause) =>
      buildCalibrationInspectionRecords({
        analysisId,
        event: linkedEvent,
        observation,
        relatedXdfTables:
          rootCause.rank === "primary" ? relatedXdfTables : [],
        rootCause,
        tuneId,
        vehicleId,
      })
  );

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

      {orderedRootCauses.length === 0 && (
        <p className="mt-4 border-l-2 border-amber-400/70 pl-3 text-sm text-amber-100">
          No qualified root-cause ranking is available for this event. The
          observed event evidence remains available without a promoted cause.
        </p>
      )}
       
      {orderedRootCauses.length > 0 && (
  <div className="mt-4">
   {causeHierarchy.primary && (
     <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
       Primary Engineering Result
     </p>
   )}
   <div className="mt-2 space-y-3">
      {orderedRootCauses.map((rootCause, index) => (
        <div
          key={`${rootCause.rank}-${rootCause.cause}-${index}`}
          className={
            rootCause.rank === "primary"
              ? "border border-sky-500/40 bg-sky-500/5 p-4"
              : "border border-zinc-800 bg-zinc-900 p-3"
          }
        >
          {rootCause.rank === "primary" && (
            <p className="mb-2 text-xs font-medium text-sky-300">
              The strongest supported cause is:
            </p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                {rootCause.cause}
              </p>

              <p className="text-xs text-zinc-400 uppercase">
                {rootCause.rank === "primary"
                  ? "Primary Engineering Result"
                  : "Alternative Supported Cause"}
              </p>
            </div>

            <StatusBadge
              label={`${rootCause.confidence}% confidence`}
              tone="info"
            />
          </div>

          {(rootCause.confidenceBreakdown?.length ?? 0) > 0 && (
            <DisclosureSection title="Evidence and Selection Logic">
              <p className="text-xs font-medium text-zinc-300">
                Why TuneSight selected this cause
              </p>
              {rootCause.reasoningNarrative && (
                <p className="mt-2 text-xs text-zinc-400">
                  {rootCause.reasoningNarrative}
                </p>
              )}

              <div className="mt-2 space-y-1">
                {(rootCause.confidenceBreakdown ?? [])
                  .filter((factor) => factor.contribution !== 0)
                  .map((factor, factorIndex) => (
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
            </DisclosureSection>
)}

{(rootCause.candidateCauses?.length ?? 0) > 0 && (
  <DisclosureSection title="Diagnostic Ranking">
    <div className="mt-2 space-y-2">
      {(rootCause.candidateCauses ?? []).map(
        (candidate, candidateIndex) => (
          <div
            key={candidateIndex}
            className="border border-zinc-800 bg-zinc-950 p-3 text-xs"
          >
      <div className="flex items-center justify-between">
        <span className="text-zinc-400">
          #{candidateIndex + 1} {candidate.cause}
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

  {(candidate.evidence?.length ?? 0) > 0 && (
    <div className="ml-4 mt-1 space-y-1">
      {(candidate.evidence ?? [])
        .filter((factor) => factor.contribution !== 0)
        .map((factor, factorIndex) => (
          <div
              key={factorIndex}
              className="flex items-center justify-between text-[10px]"
            >
              <span className="text-zinc-500">
                • {factor.factor}
              </span>

              <span
                className={
                  factor.contribution < 0
                    ? "text-red-300"
                    : "text-emerald-300"
                }
              >
                {factor.contribution > 0 ? "+" : ""}
                {factor.contribution} pts
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
  </DisclosureSection>
)}

          {(rootCause.evidence?.length ?? 0) > 0 && (
            <DisclosureSection title="Supplied Evidence">
              <div className="mt-1 space-y-1">
                {(rootCause.evidence ?? []).map(
                  (e, evidenceIndex) => (
                    <p
                      key={evidenceIndex}
                      className="text-xs text-zinc-400"
                    >
                      {e.passed ? "✓" : "✗"} {e.label}
                    </p>
                  )
                )}
              </div>
            </DisclosureSection>
          )}

          {(rootCause.rejectedCauses?.length ?? 0) > 0 && (
            <DisclosureSection title="Rejected and Alternative Causes">
              <div className="mt-1 space-y-1">
                {(rootCause.rejectedCauses ?? []).map(
                  (rejected, rejectedIndex) => (
                    <div
                      key={rejectedIndex}
                      className="border-l border-zinc-700 pl-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400">
                        ✕ {rejected.cause}
                      </span>

                      {typeof rejected.confidence === "number" && (
                        <span className="text-zinc-500">
                          {rejected.confidence}%
                        </span>
                      )}
                      </div>
                      {rejected.reason && (
                        <p className="mt-1 text-zinc-500">
                          {rejected.reason}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            </DisclosureSection>
          )}
          {false && (rootCause.relatedTables?.length ?? 0) > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-300">
                Related XDF Tables
              </p>

              <div className="mt-1 space-y-1">
                {(rootCause.relatedTables ?? []).map(
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
    {calibrationInspectionRecords.length > 0 && (
      <CalibrationInspectionRecords records={calibrationInspectionRecords} />
    )}
  </div>
)}

      {eventSpecificNotes.length > 0 && (
        <DisclosureSection title="Event Context and Notes">
          <div className="mt-2 space-y-1">
            {eventSpecificNotes.map((note, index) => (
              <p key={index} className="text-sm text-zinc-300">
                • {note}
              </p>
            ))}
          </div>
        </DisclosureSection>
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

      {false && relatedXdfTables.length > 0 && (
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

function DisclosureSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <details className="mt-3 border border-zinc-800 bg-zinc-950">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
        {title}
      </summary>
      <div className="border-t border-zinc-800 p-3">{children}</div>
    </details>
  );
}

function CalibrationInspectionRecords({
  records,
}: {
  records: readonly CalibrationInspectionRecord[];
}) {
  return (
    <DisclosureSection title="Related Calibration Tables">
      <div className="space-y-4">
        {records.map((record, index) => (
          <article
            className="border border-zinc-800 bg-zinc-900 p-4"
            key={`${record.tableName}-${record.supports}-${index}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Table Identity
                </p>
                <h4 className="mt-1 font-semibold text-zinc-100">
                  {record.tableName}
                </h4>
                <dl className="mt-2 grid gap-1 text-xs text-zinc-400">
                  <div>
                    <dt className="inline text-zinc-500">Exact identifier: </dt>
                    <dd className="inline font-mono">
                      {record.exactIdentifier ?? "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-zinc-500">Subsystem: </dt>
                    <dd className="inline">
                      {record.subsystem ?? "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-zinc-500">Source basis: </dt>
                    <dd className="inline">{record.sourceBasis}</dd>
                  </div>
                </dl>
              </div>
              <StatusBadge
                label={`${record.authorityState} authority`}
                tone={
                  record.authorityState === "confirmed"
                    ? "good"
                    : record.authorityState === "unavailable"
                      ? "warn"
                      : "info"
                }
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-zinc-300">
                  Why This Table Is Relevant
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {record.relevance}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-300">
                  What To Inspect
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {record.inspectionFocus}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  RPM:{" "}
                  {record.rpmRange
                    ? `${Math.round(record.rpmRange[0]).toLocaleString()}–${Math.round(record.rpmRange[1]).toLocaleString()}`
                    : "Unavailable"}
                  {" · "}Load/torque region:{" "}
                  {record.loadRegion ?? "Unavailable"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Axes:{" "}
                  {record.axes.length > 0
                    ? record.axes.join(", ")
                    : "Not supplied by the current XDF evidence"}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-zinc-800 pt-3">
              <p className="text-xs font-semibold text-zinc-300">
                Evidence Linkage
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {record.eventId
                  ? `Event ${record.eventId}`
                  : "Event identifier unavailable"}
                {" · "}Supports {record.supports}
                {record.confidence === null
                  ? ""
                  : ` · ${record.confidence}% supplied cause confidence`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Supporting channels:{" "}
                {record.supportingChannels.length > 0
                  ? record.supportingChannels
                      .map(humanizeEngineeringIdentifier)
                      .join(", ")
                  : "Unavailable"}
              </p>
              {record.measuredValues.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-400">
                    Relevant measured event values
                  </summary>
                  <dl className="mt-2 grid gap-1 font-mono text-[11px] text-zinc-500 sm:grid-cols-2">
                    {record.measuredValues.map((measurement) => (
                      <div key={measurement.label}>
                        <dt className="inline">{measurement.label}: </dt>
                        <dd className="inline text-zinc-300">
                          {measurement.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </div>

            <p className="mt-4 border-l-2 border-amber-400/70 pl-3 text-xs leading-5 text-amber-100">
              {record.limitation}
            </p>

            <div className="mt-4">
              <button
                aria-describedby={`xdf-handoff-${index}`}
                className="cursor-not-allowed border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-500"
                disabled
                type="button"
              >
                Open in XDF Comparison
              </button>
              <p
                className="mt-2 text-xs text-zinc-500"
                id={`xdf-handoff-${index}`}
              >
                {record.comparisonHandoff.unavailableReason}
              </p>
            </div>
          </article>
        ))}
      </div>
    </DisclosureSection>
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
