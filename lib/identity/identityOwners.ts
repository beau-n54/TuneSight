/** R01: presentation of identity-owner outputs, never an applicability authority.
 * No field is filled from another owner's value. This module has no I/O or state.
 */
export const IDENTITY_OWNER_CONTRACT = "tunesight.identity-owners.v1" as const;
export type SavedVehicleInput = Readonly<{
  id?: string | null; nickname?: string | null; make?: string | null; model?: string | null;
  year?: number | null; chassis?: string | null; engine_code?: string | null; engine_generation?: string | null;
}>;
export type ControllerObservation = Readonly<{
  observationId: string; source: "connected_controller" | "uploaded_controller_evidence";
  sourceId: string; observedAt: string; qualification: "qualified" | "unqualified" | "conflict";
  vehicleId: string | null; observedVin: string | null;
  observedDmeFamily: string | null; exactSoftwareIdentity: string | null;
  controllerAddress: string | null; adapterIdentity: string | null;
  findings: readonly string[];
}>;
export type ObservedIdentityField = Readonly<{
  value: string | null; state: "observed" | "not_observed" | "conflict";
  evidence: readonly ControllerObservation[]; reason: string | null;
}>;
export type CalibrationSourceIdentity = Readonly<{
  authority: "qualified_calibration_source"; containerType: string; containerDigest: string | null;
  containerDigestProvenance?: "uploaded_container_sha256" | "qualified_identity_container_resolution" | null;
  engineeringBinaryDigest: string; exactSoftwareIdentity: string;
  definitionSourceFamily: string | null; definitionSetRevision: string;
  sourceArtifactId: string; sourceArtifactDigest: string;
  datasetId: string; datasetRevision: string; coverage: string;
}>;
export type CalibrationStateIdentity = Readonly<{
  reference: Readonly<{ datasetId: string; datasetRevision: string }> | null;
  current: Readonly<{ datasetId: string; datasetRevision: string }> | null;
  working: Readonly<{ workingCalibrationId: string; workingCalibrationRevision: string; currentDatasetId: string; currentDatasetRevision: string }> | null;
}>;
const present = (value: string | null | undefined) => typeof value === "string" && value.trim() ? value : null;
function copyObservation(value: ControllerObservation): ControllerObservation {
  return Object.freeze({ ...value, findings: Object.freeze([...value.findings]) });
}
/** These two literal values are owner-selectable values in the existing vehicle form.
 * Recognising that explicit declaration is not inferring a generation from a ROM,
 * chassis, year, controller or XDF. The original saved engine label is untouched.
 */
