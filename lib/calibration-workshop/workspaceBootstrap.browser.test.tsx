/** Controlled native-browser tests only; synthetic fixtures, no subscriber storage. */
import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import Bootstrap from "../../app/dashboard/vehicles/[id]/calibration/workspace-bootstrap-client";
import { workspaceUiKey, serializeWorkspaceUi } from "./workspaceRestoration";
import { createWorkspaceTab } from "./workspaceTabs";
import type { WorkspaceBrowserFixture } from "./sharedWorkspace.browser.test";

export async function runBootstrapBrowserTests(container: HTMLElement, fixtures: WorkspaceBrowserFixture[], report: (value: string) => void) {
  const originalFetch = window.fetch;
  const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
  const settle = async (predicate: () => boolean) => {
    const deadline = performance.now() + 10000;
    while (!predicate()) { if (performance.now() > deadline) throw Error("Bootstrap UI timeout"); await new Promise(requestAnimationFrame); }
  };
  for (const fixture of fixtures) {
    const { context, workshop, evidence, vehicle } = fixture.props;
    const scope = workspaceUiKey(context, workshop, "adaptive");
    const second = workshop.definitions.find(d => d.key !== evidence.projection?.selection.key && fixture.responses[d.key]?.status === "ready")!;
    const tab = createWorkspaceTab({ ...second, definitionKey: second.key, datasetRevision: workshop.source.currentDatasetRevision });
    const saved = serializeWorkspaceUi(scope, { workspace: { tabs: [tab], activeId: tab.id }, search: "", navigationMode: "all", system: null,
      evidenceFilter: "all", displayMode: "current", panels: { explorerCollapsed: false, inspectorCollapsed: false, focusWorkspace: false } });
    let requests = 0, fail = false;
    let root = createRoot(container);
    try {
      localStorage.setItem(scope, saved);
      window.fetch = async (_url, init) => {
        requests++;
        const request = JSON.parse(String(init?.body));
        check(request.kind === "workspace", "Restored selection must not trigger a second projection request");
        check(request.hints.length === 1 && request.hints[0].selection.key === second.key, "Exact hint precedes session materialisation");
        if (fail) return Response.json({ error: "Unavailable" }, { status: 503 });
        const selected = fixture.responses[second.key];
        check(selected.status === "ready", "Controlled restored projection exists");
        return Response.json({ status: "ready", context, workshop: { ...workshop, selectedDefinitionKey: second.key },
          evidence: { ...evidence, projection: selected.status === "ready" ? selected.projection : null } },
        { headers: { "Cache-Control": "private, no-store", "Server-Timing": "session;dur=10" } });
      };
      const props = { vehicle, upload: null, manifest: { ownerScope: context.ownerId, vehicleId: context.vehicleId } };
      root.render(createElement(StrictMode, null, createElement(Bootstrap, props)));
      await settle(() => container.querySelector('[data-calibration-interactive="true"]') !== null);
      check(requests === 1, "Strict Mode and restoration use one bootstrap request");
      check(container.querySelector('[aria-label="Explorer table list"] [aria-current="true"]')?.getAttribute("title") === second.title, "Restored Table is interactive");
      check(container.querySelector('[data-working-cell="0"]'), "Grid is ready before completion");
      check(container.querySelector('[data-calibration-cache-policy]')?.getAttribute('data-calibration-cache-policy') === 'private, no-store', "Actual response policy observed");
      root.unmount();
      root = createRoot(container);
      fail = true;
      root.render(createElement(StrictMode, null, createElement(Bootstrap, props)));
      await settle(() => container.querySelector('[role="alert"]') !== null);
      check(!container.querySelector('[data-working-cell]'), "Failed bootstrap does not expose stale Grid");
      fail = false;
      [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Retry')!.click();
      await settle(() => container.querySelector('[data-calibration-interactive="true"]') !== null);
      check(requests === 3, "One failed request and one explicit retry, no overlap");
      root.unmount();
      root = createRoot(container);
      let releaseOld!: (response: Response) => void;
      let oldSignal: AbortSignal | null | undefined;
      let started = false;
      window.fetch = async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        if (request.vehicleId === context.vehicleId) {
          oldSignal = init?.signal;
          started = true;
          // Ignore abort deliberately, modelling a response already in flight.
          return new Promise<Response>(resolve => { releaseOld = resolve; });
        }
        return Response.json({ status: "unavailable", code: "VEHICLE_UNAVAILABLE", finding: "New vehicle unavailable" }, { status: 409 });
      };
      root.render(createElement(StrictMode, null, createElement(Bootstrap, props)));
      await settle(() => started);
      root.render(createElement(StrictMode, null, createElement(Bootstrap, { ...props,
        manifest: { ...props.manifest, vehicleId: "new-vehicle" }, vehicle: { ...vehicle, id: "new-vehicle" } })));
      await settle(() => container.textContent?.includes("New vehicle unavailable") === true);
      check(oldSignal?.aborted, "Identity change aborts the previous request");
      releaseOld(Response.json({ status: "ready", context, workshop, evidence }));
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      check(container.textContent?.includes("New vehicle unavailable") && !container.querySelector('[data-working-cell]'), "Late old identity cannot publish a stale workspace");
      report(`PASS bootstrap ${fixture.label}: exact restored selection, Strict Mode single request, no duplicate projection, truthful readiness, failure/retry, aborted/stale response rejection`);
    } finally { root.unmount(); localStorage.removeItem(scope); window.fetch = originalFetch; }
  }
}
