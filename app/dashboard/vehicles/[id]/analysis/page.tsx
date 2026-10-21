import { requireSubscriberPage } from "@/lib/security/subscriberAccess.server";
import IdentityOwnerSummary from "@/components/IdentityOwnerSummary";
import Link from "next/link";
import SourceMeasurements from "./SourceMeasurements";
import { SourceWarningSections, FactualInvestigation, CalibrationEvidenceSections } from "./EvidenceSections";
import { sourceInvestigation } from "@/lib/analysis/sourceInvestigation";
import {sourceEvidenceScoring} from "@/lib/analysis/sourceEvidenceScoring";
import {sourceInspectionCrossReferences} from "@/lib/analysis/sourceInspectionCrossReferences";
import {SourceInspectionDetails, EvidenceDisclosure} from "./SourceInspectionDetails";
import { readAnalysisTuneEvidence } from "@/lib/analysis/analysisTuneEvidence.server";
import { TuneEvidenceContext } from "./TuneEvidenceContext";
import { analysisEvidenceSections } from "@/lib/analysis/analysisEvidenceSections";
import { resolveAnalysisCalibration } from "@/lib/analysis/analysisCalibrationContext";
import { readAnalysisCalibration } from "@/lib/analysis/analysisCalibrationContext.server";
import { recoverAnalysisWorkspace } from "@/lib/analysis/analysisWorkspace";
import { sourceObservationEvents } from "@/lib/analysis/sourceObservationEvents";
import { ObservationPrimary, ObservationChecks, ObservationWarnings } from "./SourceObservationSections";
import { selectMeasurementSource } from "@/lib/analysis/analysisSource";
import { selectAnalysisEvidence, type OwnedLog, type OwnedResult } from "@/lib/analysis/analysisCapabilities";
import { readAnalysisSource } from "@/lib/analysis/analysisSource.server";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadEvidenceReloadWithProvenance } from "@/lib/analysis/evidenceProvenance";
import type { AnalysisWarning } from "@/lib/analysis/core/analysisWarning";
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
  searchParams: Promise<{log?: string; reprocess?: string}>;
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
  inputQualification?: { contract?: string; platform?: string; missingChannels?: readonly string[] };
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

