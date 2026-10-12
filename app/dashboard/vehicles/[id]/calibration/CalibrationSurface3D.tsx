"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { buildCalibrationSurfaceMesh, moveSelectedCell, type CalibrationVisualizationModel } from "@/lib/calibration-workshop/visualizationModel";
import type { CalibrationTerminology } from "@/lib/calibration-workshop/calibrationTerminology";
import { useCalibrationTerminologyScope } from "./calibration-terminology-control";

import type { SurfacePresentation } from "@/lib/calibration-workshop/sharedWorkspacePresentationState";

type Projected = { cellIndex: number; x: number; y: number; depth: number; height: number; changed: boolean; row: number; column: number };

export default function CalibrationSurface3D({ model, detail, state, terminology, selectedCell, onSelect, camera, onCamera }: {
  camera?: Readonly<{ rotation: number; tilt: number; zoom: number }>;
  onCamera?(camera: Readonly<{ rotation: number; tilt: number; zoom: number }>): void;
  model: CalibrationVisualizationModel;
  detail: Parameters<typeof moveSelectedCell>[0];
  state: SurfacePresentation;
  terminology?: CalibrationTerminology;
  selectedCell: number;
  onSelect: (index: number) => void;
}) {
  const scopedTerminology = useCalibrationTerminologyScope(), labels = (terminology ?? scopedTerminology)!;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [localCamera, setLocalCamera] = useState({ rotation: -.65, tilt: .72, zoom: 1 });
  const view = camera ?? localCamera, { rotation, tilt, zoom } = view;
  const updateCamera = (next: typeof view) => { if (onCamera) onCamera(next); else setLocalCamera(next); };
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const projectedRef = useRef<Projected[]>([]);
  const values = useMemo(() => model.surface.map((point) => point.currentValue), [model]);
  const mesh = useMemo(() => buildCalibrationSurfaceMesh(model), [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
    if (!mesh.available || !model.columnAxis.values.every(value => typeof value === "number" && Number.isFinite(value)) || !model.rowAxis.values.every(value => typeof value === "number" && Number.isFinite(value))) { projectedRef.current = []; return; }
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const context = canvas.getContext("2d"); if (!context) return;
    context.scale(dpr, dpr); context.fillStyle = "#03060a"; context.fillRect(0, 0, rect.width, rect.height);
    const minimum = Math.min(...values), maximum = Math.max(...values), range = maximum - minimum || 1;
    const cos = Math.cos(rotation), sin = Math.sin(rotation), centerX = rect.width / 2, centerY = rect.height * 0.55;
    const scale = Math.min(rect.width / Math.max(detail.columns, 2), rect.height / Math.max(detail.rows, 2)) * 0.72 * zoom;
    const xValues = model.columnAxis.values as readonly number[], yValues = model.rowAxis.values as readonly number[];
    const xMinimum = Math.min(...xValues), xRange = Math.max(...xValues) - xMinimum || 1;
    const yMinimum = Math.min(...yValues), yRange = Math.max(...yValues) - yMinimum || 1;
    const projected = model.surface.map((point) => {
      const gx = ((xValues[point.column]! - xMinimum) / xRange - .5) * Math.max(detail.columns - 1, 1);
      const gy = ((yValues[point.row]! - yMinimum) / yRange - .5) * Math.max(detail.rows - 1, 1);
      const rx = gx * cos - gy * sin, depth = gx * sin + gy * cos;
      const value = point.currentValue;
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
    context.fillText(`${labels.x?.label ?? model.columnAxis.id}${labels.x?.units ? ` (${labels.x.units})` : ""}`, 16, rect.height - 18);
    context.fillText(`${labels.y?.label ?? model.rowAxis.id}${labels.y?.units ? ` (${labels.y.units})` : ""}`, 16, 24);
    context.fillText(`${labels.output.label}${labels.output.units ? ` (${labels.output.units})` : ""}`, Math.max(16, rect.width - 220), 24);
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [model, detail, state, labels, selectedCell, values, mesh, rotation, tilt, zoom]);

  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => { if (event.pointerType === "touch") return; drag.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => { if (!drag.current) return; const dx = event.clientX-drag.current.x, dy=event.clientY-drag.current.y; drag.current={...drag.current,x:event.clientX,y:event.clientY}; updateCamera({ ...view, rotation: Math.max(-1000, Math.min(1000, rotation + dx*.008)), tilt: Math.max(.25, Math.min(1.25, tilt + dy*.006)) }); };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => { const start = drag.current; drag.current = null; if (!start || Math.hypot(event.clientX-start.startX,event.clientY-start.startY)>8) return; const rect=event.currentTarget.getBoundingClientRect(); const x=event.clientX-rect.left,y=event.clientY-rect.top; const nearest=[...projectedRef.current].sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]; if(nearest&&Math.hypot(nearest.x-x,nearest.y-y)<24)onSelect(nearest.cellIndex); };
  const keyDown = (event: KeyboardEvent<HTMLCanvasElement>) => { const movement: Record<string,[number,number]>={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}; const delta=movement[event.key]; if(delta){event.preventDefault();onSelect(moveSelectedCell(detail,selectedCell,...delta));} };
  const wheel = (event: WheelEvent<HTMLCanvasElement>) => { if (!event.ctrlKey) return; event.preventDefault(); updateCamera({ ...view, zoom: Math.max(.65,Math.min(1.8,zoom-event.deltaY*.001)) }); };

  if (!mesh.available) return <p role="status">3D unavailable: {mesh.reason}</p>;
  return <div><canvas ref={canvasRef} className="h-[520px] w-full touch-pan-y rounded-xl border border-zinc-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-blue-400" tabIndex={0} aria-label={`Interactive ${state} Calibration surface. Arrow keys select cells; drag rotates; Control + wheel zooms; touch scrolls the page.`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onKeyDown={keyDown} onWheel={wheel}/><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500"><span>{state === "working" ? "Working" : state === "reference" ? "Reference" : "Current"} surface · Drag to rotate · Control + wheel to zoom · arrows to select · neutral shading represents numerical height only</span><button type="button" className="rounded border border-zinc-700 px-3 py-1 text-zinc-300" onClick={()=>{updateCamera({ rotation: -.65, tilt: .72, zoom: 1 });}}>Reset view</button></div></div>;
}
