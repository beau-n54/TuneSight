"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterWorkshopDefinitions, type WorkshopFilter, type WorkshopViewModel } from "@/lib/calibration-workshop/viewModel";

const FILTERS: readonly { id: WorkshopFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "changed", label: "Changed" },
  { id: "unchanged", label: "Unchanged" }, { id: "unavailable", label: "Unavailable" },
  { id: "axis_changed", label: "Axis Changed" }, { id: "value_and_axis_changed", label: "Value + Axis" },
  { id: "conflict", label: "Conflict" },
];

function prettyOutcome(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : Number(value.toPrecision(7)).toLocaleString();
}

export default function WorkshopClient({ workshop, vehicleId }: { workshop: WorkshopViewModel; vehicleId: string }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WorkshopFilter>("all");
  const [selectedCell, setSelectedCell] = useState(0);
  const definitions = useMemo(() => filterWorkshopDefinitions(workshop.definitions, search, filter), [workshop.definitions, search, filter]);
  const detail = workshop.selectedDefinition;
  const cell = detail.cells[selectedCell] ?? detail.cells[0] ?? null;
  const columnAxis = detail.axes.find((axis) => axis.values.length === detail.columns);
  const rowAxis = detail.axes.find((axis) => axis.values.length === detail.rows && axis !== columnAxis);

  return (
    <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 xl:max-h-[900px]">
        <div className="flex items-center justify-between">
          <div><p className="text-xs uppercase tracking-[0.16em] text-blue-300">Calibration Explorer</p><h2 className="mt-1 text-xl font-semibold">All Maps</h2></div>
          <span className="text-xs text-zinc-500">{definitions.length}/{workshop.definitions.length}</span>
        </div>
        <label className="mt-4 block text-xs text-zinc-500" htmlFor="definition-search">Literal search</label>
        <input id="definition-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, identity, revision, units…" className="mt-2 w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-blue-400" />
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full border px-2.5 py-1 text-xs ${filter === item.id ? "border-blue-400 bg-blue-400/15 text-blue-200" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}>{item.label}</button>)}
        </div>
        <div className="mt-4 max-h-[650px] space-y-2 overflow-y-auto pr-1">
          {definitions.map((definition) => (
            <Link key={definition.key} href={`/dashboard/vehicles/${vehicleId}/calibration?definition=${encodeURIComponent(definition.key)}`} scroll={false} className={`block rounded-xl border p-3 transition ${definition.key === detail.summary.key ? "border-blue-400/60 bg-blue-400/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}>
              <p className="truncate text-sm font-medium text-zinc-100">{definition.title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-400">
                <span className="rounded bg-black px-1.5 py-0.5">{definition.shape}</span>
                {definition.units && <span className="rounded bg-black px-1.5 py-0.5">{definition.units}</span>}
                <span className={definition.available ? "text-zinc-400" : "text-amber-300"}>{prettyOutcome(definition.outcome)}</span>
                {definition.changedCellCount > 0 && <span className="text-blue-300">{definition.changedCellCount} changed</span>}
              </div>
            </Link>
          ))}
          {definitions.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No Definitions match this literal search and Evidence filter.</p>}
        </div>
      </aside>

      <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
        <div className="flex flex-col gap-2 border-b border-zinc-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs uppercase tracking-[0.16em] text-blue-300">Read-only Grid</p><h2 className="mt-1 text-xl font-semibold">{detail.summary.title}</h2></div>
          <p className="text-xs text-zinc-500">Reference / Current Modified</p>
        </div>
        {!detail.summary.available ? (
          <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-5">
            <p className="font-semibold text-amber-200">Definition unavailable</p>
            <p className="mt-2 text-sm text-zinc-300">Stage: {detail.unavailableStage || "Unspecified"}</p>
            {detail.findings.map((finding) => <p key={finding} className="mt-2 text-sm leading-6 text-zinc-400">{finding}</p>)}
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto pb-2">
            <table className="min-w-max border-separate border-spacing-1 text-xs">
              <thead><tr><th className="sticky left-0 z-10 bg-zinc-950 p-2 text-left text-zinc-500">{rowAxis?.id || "Row"} \ {columnAxis?.id || "Column"}</th>{Array.from({ length: detail.columns }, (_, column) => <th key={`column-${column}`} className="min-w-28 p-2 font-mono font-normal text-zinc-400">{String(columnAxis?.values[column] ?? column)}{columnAxis?.units ? ` ${columnAxis.units}` : ""}</th>)}</tr></thead>
              <tbody>{Array.from({ length: detail.rows }, (_, row) => <tr key={`row-${row}`}><th className="sticky left-0 z-10 bg-zinc-950 p-2 text-left font-mono font-normal text-zinc-400">{String(rowAxis?.values[row] ?? row)}{rowAxis?.units ? ` ${rowAxis.units}` : ""}</th>{Array.from({ length: detail.columns }, (_, column) => { const index = row * detail.columns + column; const item = detail.cells[index]; const cellKey = `cell-${row}-${column}`; if (!item) return <td key={cellKey} className="border border-zinc-800 p-3 text-zinc-600">—</td>; return <td key={cellKey}><button type="button" onClick={() => setSelectedCell(index)} className={`w-full min-w-28 rounded-lg border p-2 text-left font-mono transition ${index === selectedCell ? "border-blue-300 ring-1 ring-blue-300/40" : item.changed ? "border-blue-400/35 bg-blue-400/10 hover:border-blue-300" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}><span className="block text-[10px] text-zinc-500">REF {formatValue(item.referenceValue)}</span><span className="mt-1 block text-zinc-100">CUR {formatValue(item.currentValue)}</span></button></td>; })}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-blue-300">Cell Inspector</p>
          {cell ? <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><dt className="text-zinc-500">Coordinates</dt><dd className="font-mono">R{cell.row} C{cell.column}</dd><dt className="text-zinc-500">Reference</dt><dd className="font-mono">{formatValue(cell.referenceValue)}</dd><dt className="text-zinc-500">Current</dt><dd className="font-mono">{formatValue(cell.currentValue)}</dd><dt className="text-zinc-500">Signed delta</dt><dd className="font-mono">{cell.signedDelta > 0 ? "+" : ""}{formatValue(cell.signedDelta)}</dd><dt className="text-zinc-500">Percentage</dt><dd className="font-mono">{cell.percentageDelta === null ? cell.percentageState.replaceAll("_", " ") : `${formatValue(cell.percentageDelta)}%`}</dd><dt className="text-zinc-500">Units</dt><dd>{cell.units || "Not supplied"}</dd><dt className="text-zinc-500">Raw offsets</dt><dd className="font-mono text-xs">0x{cell.referenceRawOffset.toString(16)} / 0x{cell.currentRawOffset.toString(16)}</dd></dl> : <p className="mt-3 text-sm text-zinc-500">No qualified cell is available.</p>}
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-blue-300">Definition Information</p>
          <h3 className="mt-2 font-semibold">{detail.summary.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{detail.summary.description || "No source description supplied."}</p>
          <dl className="mt-4 space-y-2 text-xs"><div><dt className="text-zinc-500">Shape</dt><dd>{detail.summary.shape} · {detail.rows} × {detail.columns}</dd></div><div><dt className="text-zinc-500">Outcome</dt><dd>{prettyOutcome(detail.summary.outcome)}</dd></div><div><dt className="text-zinc-500">ROM Layout</dt><dd className="break-all font-mono">{workshop.source.romLayoutId}</dd></div><div><dt className="text-zinc-500">Definition revision</dt><dd className="break-all font-mono">{detail.summary.definitionRevision}</dd></div><div><dt className="text-zinc-500">Source digest</dt><dd className="break-all font-mono">{detail.sourceArtifactDigest}</dd></div></dl>
          <p className="mt-4 border-l-2 border-amber-300/60 pl-3 text-xs leading-5 text-amber-100">Engineering semantic interpretation not yet bound.</p>
        </section>
        <details className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><summary className="cursor-pointer text-sm font-semibold">Provenance & limitations</summary><div className="mt-3 space-y-3 text-xs leading-5 text-zinc-400">{workshop.provenance.map((value) => <p key={value}>{value}</p>)}{workshop.limitations.map((value) => <p key={value} className="text-amber-100/80">{value}</p>)}</div></details>
      </aside>
    </section>
  );
}
