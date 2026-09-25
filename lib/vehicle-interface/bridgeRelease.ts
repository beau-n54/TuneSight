export type PublicBridgeRelease = Readonly<{ version: string; sha256: string; bytes: number; url: string; signed: true; physicalValidation: "passed" }>;
/** Promotion is manual after artifact verification, signing and physical acceptance.
 * A draft, unsigned, malformed or wrong-repository feed cannot create a public download.
 */
export function publicBridgeRelease(value: unknown): PublicBridgeRelease | null {
  if (!value || typeof value !== "object" || !("schema" in value) || value.schema !== 1 || !("latest" in value)) return null;
  const entry = value.latest as Partial<PublicBridgeRelease> | null;
  if (!entry || typeof entry.version !== "string" || !/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(entry.version)
    || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)
    || !Number.isSafeInteger(entry.bytes) || entry.bytes! <= 0 || entry.signed !== true || entry.physicalValidation !== "passed"
    || entry.url !== `https://github.com/beau-n54/TuneSight/releases/download/bridge-v${entry.version}/TuneSight-Bridge-${entry.version}-windows-x64-setup.exe`) return null;
  return { version: entry.version, sha256: entry.sha256, bytes: entry.bytes!, url: entry.url, signed: true, physicalValidation: "passed" };
}
