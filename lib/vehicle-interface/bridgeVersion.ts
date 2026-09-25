/** Public compatibility metadata only. Credentials never enter this contract. */
export const DESKTOP_BRIDGE_VERSION = "0.1.0-beta.1";
export const BRIDGE_PROTOCOL_VERSION = 1;
export const HOSTED_BRIDGE_CLIENT_VERSION = 1;
export const MINIMUM_HOSTED_BRIDGE_VERSION = 1;
export type BridgeVersion = Readonly<{
  desktopVersion: string | null;
  protocolVersion: number;
  minimumHostedVersion: number;
}>;
export const NODE_BRIDGE_VERSION: BridgeVersion = Object.freeze({ desktopVersion: null, protocolVersion: BRIDGE_PROTOCOL_VERSION, minimumHostedVersion: MINIMUM_HOSTED_BRIDGE_VERSION });
export const DESKTOP_BRIDGE_COMPATIBILITY: BridgeVersion = Object.freeze({ ...NODE_BRIDGE_VERSION, desktopVersion: DESKTOP_BRIDGE_VERSION });
export function compatibleBridgeVersion(value: unknown): value is BridgeVersion {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<BridgeVersion>;
  return v.protocolVersion === BRIDGE_PROTOCOL_VERSION && Number.isSafeInteger(v.minimumHostedVersion)
    && v.minimumHostedVersion! > 0 && v.minimumHostedVersion! <= HOSTED_BRIDGE_CLIENT_VERSION
    && (v.desktopVersion === null || (typeof v.desktopVersion === "string" && /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(v.desktopVersion)));
}