export default async function AnalysisPage({ params, searchParams }: PageProps) {
  await requireSubscriberPage();
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

  const query = await searchParams;
  const ownedLogs: OwnedLog[] = [];
  let historyUnavailable = false;
  // Page through owned history so an older qualified authority is not hidden by a fixed recent-log limit.
  for (let offset = 0; ; offset += 100) {
    const {data, error} = await supabase.from("logs").select("*").eq("vehicle_id", vehicle.id).eq("user_id", user.id)
      .order("created_at", {ascending: false}).order("id").range(offset, offset + 99);
    if (error) { historyUnavailable = true; break; }
    ownedLogs.push(...(data ?? []));
    if (!data || data.length < 100) break;
  }
  const candidateResults: OwnedResult[] = [];
  const authorityIds = ownedLogs.flatMap(log => log.authoritative_log_summary_id ? [log.authoritative_log_summary_id] : []);
  for (let offset = 0; offset < authorityIds.length; offset += 100) {
    const {data} = await supabase.from("log_summaries").select("*").eq("vehicle_id", vehicle.id).eq("user_id", user.id)
      .in("id", authorityIds.slice(offset, offset + 100));
    candidateResults.push(...(data ?? []));
  }
  const vehicleContext = {vehicleId: vehicle.id, engineCode: vehicle.engine_code};
  const selection = await selectAnalysisEvidence(ownedLogs, candidateResults, user.id, vehicleContext, query.log);
  const measurementSelection = selection.result ? null : await selectMeasurementSource(ownedLogs, user.id, vehicle.id,
    log => readAnalysisSource(log, user.id, vehicle.id), query.log);
  const latestLog = selection.result ? selection.log : measurementSelection?.log ?? selection.log;
  const source = measurementSelection?.source ?? (latestLog ? await readAnalysisSource(latestLog, user.id, vehicle.id) : null);
  const recovered = recoverAnalysisWorkspace({log: latestLog, owner: user.id, vehicle: vehicleContext, source});
  const factualEvidence = analysisEvidenceSections(source);
  const observations = sourceObservationEvents(source);
  const investigation = sourceInvestigation(source);
  const calibrationEvidence = resolveAnalysisCalibration(
    await readAnalysisCalibration(latestLog, user.id, vehicle.id), latestLog, user.id, vehicle.id,
    factualEvidence.ranges.map(range => range.channel));
  const sourceCrossReferences = sourceInspectionCrossReferences(sourceEvidenceScoring(source, investigation), calibrationEvidence,
    factualEvidence.ranges.map(range => range.channel));
  const diagnosticsAvailable = (Boolean(selection.result) && query.reprocess !== "1") || recovered.diagnostics;
  const sourcePanel = <SourceMeasurements vehicleId={vehicle.id} vehicle={vehicleContext} logs={ownedLogs} selected={latestLog} source={source}
    diagnostics={diagnosticsAvailable} historyUnavailable={historyUnavailable} priorResultId={selection.result?.id ?? latestLog?.authoritative_log_summary_id ?? null}/>;

  const { data: latestTune } = await supabase
    .from("tunes")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestTuneProfile: TuneProfileRow | null = null;
  const tuneByteEvidence = await readAnalysisTuneEvidence(user.id, vehicle.id, latestTune?.id ?? null);

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
    const captured = ownedLogs.find(log => log.id === logId);
    if (captured) return captured;
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
    const captured = candidateResults.find(result => result.id === summaryId);
    if (captured) return captured;
    const { data } = await supabase
      .from("log_summaries")
      .select("*")
      .eq("id", summaryId)
      .maybeSingle();
    return data;
  }

  const evidenceReloadState = latestLog?.id
    ? await loadEvidenceReloadWithProvenance(
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

  const storedSummary =
    evidenceReloadState?.currentAuthority.state === "available"
      ? (evidenceReloadState.currentAuthority.summary as Awaited<
          ReturnType<typeof loadExactSummary>
        >)
      : null;

  // Historical rows are immutable lineage, not current diagnostic authority.
  const latestSummary = selection.result && query.reprocess !== "1" ? storedSummary : recovered.summaryRow;

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
    return diagnosticsAvailable && summary && getEngineV2(summary)?.inputQualification?.contract === "qualified-source-v1" && getEngineV2(summary)?.inputQualification?.platform === "n54" ? [summary] : [];
  });

  const effectiveTuneProfile = latestTuneProfile;

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
  const displayPullWindows = diagnosticsAvailable ? engineV2?.pullWindows ?? [] : investigation.windows.filter(w => w.loadedAcceleration).map(w => ({
    id: `source-acceleration-${w.startRow}`, startIndex: w.startRow, endIndex: w.endRow,
    rpmStart: w.rpmStart, rpmEnd: w.rpmEnd, durationSec: w.endSeconds - w.startSeconds,
    issues: [investigation.windowCriteria],
  }));
  const displayEvents = diagnosticsAvailable ? engineV2?.events ?? [] : observations.events.map(e => ({
    id: e.id, type: e.title, startIndex: e.startRow, endIndex: e.endRow, supportingChannels: e.channels,
  }));
  const fallbackFlags: AnalysisFlag[] = [{title: "Analysis availability", message: recovered.finding, tone: "info"}];

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



  const renderedVerdictFlags = engineV2?.quickVerdict
    ? buildVerdictFlagsFromEngine(engineV2.quickVerdict)
    : [{title: "Source-derived engineering summary", message: observations.summary, tone: "info" as const}, ...fallbackFlags];

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

const xdfCrossReferences = Array.isArray(engineV2?.xdfCrossReferences) ? engineV2.xdfCrossReferences : [];
const tuneProfile = effectiveTuneProfile;

