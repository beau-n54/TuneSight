/** Browser/Node compatibility contract. No secrets or vehicle commands live here. */
export const BRIDGE_URL = "http://127.0.0.1:57631";
export const BRIDGE_PAIRING_CONTRACT = "tunesight.bridge-pairing.v1";
export const BRIDGE_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
export const BRIDGE_TOKEN_RENEWAL_MS = 30 * 1000;
export const DEFAULT_BRIDGE_ORIGINS = [
  "https://tunesight-beta.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;
export type BridgePairing = Readonly<{
  contract: typeof BRIDGE_PAIRING_CONTRACT;
  token: string;
  expiresAt: number;
}>;
