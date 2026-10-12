/** Real shared controller, synthetic provider fixtures, native browser storage. Never subscriber records. */
import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import Workspace from "../../app/dashboard/vehicles/[id]/calibration/shared-workspace-client";
import type { ProjectionResponse } from "./sharedWorkspaceProjectionRequest";

export type WorkspaceBrowserFixture = { label: string; props: Parameters<typeof Workspace>[0]; responses: Record<string, ProjectionResponse> };
export async function runWorkspaceBrowserTests(container: HTMLElement, fixtures: WorkspaceBrowserFixture[], report: (message: string) => void) {
  const nativeFetch = window.fetch, originalError = console.error, errors: string[] = [];
  console.error = (...args) => { errors.push(args.map(String).join(" ")); originalError(...args); };
  const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
  const settle = async (predicate: () => boolean) => { const deadline = performance.now() + 10000; while (!predicate()) {
    if (performance.now() > deadline) throw Error("Workspace UI timeout"); await new Promise(requestAnimationFrame);
  } };
  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === text)!;
  const input = (element: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  for (const fixture of fixtures) {
    let requests = 0, inflight = 0, maxInflight = 0;
    const scope = fixture.props.context.ownerId;
    check(scope.startsWith("r02-controlled"), "Only synthetic fixture scopes may enter browser validation");
    const clear = () => { for (const storage of [localStorage, sessionStorage]) for (const key of Object.keys(storage)) if (key.includes(scope)) storage.removeItem(key); };
    clear();
    window.fetch = async (_url, init) => {
      requests++; inflight++; maxInflight = Math.max(maxInflight, inflight);
      await new Promise(requestAnimationFrame);
      inflight--;
      const key = JSON.parse(String(init?.body)).selection.key;
      return new Response(JSON.stringify(fixture.responses[key] ?? { status: "unavailable", code: "TEST_MISSING", finding: "Controlled absent projection" }), { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
    };
    let root = createRoot(container);
    try {
      const props = { ...fixture.props, upload: null, initialWorking: { status: "ready" as const,
        snapshot: { head: null, working: null, history: [] } } };
      root.render(createElement(StrictMode, null, createElement(Workspace, props)));
      await settle(() => Boolean(container.querySelector('[data-working-cell="0"]')) && Object.keys(localStorage).some(key => key.includes(scope)));
      check(requests === 0, "Initial projection must not be fetched again in Strict Mode");
      check(container.textContent?.includes("Cell Inspector") && container.textContent.includes("Understand") && container.textContent.includes("Engineering Detail"), "One shell includes Grid, Inspector and governed guidance");
      const first = container.querySelector<HTMLButtonElement>('[data-working-cell="0"]')!;
      const currentText = first.textContent;
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await settle(() => document.activeElement !== first);
      const search = container.querySelector<HTMLInputElement>('input[name="tableSearch"]') ?? container.querySelector<HTMLInputElement>('input[placeholder*="Search"]')!;
      check(search, "Explorer search exists");
      input(search, "__no_controlled_table__"); await settle(() => container.textContent?.includes("No Tables match") === true);
      input(search, ""); await settle(() => Boolean(container.querySelector('[aria-label="Explorer table list"] button')));
      if (button("2D") && !button("2D").disabled) {
        button("2D").click(); await settle(() => Boolean(container.querySelector('[aria-label="Linked 2D Calibration view"]')));
        check(container.querySelector('svg[role="img"]')?.getAttribute("aria-label")?.includes("Current"), "2D labels actual Current values");
        button("Grid").click(); await settle(() => Boolean(container.querySelector('[data-working-cell="0"]')));
      }
      const explorer = container.querySelector('[aria-label="Explorer table list"]')!;
      const second = [...explorer.querySelectorAll<HTMLButtonElement>("button")].find(item => item.getAttribute("aria-current") !== "true" && Object.values(fixture.responses).some(response => response.status === "ready" && response.projection.slots.current.definition?.title === item.title))!;
      check(second, "Fixture includes a second exact table");
      second.click(); second.click();
      await settle(() => requests === 1 && Boolean(container.querySelector('[data-working-cell="0"]')) && container.querySelectorAll('[role="tab"]').length === 2);
      check(maxInflight === 1, "Identical concurrent opens are deduplicated");
      const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      tabs[0].click(); await settle(() => tabs[0].getAttribute("aria-selected") === "true");
      tabs[1].click(); await settle(() => tabs[1].getAttribute("aria-selected") === "true");
      check(requests === 1, "Cached reopening makes no request");
      tabs[0].click(); await settle(() => tabs[0].getAttribute("aria-selected") === "true");
      const create = button("Create Working Calibration");
      if (create && !create.disabled) {
        create.click(); await settle(() => Boolean(button("WORKING")?.getAttribute("aria-pressed") === "true") || container.textContent?.includes("No changes yet") === true);
        const cell = container.querySelector<HTMLButtonElement>('[data-working-cell="0"]')!;
        cell.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
        await settle(() => Boolean(container.querySelector('input[name="workingCellValue"]')));
        tabs[1].click(); await settle(() => Boolean(container.querySelector('[role="alert"]')));
        check(tabs[0].getAttribute("aria-selected") === "true", "Pending direct input blocks tab changes");
        container.querySelector('input[name="workingCellValue"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await settle(() => !container.querySelector('input[name="workingCellValue"]'));
        check(container.querySelector('[data-working-cell="0"]')?.textContent?.includes(currentText?.replace(/^REF[^\n]*/, "") || "") !== false, "Cancelled input preserves Current");
      }
      const snapshots = Object.keys(localStorage).filter(key => key.includes(scope)).map(key => [key, localStorage.getItem(key)]);
      const beforeRestoreRequests = requests;
      root.unmount(); root = createRoot(container); root.render(createElement(StrictMode, null, createElement(Workspace, props)));
      await settle(() => container.querySelectorAll('[role="tab"]').length === 2 && Boolean(container.querySelector('[data-working-cell="0"]')));
      check(requests === beforeRestoreRequests, "Restoring initial active table does not fetch closed tabs");
      for (const [key, value] of snapshots) if (key?.startsWith("tunesight:working-calibration")) check(localStorage.getItem(key) === value, "Working replay does not mutate durable history");
      check(errors.length === 0, "Controlled shared-workspace browser console is clean: " + errors[0]);
      report("PASS R02 " + fixture.label + ": real StrictMode workspace, search, exact tabs, deduplicated/cached loading, plots, pending input and restoration; no subscriber data");
    } finally { root.unmount(); clear(); }
  }
  window.fetch = nativeFetch; console.error = originalError;
}
