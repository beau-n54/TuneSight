import type { SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";
import type { SharedWorkspaceWorkshop } from "./sharedWorkspaceAdapter.ts";

/** Temporary migration policy. Missing configuration selects shared; invalid configuration selects the retained safe fallback. */
export function resolveWorkspacePresentation(value: string | undefined): "shared" | "legacy" {
  return value === undefined || value === "shared" ? "shared" : "legacy";
}

/** This boundary deliberately has no runtime import of U0 or the projection adapter. */
export function dispatchWorkspace<T>(presentation: "shared" | "legacy", legacy: () => T, shared: () => T): T {
  return presentation === "legacy" ? legacy() : shared();
}

/** Mask retained renderer material from the admitted owner evidence, independently of U0. */
export function maskRetainedWorkspace(workshop: SharedWorkspaceWorkshop,
  result: Pick<SubscriberCalibrationSuccess, "material" | "quarantines">): SharedWorkspaceWorkshop {
  const currentOnly = "mode" in workshop;
  const blocked = new Set(workshop.definitions.filter(selected => {
    const datasets = currentOnly ? [result.material.current] : [result.material.current, result.material.reference];
    return datasets.some(dataset => {
      if (!dataset) return true;
      const definition = dataset.definitions.filter(item => item.definitionRevisionId === selected.definitionRevision)[selected.occurrence];
      return !definition?.engineeringEvidence || result.quarantines.some(item =>
        item.affectedBinary.digest === dataset.exactBinaryIdentity.digest &&
        item.relationship.definitionSetRevision === dataset.definitionSetRevisionId &&
        item.occurrence.definitionRevisionId === selected.definitionRevision && item.occurrence.occurrence === selected.occurrence);
    });
  }).map(item => item.key));
  if (!blocked.size) return workshop;
  if ("mode" in workshop) {
    const definitions = workshop.definitions.map(item => blocked.has(item.key) ? { ...item, cells: [], axes: [],
      availability: result.quarantines.some(record => record.affectedBinary.digest === result.material.current.exactBinaryIdentity.digest &&
        record.relationship.definitionSetRevision === result.material.current.definitionSetRevisionId &&
        record.occurrence.definitionRevisionId === item.definitionRevision && record.occurrence.occurrence === item.occurrence)
        ? "unavailable_quarantined" as const : "unavailable" as const,
      editCapability: { ...item.editCapability, state: "VIEW_ONLY" as const, blockers: ["Owner evidence is unavailable or quarantined."] } } : item);
    return { ...workshop, definitions, selectedDefinition: definitions.find(item => item.key === workshop.selectedDefinition.key)! };
  }
  const definitions = workshop.definitions.map(item => blocked.has(item.key) ? { ...item, available: false } : item);
  return { ...workshop, definitions,
    tableMaterials: workshop.tableMaterials.map(item => blocked.has(item.key) ? { ...item, cells: [], axes: [], referenceAxes: [] } : item),
    selectedDefinition: blocked.has(workshop.selectedDefinition.summary.key)
      ? { ...workshop.selectedDefinition, summary: { ...workshop.selectedDefinition.summary, available: false }, cells: [], axes: [], referenceAxes: [] }
      : workshop.selectedDefinition };
}
