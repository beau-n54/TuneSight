export type AnalysisWarningSeverity =
  | "info"
  | "warning"
  | "critical";

export type AnalysisWarning = {
  id: string;
  title: string;
  message: string;
  severity: AnalysisWarningSeverity;
  category:
    | "boost"
    | "fuel"
    | "ignition"
    | "temperature"
    | "airflow"
    | "tune"
    | "log"
    | "general";
};