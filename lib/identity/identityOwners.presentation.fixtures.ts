/** Test-only, synthetic Working state. Never persisted or imported by a route. */
import type { ComponentProps } from "react";
import type WorkingPanel from "../../app/dashboard/vehicles/[id]/calibration/working-calibration-panel";
export function workingPanelFixture(): ComponentProps<typeof WorkingPanel> {
  const noop = () => {};
  return { mode: "working", onMode: noop, onCreate: noop, onUndo: noop, onRedo: noop,
    operation: "assign", onOperation: noop, operand: "", onOperand: noop, onApply: noop,
    selectedCount: 1, definitionTitles: {}, editQualified: false, saveStatus: "saved",
    blockers: ["Identical governed finding", "Identical governed finding"], warnings: ["Identical governed finding"],
    preview: { validation: "BLOCKED", findings: ["Identical governed finding"], before: [1], after: [1] },
    working: { contractVersion: "tunesight.working-calibration.v1", workingCalibrationId: "synthetic-working", workingCalibrationRevision: "synthetic-working-r1",
      ownerScope: "synthetic-owner", vehicleId: "synthetic-vehicle", currentDatasetId: "synthetic-current", currentDatasetRevision: "synthetic-current-r1",
      romLayoutId: "synthetic-layout", relationshipRevision: "synthetic-relationship", definitionSetRevision: "synthetic-definitions",
      createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z", mutations: [], cursor: 0, state: "unchanged", validation: "VALID" } };
}
