"use client";

import { useMemo, useState } from "react";
import { buildCalibrationSlice, type CalibrationVisualizationModel, type SliceDirection } from "@/lib/calibration-workshop/visualizationModel";
import type { CalibrationTerminology } from "@/lib/calibration-workshop/calibrationTerminology";
import { exactNumber } from "@/lib/calibration-workshop/sharedTablePresentation";
import { useCalibrationTerminologyScope } from "./calibration-terminology-control";
import { plotPresentationLabels, type PlotPresentation } from "@/lib/calibration-workshop/sharedWorkspacePresentationState";

export default function CalibrationPlot2D({ presentation = "reference-current", model, direction, sliceIndex, terminology, onSelect, selectedCell, view, onView }: {
  view?: Readonly<{ zoom: number; pan: number }>; onView?(view: Readonly<{ zoom: number; pan: number }>): void;
  presentation?: PlotPresentation; model: CalibrationVisualizationModel; direction: SliceDirection; sliceIndex: number;
  terminology?: CalibrationTerminology; onSelect(cellIndex: number): void; selectedCell?: number;
}) {
  const display = plotPresentationLabels(presentation);
  const scoped = useCalibrationTerminologyScope(), labels = (terminology ?? scoped)!;
  const points = useMemo(() => buildCalibrationSlice(model, direction, sliceIndex), [model, direction, sliceIndex]);
  const [localView, setLocalView] = useState({ zoom: 1, pan: 0 });
  const { zoom, pan } = view ?? localView;
  const updateView = (next: typeof localView) => { if (onView) onView(next); else setLocalView(next); };
  const setZoom = (fn: (value: number) => number) => updateView({ zoom: fn(zoom), pan });
  const setPan = (fn: (value: number) => number) => updateView({ zoom, pan: fn(pan) });
  const reference = display.reference && points.length > 0 && points.every(point => point.referenceValue !== null);
  const values = points.flatMap(point => reference && point.referenceValue !== null ? [point.referenceValue, point.currentValue] : [point.currentValue]);
  if (!points.length) return <p role="status">This slice has no qualified cells.</p>;
  const lowValue = Math.min(...values), highValue = Math.max(...values);
  const padding = lowValue === highValue ? Math.max(1, Math.abs(lowValue) * .01) : 0;
  const minimum = lowValue - padding, maximum = highValue + padding, range = maximum - minimum;
  const width = 900, height = 430, left = 72, right = 28, top = 32, bottom = 70;
  const numeric = points.every(point => typeof point.axisValue === "number" && Number.isFinite(point.axisValue));
  const coordinates = points.map((point, index) => numeric ? point.axisValue as number : index);
  const low = Math.min(...coordinates), span = Math.max(...coordinates) - low;
  const x = (index: number) => left + (span ? (coordinates[index] - low) / span : .5) * (width - left - right);
  const y = (value: number) => top + (1 - (value - minimum) / range) * (height - top - bottom);
  const path = (pick: "referenceValue" | "currentValue") => points.map((point, index) => point[pick] === null ? "" : (index ? "L" : "M") + x(index) + "," + y(point[pick]!)).join(" ");
  const axis = direction === "row" ? model.columnAxis : model.rowAxis;
  const axisTerm = direction === "row" ? labels.x : labels.y;
  const tickEvery = Math.max(1, Math.ceil(points.length / 8));
  return <div aria-label="Linked 2D Calibration view">
    <div className="mb-2 flex gap-2 text-xs"><button type="button" onClick={() => setZoom(value => Math.min(3, value + .25))}>Zoom in</button><button type="button" onClick={() => setZoom(value => Math.max(1, value - .25))}>Zoom out</button><button type="button" onClick={() => setPan(value => Math.max(0, value - 70))}>Pan left</button><button type="button" onClick={() => setPan(value => Math.min(width - width / zoom, value + 70))}>Pan right</button><button type="button" onClick={() => { updateView({ zoom: 1, pan: 0 }); }}>Reset 2D view</button></div>
    <div className="overflow-x-auto"><svg className="min-w-[760px]" viewBox={Math.min(pan, width - width / zoom) + " 0 " + width / zoom + " " + height} role="img" aria-label={display.description + " " + labels.output.label + " by " + (axisTerm?.label ?? axis.id)}>
      <rect width={width} height={height} fill="#05070b"/>
      {[0, .25, .5, .75, 1].map(ratio => <g key={ratio}><line x1={left} x2={width-right} y1={top+ratio*(height-top-bottom)} y2={top+ratio*(height-top-bottom)} stroke="#27272a"/><text x={left-8} y={top+ratio*(height-top-bottom)+4} textAnchor="end" fill="#a1a1aa" fontSize="11">{Number((maximum-ratio*range).toPrecision(6))}</text></g>)}
      {reference && <path d={path("referenceValue")} fill="none" stroke="#a1a1aa" strokeWidth="2"/>}
      <path d={path("currentValue")} fill="none" stroke="#38bdf8" strokeWidth="2.5"/>
      {points.map((point, index) => <g key={point.cellIndex} onClick={() => onSelect(point.cellIndex)} className="cursor-pointer" role="button" aria-label={"Cell row " + point.row + " column " + point.column + ": " + exactNumber(point.currentValue)} tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(point.cellIndex); } }}>
        {reference && point.referenceValue !== null && <circle cx={x(index)} cy={y(point.referenceValue)} r="4" fill="#a1a1aa"/>}
        <circle cx={x(index)} cy={y(point.currentValue)} r={selectedCell === point.cellIndex ? 7 : point.changed ? 6 : 4} fill="#38bdf8" stroke={selectedCell === point.cellIndex ? "#fff" : point.changed ? "#fbbf24" : "none"} strokeWidth="2"/>
        <title>{display.value + " " + exactNumber(point.currentValue) + " · " + String(point.axisValue) + " · R" + point.row + " C" + point.column}</title>
        {(index % tickEvery === 0 || index === points.length-1) && <text x={x(index)} y={height-bottom+20} textAnchor="middle" fill="#a1a1aa" fontSize="11">{String(point.axisValue)}</text>}
      </g>)}
      <text x={left} y={18} fill="#a1a1aa" fontSize="12">{labels.output.label}{labels.output.units ? " (" + labels.output.units + ")" : ""}</text>
      <text x={width/2} y={height-12} textAnchor="middle" fill="#a1a1aa" fontSize="12">{axisTerm?.label ?? axis.id}{axis.units ? " (" + axis.units + ")" : ""}</text>
      {reference && <text x={width-240} y={18} fill="#a1a1aa" fontSize="11">Reference</text>}
      <text x={width-140} y={18} fill="#bae6fd" fontSize="11">{display.value}</text>
    </svg></div>
    {!numeric && <p className="text-xs text-zinc-400">Categorical coordinates: ordered source samples; spacing does not imply a physical interval.</p>}
    {selectedCell !== undefined && !points.some(point => point.cellIndex === selectedCell) && <p role="status" className="text-xs text-zinc-400">The selected cell is outside this slice; selection is unchanged.</p>}
  </div>;
}
