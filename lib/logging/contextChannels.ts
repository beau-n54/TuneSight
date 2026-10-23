import {read} from "./helpers.ts";

/** Exact logger labels with explicit quantities. Reported pressures retain their
 * source reference/sign uncertainty and cannot become compatible target pairs. */
export const CONTEXT_ALIASES = {
  gear: ["Gear (-)", "Gear[-]"],
  throttleAngle: ["Throttle Position (°)", "Throttle Angle[°]"],
  manifoldPressureReported: ["Boost (mani) (PSI)"],
  manifoldGaugePressure: ["(RAM) Boost (MAP)[psig]"],
  manifoldGaugeTarget: ["(RAM) Boost Pressure (Manifold Target)[psig]"],
  railDeviationReported: ["Rail pressure dev. (MPa)"],
  loadActual: ["Load act. (%)", "Load actual (%)"],
  loadRequested: ["Load req. (%)"],
  clutchTorque: ["Torque act. clutch (Nm)"],
  massAirFlow: ["MAF (g/s)"],
  ...Object.fromEntries(Array.from({length:8},(_,i)=>[`ignitionCyl${i+1}`,[`Ignition Timing Cyl. ${i+1} (°)`, `(RAM) Ignition Timing Cyl. ${i+1}[°]`]])),
} as Record<string,string[]>;

export function readContextChannels(row: Record<string,unknown>) {
  const values = Object.fromEntries(Object.entries(CONTEXT_ALIASES).map(([key,aliases])=>[key,read(row,aliases)]));
  // No inferred gear, ratio or installed transmission. Zero/reverse/invalid
  // codes cannot establish a forward gear segment.
  if (!Number.isSafeInteger(values.gear) || values.gear === null || values.gear <= 0) values.gear = null;
  return values;
}

export const CONTEXT_CHANNEL_DEFINITIONS: Record<string, readonly [string,string]> = {
  gear:["gear","gear"], throttle_angle:["throttleAngle","°"],
  manifold_pressure_reported:["manifoldPressureReported","psi (reference unverified)"],
  manifold_gauge_pressure:["manifoldGaugePressure","psig"],
  manifold_gauge_target:["manifoldGaugeTarget","psig"],
  rail_deviation_reported:["railDeviationReported","MPa (sign convention unverified)"],
  load_actual:["loadActual","%"], load_requested:["loadRequested","%"],
  clutch_torque:["clutchTorque","Nm"], mass_air_flow:["massAirFlow","g/s"],
  ...Object.fromEntries(Array.from({length:8},(_,i)=>[`ignition_timing_cyl_${i+1}`,[`ignitionCyl${i+1}`,"°"] as const])),
};
