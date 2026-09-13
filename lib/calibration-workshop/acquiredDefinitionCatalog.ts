import type { DefinitionCatalog, DefinitionCatalogEntry, DefinitionCatalogIdentity } from "./masterCalibrationResolver.ts";

export type AcquiredCatalogDescriptor = Readonly<{ entry: DefinitionCatalogEntry; admissionState: "candidate" | "active" | "inactive" | "superseded" }>;

export function createAcquiredDefinitionCatalog(input: Readonly<{ catalogId: string; identities: readonly DefinitionCatalogIdentity[]; descriptors: readonly AcquiredCatalogDescriptor[] }>): DefinitionCatalog {
  const entries = input.descriptors.map(({ entry, admissionState }) => Object.freeze({ ...entry, sourceKind: "acquired" as const, lifecycleState: admissionState === "active" ? "active" as const : admissionState === "superseded" ? "superseded" as const : "inactive" as const, sourceAuthorityState: admissionState === "active" ? "qualified" as const : entry.sourceAuthorityState, applicabilityState: admissionState === "active" ? "published" as const : entry.applicabilityState }));
  return Object.freeze({ catalogId: input.catalogId, listIdentities: () => Object.freeze([...input.identities]), listEntries: () => Object.freeze([...entries]) });
}

export function composeDefinitionCatalogs(catalogId: string, catalogs: readonly DefinitionCatalog[]): DefinitionCatalog {
  return Object.freeze({ catalogId, listIdentities: () => Object.freeze([...new Map(catalogs.flatMap((catalog) => catalog.listIdentities()).map((identity) => [identity.romSoftwareIdentity.toUpperCase(), identity])).values()]), listEntries: () => Object.freeze(catalogs.flatMap((catalog) => catalog.listEntries())) });
}
