import type {AnalysisCalibrationResolution} from "@/lib/analysis/analysisCalibrationContext";
import type {AnalysisSource} from "@/lib/analysis/analysisSource";
import type {DiagnosticCheck} from "@/lib/analysis/diagnosticCheckAvailability";
import {sourceEvidenceScoring} from "@/lib/analysis/sourceEvidenceScoring";
import {sourceInspectionCrossReferences} from "@/lib/analysis/sourceInspectionCrossReferences";
import {sourceInvestigation} from "@/lib/analysis/sourceInvestigation";
import {analysisEvidenceSections} from "@/lib/analysis/analysisEvidenceSections";
import {CalibrationEvidenceSections} from "./EvidenceSections";
import {SourceInspectionDetails} from "./SourceInspectionDetails";
import {TuneEvidenceContext} from "./TuneEvidenceContext";
import type {TuneByteEvidence} from "@/lib/analysis/analysisTuneEvidence";

export async function DeferredTuneEvidence({pending}: {pending: Promise<TuneByteEvidence | null>}) {
  return <TuneEvidenceContext bytes={await pending}/>;
}

export function CalibrationLoading() {
  return <p role="status" className="bmw-border rounded-xl bg-slate-950 p-4 text-blue-200">Loading supplementary Calibration evidence. Telemetry and findings remain usable. Table bindings have not yet been evaluated.</p>;
}

/** A request-local promise shared by both evidence surfaces; never a user-data cache. */
export async function DeferredCalibrationEvidence({pending, source, diagnosticChannels, diagnosticChecks, diagnosticFinding, logId, vehicleId}: {
  pending: Promise<AnalysisCalibrationResolution>; source: AnalysisSource | null;
  diagnosticChannels: readonly string[]; diagnosticChecks: readonly DiagnosticCheck[]; diagnosticFinding: string;
  logId: string | null; vehicleId: string;
}) {
  return <CalibrationEvidenceSections resolution={await pending} source={source} diagnosticChannels={diagnosticChannels}
    diagnosticChecks={diagnosticChecks} diagnosticFinding={diagnosticFinding} logId={logId} vehicleId={vehicleId}/>;
}

export async function DeferredInspectionDetails({pending, source}: {pending: Promise<AnalysisCalibrationResolution>; source: AnalysisSource | null}) {
  const resolution = await pending;
  const model = sourceInspectionCrossReferences(sourceEvidenceScoring(source, sourceInvestigation(source)), resolution,
    analysisEvidenceSections(source).ranges.map(range => range.channel));
  return <><p>{resolution.identity ? `${model.mapCount} maps` : "Calibration map lookup not completed; source evidence scores remain independent."}</p><SourceInspectionDetails model={model}/></>;
}