export function savedVehicleIdentity(vehicle: SavedVehicleInput | null | undefined) {
  const engineCode = present(vehicle?.engine_code);
  const generation = present(vehicle?.engine_generation)
    ?? (engineCode === "B58 Gen 1" || engineCode === "B58 Gen 2" ? engineCode : null);
  return Object.freeze({ authority: "owner_declaration" as const, vehicleId: present(vehicle?.id),
    nickname: present(vehicle?.nickname), make: present(vehicle?.make), model: present(vehicle?.model),
    year: typeof vehicle?.year === "number" && Number.isFinite(vehicle.year) ? vehicle.year : null,
    chassis: present(vehicle?.chassis), engineGeneration: generation, declaredEngineCode: engineCode,
    generationSource: present(vehicle?.engine_generation) ? "vehicles.engine_generation" : generation ? "vehicles.engine_code (explicit saved generation label)" : null,
    engineCodeSource: "vehicles.engine_code" as const });
}
export function observedControllerIdentity(observations: readonly ControllerObservation[] = [], expectedVehicleId: string | null = null) {
  const evidence = Object.freeze(observations.map(copyObservation));
  const wrongVehicle = expectedVehicleId !== null && evidence.some(item => item.qualification === "qualified" && present(item.vehicleId) !== null && item.vehicleId !== expectedVehicleId);
  const qualified = evidence.filter(item => item.qualification === "qualified" && present(item.observationId)
    && present(item.sourceId) && ["connected_controller", "uploaded_controller_evidence"].includes(item.source)
    && (expectedVehicleId === null || item.vehicleId === expectedVehicleId)
    && Number.isFinite(Date.parse(item.observedAt)));
  const field = (key: "observedDmeFamily" | "exactSoftwareIdentity" | "controllerAddress" | "adapterIdentity" | "observedVin"): ObservedIdentityField => {
    const supplied = qualified.filter(item => present(item[key]) !== null);
    const values = [...new Set(supplied.map(item => item[key]!))];
    const conflict = wrongVehicle || evidence.some(item => item.qualification === "conflict") || values.length > 1;
    return Object.freeze({ value: !conflict && values.length === 1 ? values[0] : null,
      state: conflict ? "conflict" : values.length === 1 ? "observed" : "not_observed",
      evidence, reason: wrongVehicle ? "Controller evidence is bound to a different saved vehicle; no identity is selected." : conflict ? "Controller observations conflict; no identity is selected. Review the source observations."
        : values.length ? null : "No qualified controller observation establishes this value." });
  };
  return Object.freeze({ authority: "controller_observation" as const, observedDmeFamily: field("observedDmeFamily"),
    exactSoftwareIdentity: field("exactSoftwareIdentity"), controllerAddress: field("controllerAddress"),
    adapterIdentity: field("adapterIdentity"), observedVin: field("observedVin"), evidence });
}
export function identityOwners(input: Readonly<{
  vehicle?: SavedVehicleInput | null; controllerObservations?: readonly ControllerObservation[];
  calibration?: CalibrationSourceIdentity | null; states?: CalibrationStateIdentity;
}>) {
  const states = input.states;
  const working = states?.working;
  const workingMatchesCurrent = !working || (working.currentDatasetId === states?.current?.datasetId
    && working.currentDatasetRevision === states.current.datasetRevision);
  return Object.freeze({ contract: IDENTITY_OWNER_CONTRACT, savedVehicle: savedVehicleIdentity(input.vehicle),
    controller: observedControllerIdentity(input.controllerObservations, present(input.vehicle?.id)),
    calibration: input.calibration ? Object.freeze({ ...input.calibration }) : null,
    states: Object.freeze({ reference: states?.reference ? Object.freeze({ ...states.reference }) : null,
      current: states?.current ? Object.freeze({ ...states.current }) : null,
      working: working && workingMatchesCurrent ? Object.freeze({ ...working }) : null,
      workingUnavailableReason: workingMatchesCurrent ? null : "Working lineage does not match the exact Current Dataset revision.",
      suggested: "unavailable" as const, currentImmutable: true as const }),
  });
}
export function observedIdentityLabel(field: ObservedIdentityField): string {
  return field.state === "observed" ? field.value! : field.state === "conflict" ? "Conflicting observations — not established" : "Not observed";
}
/** Existing Analysis scope remains explicit owner-declared N54 plus its separately
 * qualified source/rule contract. This is not a claim of observed N54 hardware.
 * Optional contradictory controller evidence closes applicability, never widens it.
 */
export function declaredAnalysisPlatform(vehicle: SavedVehicleInput | null, observations: readonly ControllerObservation[] = []): "n54" | "unknown" {
  const identity = identityOwners({ vehicle, controllerObservations: observations });
  if (identity.controller.observedDmeFamily.state === "conflict" || identity.controller.exactSoftwareIdentity.state === "conflict" || identity.controller.observedVin.state === "conflict") return "unknown";
  const observedFamily = identity.controller.observedDmeFamily.value;
  if (observedFamily !== null && !["MSD80", "MSD81"].includes(observedFamily.trim().toUpperCase())) return "unknown";
  // Founder explicitly authorised this legacy owner-declaration alias during the
  // Analysis restoration. Preserve the saved label; never call it observed hardware.
  const declared = identity.savedVehicle.declaredEngineCode?.trim().toUpperCase();
  return declared === "N54" || declared === "N54B30" ? "n54" : "unknown";
}
