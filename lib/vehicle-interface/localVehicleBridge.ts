import type { VehicleAdapterProfile } from "./adapterProfiles.ts";

export const LOCAL_VEHICLE_BRIDGE_CONTRACT = "tunesight.local-vehicle-bridge.v1" as const;
export type BridgeRequest = Readonly<
  | { kind: "discover"; sessionAssociation: string }
  | { kind: "connect"; sessionAssociation: string; profileRevision: string; endpoint: Readonly<{ host: string; port: number; protocol: "tcp" | "udp" }> }
  | { kind: "identify"; sessionAssociation: string; profileRevision: string }
  | { kind: "read_channels"; sessionAssociation: string; profileRevision: string; channelRevisionIds: readonly string[]; maximumSamples: number }
  | { kind: "disconnect"; sessionAssociation: string; profileRevision: string }
>;

export type BridgePolicy = Readonly<{ bindAddress: "127.0.0.1" | "::1"; maximumPayloadBytes: number; maximumChannelsPerRequest: number; maximumSamplesPerRequest: number; allowedChannelRevisionIds: readonly string[] }>;

export function validateBridgeRequest(input: { request: BridgeRequest; profile: VehicleAdapterProfile; policy: BridgePolicy; encodedPayloadBytes: number }): BridgeRequest {
  const { request, profile, policy } = input;
  if (policy.bindAddress !== "127.0.0.1" && policy.bindAddress !== "::1") throw new Error("Vehicle bridge must bind to loopback.");
  if (!request.sessionAssociation.trim()) throw new Error("Bridge request requires explicit TuneSight session association.");
  if (input.encodedPayloadBytes < 0 || input.encodedPayloadBytes > policy.maximumPayloadBytes) throw new Error("Bridge request exceeds its payload limit.");
  if (request.kind !== "discover" && request.profileRevision !== profile.profileRevision) throw new Error("Bridge request profile revision is not authorised.");
  if (request.kind === "connect") {
    const allowed = profile.endpoints.some((endpoint) => endpoint.state !== "unknown" && endpoint.host === request.endpoint.host && endpoint.port === request.endpoint.port && endpoint.protocol === request.endpoint.protocol);
    if (!allowed) throw new Error("Bridge endpoint is not allowlisted by the adapter profile.");
  }
  if (request.kind === "read_channels") {
    if (request.channelRevisionIds.length === 0 || request.channelRevisionIds.length > policy.maximumChannelsPerRequest || request.maximumSamples < 1 || request.maximumSamples > policy.maximumSamplesPerRequest) throw new Error("Bridge channel request exceeds its bounded limits.");
    if (request.channelRevisionIds.some((id) => !policy.allowedChannelRevisionIds.includes(id))) throw new Error("Bridge channel is not allowlisted.");
  }
  return Object.freeze({ ...request, ...(request.kind === "connect" ? { endpoint: Object.freeze({ ...request.endpoint }) } : {}), ...(request.kind === "read_channels" ? { channelRevisionIds: Object.freeze([...request.channelRevisionIds]) } : {}) }) as BridgeRequest;
}
