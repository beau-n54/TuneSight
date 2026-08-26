"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { buildCalibrationSurfaceMesh, moveSelectedCell, type CalibrationVisualState, type CalibrationVisualizationModel } from "@/lib/calibration-workshop/visualizationModel";
import type { WorkshopDefinitionDetail } from "@/lib/calibration-workshop/viewModel";

type Projected = { cellIndex: number; x: number; y: number; depth: number; height: number; changed: boolean; row: number; column: number };

export default function CalibrationSurface3D({ model, detail, state, selectedCell, onSelect }: {
  model: CalibrationVisualizationModel;
  detail: WorkshopDefinitionDetail;
  state: CalibrationVisualState;
  selectedCell: number;
  onSelect: (index: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(-0.65);
  const [tilt, setTilt] = useState(0.72);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const projectedRef = useRef<Projected[]>([]);
  const values = useMemo(() => model.surface.map((point) => state === "reference" ? point.referenceValue : point.currentValue), [model, state]);
  const mesh = useMemo(() => buildCalibrationSurfaceMesh(model), [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const context = canvas.getContext("2d"); if (!context) return;
    context.scale(dpr, dpr); context.fillStyle = "#03060a"; context.fillRect(0, 0, rect.width, rect.height);
    const minimum = Math.min(...values), maximum = Math.max(...values), range = maximum - minimum || 1;
    const cos = Math.cos(rotation), sin = Math.sin(rotation), centerX = rect.width / 2, centerY = rect.height * 0.55;
    const scale = Math.min(rect.width / Math.max(detail.columns, 2), rect.height / Math.max(detail.rows, 2)) * 0.72 * zoom;
    const numericX = model.columnAxis.values.every((value) => typeof value === "number" && Number.isFinite(value));
    const numericY = model.rowAxis.values.every((value) => typeof value === "number" && Number.isFinite(value));
    const xValues = numericX ? model.columnAxis.values as readonly number[] : model.columnAxis.values.map((_, index) => index);
    const yValues = numericY ? model.rowAxis.values as readonly number[] : model.rowAxis.values.map((_, index) => index);
    const xMinimum = Math.min(...xValues), xRange = Math.max(...xValues) - xMinimum || 1;
    const yMinimum = Math.min(...yValues), yRange = Math.max(...yValues) - yMinimum || 1;
    const projected = model.surface.map((point) => {
      const gx = ((xValues[point.column]! - xMinimum) / xRange - .5) * Math.max(detail.columns - 1, 1);
      const gy = ((yValues[point.row]! - yMinimum) / yRange - .5) * Math.max(detail.rows - 1, 1);
      const rx = gx * cos - gy * sin, depth = gx * sin + gy * cos;
      const value = state === "reference" ? point.referenceValue : point.currentValue;
      const height = (value - minimum) / range;
      const elevation = height * Math.min(rect.height * 0.38, 190);
      return { cellIndex: point.cellIndex, x: centerX + rx * scale, y: centerY + depth * scale * Math.sin(tilt) - elevation * Math.cos(tilt), depth, height, changed: point.changed, row: point.row, column: point.column };
    });
    projectedRef.current = projected;
    const byCell = new Map(projected.map((point) => [point.cellIndex, point]));
    if (mesh.available) {
      const faces = mesh.triangles.map((triangle) => ({ triangle, points: triangle.cellIndices.map((index) => byCell.get(index)!), depth: triangle.cellIndices.reduce((sum, index) => sum + byCell.get(index)!.depth, 0) / 3 })).sort((a, b) => a.depth - b.depth);
      for (const face of faces) {
        const averageHeight = face.points.reduce((sum, point) => sum + point.height, 0) / 3;
        const lightness = state === "reference" ? 24 + averageHeight * 13 : 22 + averageHeight * 15;
        context.beginPath(); context.moveTo(face.points[0]!.x, face.points[0]!.y); context.lineTo(face.points[1]!.x, face.points[1]!.y); context.lineTo(face.points[2]!.x, face.points[2]!.y); context.closePath();
        context.fillStyle = state === "reference" ? `hsl(220 7% ${lightness}%)` : `hsl(205 42% ${lightness}%)`; context.fill();
      }
    }
    context.lineWidth = 1;
    for (const point of projected) for (const nextIndex of [point.cellIndex + 1, point.cellIndex + detail.columns]) {
      const next = byCell.get(nextIndex); if (!next || (nextIndex === point.cellIndex + 1 && next.row !== point.row)) continue;
      context.strokeStyle = state === "reference" ? "rgba(161,161,170,.62)" : "rgba(56,189,248,.72)";
      context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(next.x, next.y); context.stroke();
    }
    for (const point of projected) {
      context.beginPath(); context.arc(point.x, point.y, point.cellIndex === selectedCell ? 6 : point.changed ? 4 : 2.5, 0, Math.PI * 2);
      context.fillStyle = point.cellIndex === selectedCell ? "#f8fafc" : point.changed ? "#fbbf24" : state === "reference" ? "#a1a1aa" : "#38bdf8"; context.fill();
    }
    context.fillStyle = "#a1a1aa"; context.font = "12px ui-monospace, monospace";
    context.fillText(`${model.columnAxis.id}${model.columnAxis.units ? ` (${model.columnAxis.units})` : ""}`, 16, rect.height - 18);
    context.fillText(`${model.rowAxis.id}${model.rowAxis.units ? ` (${model.rowAxis.units})` : ""}`, 16, 24);
    context.fillText(`Z — value${model.valueUnits ? ` (${model.valueUnits})` : ""}`, Math.max(16, rect.width - 220), 24);
    if (!mesh.available) { context.fillStyle = "#fbbf24"; context.fillText(`Wireframe fallback: ${mesh.reason}`, 16, rect.height - 42); }
  }, [model, detail, state, selectedCell, values, mesh, rotation, tilt, zoom]);

  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => { drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => { if (!drag.current) return; const dx = event.clientX-drag.current.x, dy=event.clientY-drag.current.y; drag.current={x:event.clientX,y:event.clientY}; setRotation((value)=>value+dx*0.008); setTilt((value)=>Math.max(0.25,Math.min(1.25,value+dy*0.006))); };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => { const start = drag.current; drag.current = null; if (!start || Math.hypot(event.clientX-start.x,event.clientY-start.y)>8) return; const rect=event.currentTarget.getBoundingClientRect(); const x=event.clientX-rect.left,y=event.clientY-rect.top; const nearest=[...projectedRef.current].sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]; if(nearest&&Math.hypot(nearest.x-x,nearest.y-y)<24)onSelect(nearest.cellIndex); };
  const keyDown = (event: KeyboardEvent<HTMLCanvasElement>) => { const movement: Record<string,[number,number]>={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}; const delta=movement[event.key]; if(delta){event.preventDefault();onSelect(moveSelectedCell(detail,selectedCell,...delta));} };
  const wheel = (event: WheelEvent<HTMLCanvasElement>) => { event.preventDefault(); setZoom((value)=>Math.max(.65,Math.min(1.8,value-event.deltaY*.001))); };

  return <div><canvas ref={canvasRef} className="h-[520px] w-full touch-none rounded-xl border border-zinc-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-blue-400" tabIndex={0} aria-label={`Interactive ${state} Calibration surface. Arrow keys select cells; drag rotates; wheel zooms.`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onKeyDown={keyDown} onWheel={wheel}/><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500"><span>Drag to rotate · wheel to zoom · arrows to select · neutral shading represents numerical height only</span><button type="button" className="rounded border border-zinc-700 px-3 py-1 text-zinc-300" onClick={()=>{setRotation(-.65);setTilt(.72);setZoom(1);}}>Reset view</button></div></div>;
}
