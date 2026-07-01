import type { AnalysisPipelineResult } from "./analysisPipeline";
import type { AnalysisWarning } from "./analysisWarning";

export function buildWarnings(
  pipelineResult: AnalysisPipelineResult
): AnalysisWarning[] {
  const warnings: AnalysisWarning[] = [];

  if (pipelineResult.boost.status === "fail") {
    warnings.push({
      id: "boost-fail",
      title: "Boost Control Issue",
      message: pipelineResult.boost.message,
      severity: "critical",
      category: "boost",
    });
  }

  if (pipelineResult.boost.status === "warning") {
    warnings.push({
      id: "boost-warning",
      title: "Boost Behavior Warning",
      message: pipelineResult.boost.message,
      severity: "warning",
      category: "boost",
    });
  }

  if (pipelineResult.fuel.status === "fail") {
    warnings.push({
      id: "fuel-fail",
      title: "Fuel System Issue",
      message: pipelineResult.fuel.message,
      severity: "critical",
      category: "fuel",
    });
  }

  if (pipelineResult.fuel.status === "warning") {
    warnings.push({
      id: "fuel-warning",
      title: "Fuel System Warning",
      message: pipelineResult.fuel.message,
      severity: "warning",
      category: "fuel",
    });
  }

  return warnings;
}