import { createHash } from "node:crypto";

export const NATIVE_VEHICLE_DATA_CONTRACT = "tunesight.native-vehicle-data.v1" as const;
export const READ_ONLY_OPERATIONS = Object.freeze(["discover", "open", "connect", "identify", "read", "stream", "disconnect"] as const);
export type ReadOnlyOperation = (typeof READ_ONLY_OPERATIONS)[number];
export type VehicleTransportKind = "web_serial" | "web_usb" | "local_companion" | "desktop_native_bridge" | "ethernet_network" | "synthetic";

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Native Vehicle Data numbers must be finite."); return JSON.stringify(Object.is(value, -0) ? 0 : value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value !== "object" || value === undefined) throw new Error("Native Vehicle Data contains an unsupported value.");
  const object = value as Readonly<Record<string, unknown>>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}
function digest(domain: string, value: unknown): string { return `sha256:${createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex")}`; }
function required(value: string, field: string): string { if (!value.trim()) throw new Error(`${field} is required.`); return value; }
function timestamp(value: string, field: string): string { required(value, field); const parsed = new Date(value); if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${field} must be canonical UTC.`); return value; }

export type PhysicalAdapter = Readonly<{ adapterId: string; adapterRevision: string; manufacturer: string; model: string; transportKinds: readonly VehicleTransportKind[]; readOnlyOperations: readonly ReadOnlyOperation[]; provenance: string }>;
export function definePhysicalAdapter(input: Omit<PhysicalAdapter, "readOnlyOperations">): PhysicalAdapter {
  if (input.transportKinds.length === 0) throw new Error("Adapter must declare a transport kind.");
  return Object.freeze({ ...input, adapterId: required(input.adapterId, "Adapter identity"), adapterRevision: required(input.adapterRevision, "Adapter revision"), manufacturer: required(input.manufacturer, "Adapter manufacturer"), model: required(input.model, "Adapter model"), provenance: required(input.provenance, "Adapter provenance"), transportKinds: Object.freeze([...new Set(input.transportKinds)].sort()), readOnlyOperations: READ_ONLY_OPERATIONS });
}

export type VehicleInterfaceSession = Readonly<{ sessionId: string; sessionRevision: string; adapterId: string; adapterRevision: string; transportKind: VehicleTransportKind; state: "open" | "connected" | "disconnected" | "failed"; startedAt: string; endedAt: string | null; disconnectReason: string | null; failureCode: string | null; provenance: string }>;
export function defineVehicleInterfaceSession(input: Omit<VehicleInterfaceSession, "sessionId" | "sessionRevision"> & { sessionReference: string }): VehicleInterfaceSession {
  timestamp(input.startedAt, "Session start timestamp"); if (input.endedAt !== null) timestamp(input.endedAt, "Session end timestamp");
  if ((input.state === "disconnected" || input.state === "failed") !== (input.endedAt !== null)) throw new Error("Terminal session state and end timestamp must agree.");
  if ((input.state === "failed") !== (input.failureCode !== null)) throw new Error("Failed session state requires only an explicit failure code.");
  if (input.state === "disconnected" && input.disconnectReason === null) throw new Error("Disconnected session requires a reason.");
  const stable = { adapterId: input.adapterId, adapterRevision: input.adapterRevision, transportKind: input.transportKind, startedAt: input.startedAt, sessionReference: required(input.sessionReference, "Session reference") };
  const sessionId = `vehicle-session:${digest("tunesight.vehicle-session.identity.v1", stable).slice(7)}`;
  const envelope = { ...stable, state: input.state, endedAt: input.endedAt, disconnectReason: input.disconnectReason, failureCode: input.failureCode, provenance: input.provenance };
  return Object.freeze({ sessionId, sessionRevision: `vehicle-session-revision:${digest("tunesight.vehicle-session.revision.v1", envelope).slice(7)}`, adapterId: required(input.adapterId, "Session adapter identity"), adapterRevision: required(input.adapterRevision, "Session adapter revision"), transportKind: input.transportKind, state: input.state, startedAt: input.startedAt, endedAt: input.endedAt, disconnectReason: input.disconnectReason, failureCode: input.failureCode, provenance: required(input.provenance, "Session provenance") });
}

export type EcuIdentityObservation = Readonly<{ observationId: string; sessionId: string; endpointId: string; protocol: string; observedDmeFamily: string | null; softwareIdentity: string | null; calibrationIdentity: string | null; vin: string | null; observedAt: string; capabilityObservations: readonly string[]; qualification: "synthetic" | "observed_unqualified"; provenance: string }>;
export function defineEcuIdentityObservation(input: Omit<EcuIdentityObservation, "observationId">): EcuIdentityObservation {
  timestamp(input.observedAt, "ECU observation timestamp");
  const payload = { ...input, sessionId: required(input.sessionId, "Session identity"), endpointId: required(input.endpointId, "ECU endpoint identity"), protocol: required(input.protocol, "ECU protocol"), capabilityObservations: [...new Set(input.capabilityObservations)].sort(), provenance: required(input.provenance, "ECU observation provenance") };
  return Object.freeze({ ...payload, observationId: `ecu-observation:${digest("tunesight.ecu-identity-observation.v1", payload).slice(7)}`, capabilityObservations: Object.freeze(payload.capabilityObservations) });
}

export type ChannelDefinition = Readonly<{ channelId: string; revisionId: string; channelKey: string; sourceEndpointId: string; protocol: string; serviceId: string; requestId: string; rawDataType: "uint8" | "uint16" | "uint32" | "int8" | "int16" | "int32"; decoding: Readonly<{ kind: "identity" | "linear"; scale: number; offset: number; qualification: "qualified" | "unqualified" }>; unit: string; applicability: Readonly<{ state: "qualified" | "unresolved" | "unsupported"; dmeFamilies: readonly string[] }>; expectedRateHz: Readonly<{ minimum: number; maximum: number }> | null; provenance: string }>;
export function defineChannelDefinition(input: Omit<ChannelDefinition, "channelId" | "revisionId">): ChannelDefinition {
  required(input.channelKey, "Channel key"); required(input.sourceEndpointId, "Channel endpoint"); required(input.protocol, "Channel protocol"); required(input.serviceId, "Channel service"); required(input.requestId, "Channel request"); required(input.unit, "Channel unit"); required(input.provenance, "Channel provenance");
  if (input.expectedRateHz && (!Number.isFinite(input.expectedRateHz.minimum) || !Number.isFinite(input.expectedRateHz.maximum) || input.expectedRateHz.minimum <= 0 || input.expectedRateHz.maximum < input.expectedRateHz.minimum)) throw new Error("Expected channel rate is invalid.");
  const stable = { channelKey: input.channelKey, sourceEndpointId: input.sourceEndpointId, protocol: input.protocol, serviceId: input.serviceId, requestId: input.requestId };
  const revision = { ...stable, rawDataType: input.rawDataType, decoding: input.decoding, unit: input.unit, applicability: { ...input.applicability, dmeFamilies: [...new Set(input.applicability.dmeFamilies)].sort() }, expectedRateHz: input.expectedRateHz, provenance: input.provenance };
  return Object.freeze({ ...revision, channelId: `vehicle-channel:${digest("tunesight.vehicle-channel.identity.v1", stable).slice(7)}`, revisionId: `vehicle-channel-revision:${digest("tunesight.vehicle-channel.revision.v1", revision).slice(7)}`, decoding: Object.freeze({ ...input.decoding }), applicability: Object.freeze({ ...input.applicability, dmeFamilies: Object.freeze(revision.applicability.dmeFamilies) }), expectedRateHz: input.expectedRateHz ? Object.freeze({ ...input.expectedRateHz }) : null });
}

export type ChannelObservation = Readonly<{ observationId: string; sessionId: string; channelRevisionId: string; sequence: number; acquiredAt: string; sourceTimestamp: number | null; rawValue: number; convertedValue: number | null; unit: string; validity: "valid" | "invalid" | "unsupported"; finding: string | null; provenance: string }>;
export function defineChannelObservation(input: Omit<ChannelObservation, "observationId" | "channelRevisionId" | "convertedValue" | "unit"> & { channel: ChannelDefinition }): ChannelObservation {
  timestamp(input.acquiredAt, "Acquisition timestamp"); if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) throw new Error("Observation sequence must be a non-negative safe integer."); if (!Number.isFinite(input.rawValue)) throw new Error("Raw observation must be finite.");
  const convertedValue = input.validity === "valid" && input.channel.decoding.qualification === "qualified" ? input.rawValue * input.channel.decoding.scale + input.channel.decoding.offset : null;
  if (convertedValue !== null && !Number.isFinite(convertedValue)) throw new Error("Converted observation is invalid.");
  if ((input.validity === "valid") === (input.finding !== null)) throw new Error("Only invalid or unsupported observations require a finding.");
  const payload = { sessionId: input.sessionId, channelRevisionId: input.channel.revisionId, sequence: input.sequence, acquiredAt: input.acquiredAt, sourceTimestamp: input.sourceTimestamp, rawValue: input.rawValue, convertedValue, unit: input.channel.unit, validity: input.validity, finding: input.finding, provenance: required(input.provenance, "Observation provenance") };
  return Object.freeze({ ...payload, observationId: `channel-observation:${digest("tunesight.channel-observation.v1", payload).slice(7)}` });
}

export interface ReadOnlyVehicleTransport {
  readonly adapter: PhysicalAdapter;
  discover(): Promise<readonly string[]>;
  open(input: { sessionReference: string; startedAt: string }): Promise<VehicleInterfaceSession>;
  connect(): Promise<VehicleInterfaceSession>;
  identify(input: { observedAt: string }): Promise<EcuIdentityObservation>;
  read(channel: ChannelDefinition, input: { acquiredAt: string; sequence: number }): Promise<ChannelObservation>;
  stream(channel: ChannelDefinition, inputs: readonly Readonly<{ acquiredAt: string; sequence: number }>[]): Promise<readonly ChannelObservation[]>;
  disconnect(input: { endedAt: string; reason: string }): Promise<VehicleInterfaceSession>;
}
