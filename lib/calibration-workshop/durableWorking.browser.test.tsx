/** Controlled UI evidence only; server admission, replay and SQL are tested separately. */
import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import Workspace from "../../app/dashboard/vehicles/[id]/calibration/shared-workspace-client";
import type { WorkspaceBrowserFixture } from "./sharedWorkspace.browser.test";
import type { DurableWorkingSnapshot, DurableRevisionSummary } from "./durableWorking";

export async function runDurableBrowserTests(container: HTMLElement, fixtures: WorkspaceBrowserFixture[], report: (message: string) => void) {
  const originalFetch = window.fetch, originalConfirm = window.confirm;
  const check = (value: unknown, label: string) => { if (!value) throw Error(label); };
  const settle = async (predicate: () => boolean) => { const until = performance.now() + 10000; while (!predicate()) {
    if (performance.now() > until) throw Error("Durable UI timeout: " + container.textContent?.slice(-500)); await new Promise(requestAnimationFrame);
  } };
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === label)!;
  const fixture = fixtures[0], owner = fixture.props.context.ownerId;
  check(owner.startsWith("r02-controlled"), "Only synthetic scopes");
  const clear = () => { for (const key of Object.keys(localStorage)) if (key.includes(owner)) localStorage.removeItem(key); };
  clear(); let root = createRoot(container), writes = 0, active = 0, maximum = 0, reject = false;
  let snapshot: DurableWorkingSnapshot = { head: null, working: null, history: [] };
  const records = new Map<string, DurableWorkingSnapshot>();
  window.confirm = () => true;
  window.fetch = async (url, init) => {
    const request = JSON.parse(String(init?.body));
    if (!String(url).endsWith("/working")) return new Response(JSON.stringify(fixture.responses[request.selection.key]));
    active++; maximum = Math.max(maximum, active); await new Promise(requestAnimationFrame); active--;
    if (reject) return Response.json({ status: "unavailable", finding: "Controlled conflict; edits preserved" }, { status: 409 });
    if (request.action !== "read") {
      writes++;
      const head: DurableRevisionSummary = { id: crypto.randomUUID(), sequence: writes, parent_id: request.restoreId ?? snapshot.head?.id ?? null,
        previous_head_id: snapshot.head?.id ?? null, restored_from_id: request.restoreId ?? null, content_hash: "controlled",
        created_at: new Date().toISOString(), contract_version: "tunesight.durable-working.v1", capability_state: "EDIT_ONLY_OUTPUT_LOCKED" };
      snapshot = { head, working: request.action === "restore" ? records.get(request.restoreId)!.working : request.working, history: [head, ...snapshot.history] };
      records.set(head.id, snapshot);
    }
    return Response.json({ status: "ready", ...snapshot });
  };
  const mount = () => root.render(createElement(StrictMode, null, createElement(Workspace, { ...fixture.props, upload: null,
    initialWorking: { status: "ready", snapshot } })));
  try {
    mount(); await settle(() => Boolean(button("Create Working Calibration")) && !button("Create Working Calibration").disabled);
    button("Create Working Calibration").click(); await settle(() => Boolean(button("Save durable revision")) && !button("Save durable revision").disabled);
    check(writes === 0, "Creation is explicit unsaved state, no autosave");
    button("Save durable revision").click(); button("Save durable revision")?.click();
    await settle(() => Boolean(snapshot.head) && container.textContent?.includes("Saved as a durable Working revision") === true);
    check(writes === 1 && maximum === 1, "Repeated save clicks cannot overlap or duplicate");
    check(snapshot.working?.cursor === 0, "Zero-change Working is durable");
    check(!Object.keys(localStorage).some(k => k.startsWith("tunesight:working-calibration") && k.includes(owner)), "Production Working does not autosave into browser storage");
    root.unmount(); clear(); root = createRoot(container); mount();
    await settle(() => button("WORKING")?.getAttribute("aria-pressed") === "true");
    check(container.textContent?.includes("Saved as a durable Working revision"), "Second clean device restores exact durable Working");
    button("Restore revision 1").click(); await settle(() => snapshot.history.length === 2 && Boolean(button("Restore revision 2")));
    check(snapshot.head?.restored_from_id === snapshot.history[1].id, "Restoration creates a new historical child");
    reject = true; button("Save durable revision").click();
    await settle(() => container.textContent?.includes("Controlled conflict; edits preserved") === true);
    check(button("WORKING").getAttribute("aria-pressed") === "true", "Conflict retains local Working and mode");
    reject = false; button("Reload durable head").click();
    await settle(() => container.textContent?.includes("Saved as a durable Working revision") === true && !button("Save durable revision").disabled);
    check(writes === 2, "Explicit head reload writes nothing");
    check(container.textContent?.includes("Build Calibration · LOCKED") && container.textContent.includes("Export BIN · LOCKED"), "Output remains locked");
    report("PASS R04 controlled UI: Strict Mode, explicit zero-change save, no browser autosave, clean-device restore, new revision from history, conflict preservation, read-only reload and locked output");
  } finally { root.unmount(); clear(); window.fetch = originalFetch; window.confirm = originalConfirm; }
}