const tuneReasoningFlags: AnalysisFlag[] = (engineV2?.warnings ?? []).map(mapLegacyWarningToFlag);

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
    <main className="min-h-screen space-y-6 bg-black px-4 py-6 text-white sm:px-6 sm:py-10">
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
              <IdentityOwnerSummary vehicle={vehicle}/>
              <p className="mt-2 text-xs text-zinc-500">Analysis platform context is owner-declared; qualified source and rule contracts remain required. It is not an observed controller identity.</p>
              <p className="mt-2 text-zinc-400">
                {latestSummary === recovered.summaryRow ? "Read-only view of the selected original source; stored results remain unchanged." : "Qualified stored analysis for the selected log."}
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
                    : investigation.pullState === "observed" ? "Acceleration window observed" : investigation.pullState === "blocked" ? "Pull: inputs unqualified" : "No qualifying pull"
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

        {sourcePanel}
        <TuneEvidenceContext bytes={tuneByteEvidence}/>
        <p role="status" className="text-sm text-zinc-300">{query.reprocess === "1" ? "Read-only processing: " : ""}{latestSummary === recovered.summaryRow ? recovered.finding : "Qualified stored result selected."}</p>
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
            <div className="space-y-4">
              {scopedPrimaryResults.length > 0 && <PrimaryEngineeringResults results={scopedPrimaryResults} />}
              <ObservationPrimary analysis={observations}/>
            </div>
          }
          telemetry={
            <TelemetryGraphV1
              events={displayEvents}
              pullWindows={displayPullWindows}
              telemetry={latestSummary === recovered.summaryRow ? recovered.telemetry : engineV2?.telemetry ?? recovered.telemetry}
            />
          }
          evidence={
            <EngineeringCorrelationSurface result={correlationResult} />
          }
          investigation={
            <FactualInvestigation facts={factualEvidence} diagnostics={diagnosticsAvailable} references={engineCrossReferences.length} investigation={investigation}/>
          }
          calibrationContext={
            <CalibrationEvidenceSections resolution={calibrationEvidence} source={source}
              diagnosticChannels={diagnosticsAvailable ? (engineV2?.events ?? []).filter(event => engineCrossReferences.some(r => r.eventId === event.id)).flatMap(event => event.supportingChannels ?? []) : []}
              logId={latestLog?.id ?? null} vehicleId={id}/>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <InfoCard
            title="Selected Log"
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
                  title="File-profile platform candidate"
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
          <p className="text-sm text-zinc-300">Logged actual-versus-target observations are evaluated independently below. Exact admitted Calibration inspection targets are shown in Related XDF. Neither the latest tune nor the current Calibration is assumed to have produced this log; tune-specific cause and suitability require an explicit source association.</p>

          {latestTune && tuneReasoningFlags.length === 0 && (
            <p className="text-zinc-400">
              No qualified tune-specific signals are available. The latest uploaded tune is not assumed to have produced the selected log.
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
            title="Peak Target − Peak Boost (not time-aligned error)"
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

          <p className="mb-3 text-sm text-zinc-400">Supplied cylinder channels only. Missing channels do not establish the installed cylinder count.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {factualEvidence.timing.map(channel => <AnalysisCard key={channel.channel}
              title={`Cylinder ${channel.channel.split("_").at(-1)}`}
              value={`${formatValue(channel.minimum, 1)} ${channel.unit}`}/>)}
            {!factualEvidence.timing.length && <p>No unambiguous timing-correction channels with qualified angle units were supplied.</p>}
          </div>
        </div>

        <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Intelligent Warnings</h2>
            <StatusBadge
              label={diagnosticsAvailable ? intelligentWarningsSummary.state.toUpperCase() : factualEvidence.ranges.length ? "FACTUAL EVIDENCE" : "UNAVAILABLE"}
              tone={
                !diagnosticsAvailable ? "info" : intelligentWarningsSummary.state === "warning"
                  ? "bad"
                  : intelligentWarningsSummary.state === "caution"
                    ? "warn"
                    : "good"
              }
            />
          </div>

          <SourceWarningSections facts={factualEvidence} diagnostics={diagnosticsAvailable}/>

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

         {(
  <>
    {diagnosticsAvailable && <IntelligentWarningsSummaryCard summary={intelligentWarningsSummary}/>}
    <ObservationWarnings analysis={observations}/>
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
        <p className="text-zinc-400">No platform-qualified fault event is established. Source-derived event intervals and their individual limits follow.</p>
      )}
      <ObservationChecks analysis={observations}/>
    </div>
  </>
)}

        {(
          <div className="bmw-border rounded-2xl bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Cross-Reference Details</h2>
              <StatusBadge
                label={`${sourceCrossReferences.mapCount} maps`}
                tone={sourceCrossReferences.mapCount > 0 ? "info" : "warn"}
              />
            </div>

            <SourceInspectionDetails model={sourceCrossReferences}/>
            <h3 className="mb-3 mt-6 text-lg font-semibold">Platform-qualified diagnostic cross-references — {engineCrossReferences.length} records</h3>
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
                {diagnosticsAvailable ? "No diagnostic cross-reference records were returned for the qualified available inputs." : "Diagnostic cross-reference records are unavailable under the current source/platform rule contract. Factual system observations and exact Calibration evidence are evaluated independently above."}
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
            <EvidenceDisclosure title="Evidence and Selection Logic">
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
                    <span className={factor.contribution > 0 ? "font-semibold tabular-nums text-emerald-300" : factor.contribution < 0 ? "font-semibold tabular-nums text-amber-300" : "tabular-nums text-zinc-400"}>
                      {factor.contribution > 0 ? `+${factor.contribution}` : "0"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs">
                <span className="text-zinc-400">Final Confidence</span>
                <span className="rounded-md border border-sky-700/60 bg-sky-950/60 px-2 py-1 font-semibold tabular-nums text-cyan-200">
                  {rootCause.confidence}%
                </span>
              </div>
            </EvidenceDisclosure>
)}

{(rootCause.candidateCauses?.length ?? 0) > 0 && (
  <EvidenceDisclosure title="Diagnostic Ranking">
    <div className="mt-2 space-y-2">
      {(rootCause.candidateCauses ?? []).map(
        (candidate, candidateIndex) => (
          <div
            key={candidateIndex}
            className="border border-zinc-800 bg-zinc-950 p-3 text-xs"
          >
      <div className="flex items-center justify-between">
        <span className="text-zinc-400">
          <span className="mr-2 inline-flex rounded-md border border-blue-700/70 bg-blue-950 px-2 py-1 font-semibold text-blue-200">#{candidateIndex + 1}</span>{" "}{candidate.cause}
        </span>

        <div className="text-right">
      <div className="rounded-md border border-sky-700/60 bg-sky-950/60 px-2 py-1 font-semibold tabular-nums text-cyan-200">
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
                    ? "text-amber-300"
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
  </EvidenceDisclosure>
)}

          {(rootCause.evidence?.length ?? 0) > 0 && (
            <EvidenceDisclosure title="Supplied Evidence">
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
            </EvidenceDisclosure>
          )}

          {(rootCause.rejectedCauses?.length ?? 0) > 0 && (
            <EvidenceDisclosure title="Rejected and Alternative Causes">
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
            </EvidenceDisclosure>
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
        <EvidenceDisclosure title="Event Context and Notes">
          <div className="mt-2 space-y-1">
            {eventSpecificNotes.map((note, index) => (
              <p key={index} className="text-sm text-zinc-300">
                • {note}
              </p>
            ))}
          </div>
        </EvidenceDisclosure>
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
    <EvidenceDisclosure title="Related Calibration Tables">
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
                <EvidenceDisclosure title="Relevant measured event values">
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
                </EvidenceDisclosure>
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
    </EvidenceDisclosure>
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
