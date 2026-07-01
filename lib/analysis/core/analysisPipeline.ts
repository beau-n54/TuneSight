import type { AnalysisContext } from "./analysisContext";
import { validateBoostAgainstTune } from "../boostValidation";
import { validateFuelAgainstTune } from "../fuelValidation";

export type AnalysisPipelineResult = {
  boost: ReturnType<typeof validateBoostAgainstTune>;
  fuel: ReturnType<typeof validateFuelAgainstTune>;
};

export function runAnalysisPipeline(
  context: AnalysisContext & {
    boostIntent?: string | null;
    fuelingIntent?: string | null;
  }
): AnalysisPipelineResult {
  return {
    boost: validateBoostAgainstTune(context),
    fuel: validateFuelAgainstTune(context),
  };
}