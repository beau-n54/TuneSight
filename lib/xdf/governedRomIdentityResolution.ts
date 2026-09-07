import type { InternalIdentityObservation } from "./applicabilityEvidenceProposal.ts";

export type GovernedRomMarkerProfile = Readonly<{ identity: string; detector: InternalIdentityObservation["detector"]; requiredOffsets: readonly number[] }>;
export type GovernedRomIdentityResolution = Readonly<{ outcome: "resolved" | "conflict" | "unresolved"; identity: string | null; primaryObservation: InternalIdentityObservation | null; ancillaryObservations: readonly InternalIdentityObservation[]; findings: readonly string[] }>;

const freeze = <T>(value: T): T => { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; };

export function resolveGovernedRomIdentity(input: Readonly<{ observations: readonly InternalIdentityObservation[]; markerProfiles: readonly GovernedRomMarkerProfile[] }>): GovernedRomIdentityResolution {
  const profiles = new Map(input.markerProfiles.map((profile) => [profile.identity.toUpperCase(), profile]));
  const profiled = input.observations.filter((observation) => {
    const profile = profiles.get(observation.normalizedForm);
    return Boolean(profile && observation.detector === profile.detector && profile.requiredOffsets.every((offset) => observation.offsets.includes(offset)));
  });
  const primaryIdentities = [...new Set(profiled.map((observation) => observation.normalizedForm))];
  if (primaryIdentities.length > 1) return freeze({ outcome: "conflict", identity: null, primaryObservation: null, ancillaryObservations: input.observations, findings: [`Multiple governed primary marker profiles matched: ${primaryIdentities.sort().join(", ")}.`] });
  if (primaryIdentities.length === 1) {
    const identity = primaryIdentities[0]!, primaryObservation = profiled.find((observation) => observation.normalizedForm === identity)!;
    return freeze({ outcome: "resolved", identity, primaryObservation, ancillaryObservations: input.observations.filter((observation) => observation !== primaryObservation), findings: [`Governed repeated-marker profile resolved ${identity}; other observations remain ancillary evidence.`] });
  }
  const identities = [...new Set(input.observations.map((observation) => observation.normalizedForm))];
  if (identities.length === 1) return freeze({ outcome: "resolved", identity: identities[0]!, primaryObservation: input.observations[0]!, ancillaryObservations: input.observations.slice(1), findings: ["One governed identity was observed and no competing identity exists."] });
  if (identities.length > 1) return freeze({ outcome: "conflict", identity: null, primaryObservation: null, ancillaryObservations: input.observations, findings: ["Multiple identities were observed without one matching a governed primary marker profile."] });
  return freeze({ outcome: "unresolved", identity: null, primaryObservation: null, ancillaryObservations: [], findings: ["No governed ROM/software identity was observed."] });
}
