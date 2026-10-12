/** Controlled native-browser checks against real components. No subscriber data. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WorkingPanel from "../../app/dashboard/vehicles/[id]/calibration/working-calibration-panel";
import DirectCell from "../../app/dashboard/vehicles/[id]/calibration/direct-grid-cell";
import UploadCalibration from "../../app/dashboard/vehicles/[id]/calibration/upload-calibration";
import LiveBridgeControls from "../../components/LiveBridgeControls";
import Summary from "../../components/IdentityOwnerSummary";
import { workingPanelFixture } from "./identityOwners.presentation.fixtures";

export async function runIdentityOwnerBrowserTests(container: HTMLElement, report: (message: string) => void) {
  const root = createRoot(container), errors: string[] = [], originalError = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(" ")); originalError(...args); };
  const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
  const settle = async (predicate: () => boolean) => { const limit = performance.now() + 4000; while (!predicate()) {
    if (performance.now() > limit) throw new Error("R01 controlled UI did not settle"); await new Promise(resolve => setTimeout(resolve, 10));
  } };
  const noop = () => {};
  try {
    root.render(<StrictMode><Summary vehicle={{ engine_code: "B58 Gen 2", make: "Toyota", model: "Supra" }} />
      <WorkingPanel {...workingPanelFixture()} /><WorkingPanel {...workingPanelFixture()} />
      <UploadCalibration vehicleId="synthetic-only" />
      <LiveBridgeControls state="disconnected" finding="Controlled test" manualToken="" onManualToken={noop} onConnect={noop} onDisconnect={noop} />
      <DirectCell cellKey="synthetic-cell" index={0} row={0} column={0} columnCount={1} value={1} currentValue={1} changed={false} selected canEdit
        onSelect={noop} onNavigate={noop} onCommit={() => ({status: "blocked", findings: ["Same controlled finding", "Same controlled finding"]})} format={String} />
    </StrictMode>);
    await settle(() => container.querySelectorAll('[data-finding-source]').length === 8);
    check(container.textContent?.includes("Observed DME/controller family: Not observed"), "Declared label must not become observed controller");
    check(container.textContent?.includes("B58 Gen 2"), "Saved Supra label remains literal");
    report("PASS R01: actual identity component preserves Supra label and controller absence");
    check(container.querySelectorAll('[data-finding-source="editAuthority.blockers"]').length === 4, "Duplicate owner findings retained");
    check(container.querySelectorAll('[data-finding-source="workingEditPreview.findings"]').length === 2, "Distinct preview source retained");
    report("PASS R01: eight repeated Working findings preserved across two panels without key collision");
    [...container.querySelectorAll('button')].find(item => item.textContent === 'Advanced')!.click();
    await settle(() => Boolean(container.querySelector('input[name="localBridgeToken"]')));
    const button = container.querySelector<HTMLButtonElement>('[data-working-cell="0"]')!;
    button.focus(); button.dispatchEvent(new KeyboardEvent('keydown', {key: 'F2', bubbles: true}));
    await settle(() => Boolean(container.querySelector('input[name="workingCellValue"]')));
    const fields = [...container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select,textarea')];
    check(new Set(fields.map(item => item.id)).size === fields.length, "Every actual field has a unique ID");
    for (const field of fields) check(field.id && field.name && field.labels?.length, `Missing associated field metadata: ${field.name}`);
    const secret = container.querySelector<HTMLInputElement>('input[name="localBridgeToken"]')!;
    check(secret.type === 'password' && !container.textContent?.includes(secret.value || 'not-a-token'), "Token remains masked and outside text");
    report("PASS R01: real Working, upload, direct-cell and Advanced fields have unique IDs, names and associated labels; token masked");
    const cell = container.querySelector<HTMLInputElement>('input[name="workingCellValue"]')!;
    cell.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    await settle(() => container.querySelectorAll('[role="alert"] details p').length === 2);
    check(document.activeElement === cell, "Blocked keyboard submission retains editor focus");
    cell.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    await settle(() => !container.querySelector('input[name="workingCellValue"]'));
    check(container.querySelector('[data-working-cell="0"]')?.textContent?.includes('1'), "Escape preserves source value");
    report("PASS R01: F2/Enter/Escape native keyboard handlers preserve value and repeated blocked findings");
    check(!errors.some(error => /same key|unique.*key|controlled.*uncontrolled|uncontrolled.*controlled/i.test(error)), "No React key or field-control warnings");
    check(errors.length === 0, "No controlled-browser React errors");
    report("PASS R01: StrictMode console has no React errors or duplicate-key warnings");
  } finally { root.unmount(); console.error = originalError; }
}
