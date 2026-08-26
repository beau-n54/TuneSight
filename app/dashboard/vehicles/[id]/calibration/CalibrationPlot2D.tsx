"use client";

import { useMemo } from "react";
import { buildCalibrationSlice, type CalibrationVisualizationModel, type SliceDirection } from "@/lib/calibration-workshop/visualizationModel";

export default function CalibrationPlot2D({ model, direction, sliceIndex, onSelect }: {
  model: CalibrationVisualizationModel;
  direction: SliceDirection;
  sliceIndex: number;
  onSelect: (cellIndex: number) => void;
}) {
  const points = useMemo(() => buildCalibrationSlice(model, direction, sliceIndex), [model, direction, sliceIndex]);
  const values = points.flatMap((point) => [point.referenceValue, point.currentValue]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const width = 900, height = 430, left = 64, right = 28, top = 28, bottom = 58;
  const x = (index: number) => left + (points.length <= 1 ? 0.5 : index / (points.length - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - minimum) / range) * (height - top - bottom);
  const path = (pick: "referenceValue" | "currentValue") => points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point[pick])}`).join(" ");
  const axis = direction === "row" ? model.columnAxis : model.rowAxis;

  return (
    <div className="overflow-x-auto" aria-label="Linked 2D Calibration view">
      <svg className="min-w-[760px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Reference and Current Calibration values by ${axis.id}`}>
        <rect width={width} height={height} fill="#05070b" />
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1={left} x2={width-right} y1={top+ratio*(height-top-bottom)} y2={top+ratio*(height-top-bottom)} stroke="#27272a" />)}
        <path d={path("referenceValue")} fill="none" stroke="#a1a1aa" strokeWidth="2" />
        <path d={path("currentValue")} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
        {points.map((point, index) => <g key={point.cellIndex} onClick={() => onSelect(point.cellIndex)} className="cursor-pointer" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(point.cellIndex); }}>
          <circle cx={x(index)} cy={y(point.referenceValue)} r="4" fill="#a1a1aa" />
          <circle cx={x(index)} cy={y(point.currentValue)} r={point.changed ? 6 : 4} fill="#38bdf8" stroke={point.changed ? "#fbbf24" : "none"} strokeWidth="2" />
          {point.changed && <title>Changed cell R{point.row} C{point.column}</title>}
        </g>)}
        <text x={left} y={18} fill="#a1a1aa" fontSize="12">Values {model.valueUnits ? `(${model.valueUnits})` : "(units not supplied)"}</text>
        <text x={width/2} y={height-12} textAnchor="middle" fill="#a1a1aa" fontSize="12">{axis.id}{axis.units ? ` (${axis.units})` : ""}</text>
        <g transform={`translate(${width-260},18)`}><line x1="0" x2="28" stroke="#a1a1aa" strokeWidth="2"/><text x="36" y="4" fill="#d4d4d8" fontSize="11">Reference</text><line x1="112" x2="140" stroke="#38bdf8" strokeWidth="2"/><text x="148" y="4" fill="#bae6fd" fontSize="11">Current</text></g>
      </svg>
    </div>
  );
}
