"use client";

import { useState } from "react";
import { MiniMetricBar } from "./MiniMetricBar";

type WorkshopDiagnosticCardProps = {
  title: string;
  severity?: string;
  source?: string;
  priority?: string;
  confidence?: number;
  rpm?: number | null;
  action?: string;
  evidence?: string[];
  supportingChannels?: string[];
  metrics?: {
    label: string;
    value: string | number;
  }[];
  relatedXdfTables?: any[];
};

export function WorkshopDiagnosticCard({
  title,
  severity,
  source,
  priority,
  confidence,
  rpm,
  action,
  evidence = [],
  supportingChannels = [],
  metrics = [],
  relatedXdfTables = [],

}: WorkshopDiagnosticCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);

  const severityStyles = {
    good: "border-emerald-700/50 bg-emerald-950/20",
    warn: "border-amber-700/50 bg-amber-950/20",
    bad: "border-red-700/50 bg-red-950/20",
    info: "border-blue-700/50 bg-blue-950/20",
  };

  return (
    <div
      className={`
        rounded-xl border p-4 shadow-sm transition-all
        ${
          severity && severity in severityStyles
            ? severityStyles[severity as keyof typeof severityStyles]
            : "border-zinc-700 bg-zinc-950/70"
        }
      `}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            {severity && (
              <span className="rounded-full border border-zinc-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                {severity}
              </span>
            )}

            <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
            {priority && <span>Priority: {priority}</span>}
            {source && <span>Source: {source}</span>}
            {typeof confidence === "number" && (
              <span>Confidence: {Math.round(confidence * 100)}%</span>
            )}
            {rpm != null && <span>RPM: {rpm}</span>}
          </div>
        </div>

        <span className="text-xs text-zinc-500">
          {expanded ? "▲ Hide" : "▼ Details"}
        </span>
      </button>

      {expanded && (
        <div className="mt-4">
          {typeof confidence === "number" && (
            <div className="mb-4">
              <MiniMetricBar
                label="Confidence"
                value={Math.round(confidence * 100)}
                max={100}
              />
            </div>
          )}

          {relatedXdfTables.length > 0 && (
  <div className="mb-4">
    <p className="text-xs font-medium text-zinc-300">
      Related XDF Tables
    </p>

    <div className="mt-2 flex flex-wrap gap-2">
      {relatedXdfTables.map((xdf, index) => (
        <div
          key={index}
          className="rounded-lg border border-blue-700 bg-blue-950/30 px-3 py-2"
        >
          <div className="text-xs font-medium text-blue-300">
            {xdf.tableName || xdf.name || "Unknown Table"}
          </div>

          {(xdf.category || xdf.matchReason) && (
            <div className="mt-1 text-[10px] text-zinc-400">
              {xdf.category || xdf.matchReason}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}

          {metrics.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-zinc-300">
                Telemetry metrics
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {metrics.map((metric, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {metric.label}
                    </p>

                    <p className="text-sm font-semibold text-zinc-100">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {action && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-xs font-medium text-zinc-300">
                Recommended action
              </p>
              <p className="mt-1 text-sm text-zinc-100">{action}</p>
            </div>
          )}

          {evidence.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setEvidenceExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <p className="text-xs font-medium text-zinc-300">Evidence</p>
                <span className="text-xs text-zinc-500">
                  {evidenceExpanded ? "▲ Hide" : "▼ Show"}
                </span>
              </button>

              {evidenceExpanded && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                  {evidence.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {supportingChannels.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-300">
                Supporting channels
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {supportingChannels.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-300"
                  >
                    {channel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}