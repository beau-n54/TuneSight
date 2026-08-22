import { defineChannelDefinition, type ChannelDefinition } from "./nativeVehicleData.ts";

export type PressureUnit = "kPa" | "bar" | "psi";
export type PressureSemantic = "charge_pressure_actual_absolute" | "charge_pressure_target_absolute" | "ambient_pressure_absolute" | "boost_pressure_relative";
export type PressureChannelDefinition = Readonly<{ semantic: PressureSemantic; canonicalUnit: "kPa"; channel: ChannelDefinition }>;

export function convertPressure(value: number, from: PressureUnit, to: PressureUnit): number {
  if (!Number.isFinite(value)) throw new Error("Pressure value must be finite.");
  const kPa = from === "kPa" ? value : from === "bar" ? value * 100 : value * 6.894757293168361;
  return to === "kPa" ? kPa : to === "bar" ? kPa / 100 : kPa / 6.894757293168361;
}

export function defineSyntheticPressureChannel(input: { semantic: PressureSemantic; channelKey: string; requestId: string; dmeFamilies: readonly string[]; supported: boolean }): PressureChannelDefinition {
  const channel = defineChannelDefinition({ channelKey: input.channelKey, sourceEndpointId: "dme-primary", protocol: "synthetic-bmw-diagnostic-v1", serviceId: "qualified_synthetic_read", requestId: input.requestId, rawDataType: "uint16", decoding: { kind: "linear", scale: 0.1, offset: 0, qualification: "qualified" }, unit: "kPa", applicability: { state: input.supported ? "qualified" : "unsupported", dmeFamilies: input.supported ? input.dmeFamilies : [] }, expectedRateHz: input.supported ? { minimum: 5, maximum: 50 } : null, provenance: `synthetic-only ${input.semantic}; no BMW request authority` });
  return Object.freeze({ semantic: input.semantic, canonicalUnit: "kPa", channel });
}
