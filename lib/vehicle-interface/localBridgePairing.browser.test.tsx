/** Controlled browser test entry, never imported by an application route.
 * Bundle with the existing Next webpack/TypeScript runtime and call this from an isolated test page.
 * Uses the actual workspace in React development StrictMode; no vehicle or subscriber data.
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import LiveTelemetryWorkspace from "../../components/LiveTelemetryWorkspace";
import { BRIDGE_PAIRING_CONTRACT, BRIDGE_TOKEN_LIFETIME_MS, BRIDGE_URL } from "./bridgePairingContract";

export async function runLocalBridgePairingUiTests(container: HTMLElement, report: (message: string) => void) {
  const originalFetch = window.fetch, originalQuery = navigator.permissions.query.bind(navigator.permissions);
  const token = "controlled-ui-token-at-least-32-characters";
  let mode = "success", active = 0, maximum = 0, pairs = 0, connects = 0, root: Root | undefined;
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const until = async (predicate: () => boolean) => {
    const deadline = performance.now() + 4000;
    while (!predicate()) { if (performance.now() > deadline) throw new Error("UI state did not settle"); await pause(10); }
  };
  const button = (label: string) => [...container.querySelectorAll("button")].find(b => b.textContent === label)!;
  const text = () => container.textContent ?? "";
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  navigator.permissions.query = async descriptor => descriptor.name === ("local-network-access" as PermissionName)
    ? { state: mode === "denied" ? "denied" : "granted" } as PermissionStatus : originalQuery(descriptor);
  window.fetch = async (input, init) => {
    const url = String(input); check(url.startsWith(BRIDGE_URL + "/v1/"), "Only loopback bridge requested");
    active++; maximum = Math.max(active, maximum);
    try {
      await pause(60);
      if (mode === "offline") throw new TypeError("Controlled offline bridge");
      if (url.endsWith("/pair")) {
        pairs++;
        if (mode === "old") return reply({ error: "authentication_failed" }, 401);
        if (mode === "untrusted") return reply({}, 403);
        return reply({ contract: BRIDGE_PAIRING_CONTRACT, token, expiresAt: Date.now() + BRIDGE_TOKEN_LIFETIME_MS });
      }
      check(new Headers(init?.headers).get("Authorization") === `Bearer ${token}`, "Vehicle routes require bearer");
      if (url.endsWith("/connect")) {
        connects++;
        if (mode === "no-vehicle") return reply({ error: "vehicle_discovery_timeout" }, 503);
        return reply({ session: { id: "controlled-ui-session", host: "loopback-fixture", identity: { dme: "Controlled fixture", vin: null, applicationSoftwareVersion: null, sparePartNumber: null, romSoftwareIdentity: null } }, channels: [] });
      }
      return reply({ state: "disconnected", samples: [] });
    } finally { active--; }
  };
  const mount = async (nextMode: string) => {
    root?.unmount(); await until(() => active === 0);
    mode = nextMode; maximum = 0; pairs = 0; connects = 0;
    root = createRoot(container);
    root.render(<StrictMode><LiveTelemetryWorkspace vehicle={{ id: "test-only", name: "Controlled pairing UI", description: "No subscriber data or vehicle", engineCode: "unqualified fixture" }} /></StrictMode>);
    await until(() => Boolean(button("Connect BMW")));
  };
  try {
    await mount("success");
    check(!container.querySelector('input[aria-label="Bridge token"]'), "Manual field must be hidden in normal flow");
    button("Connect BMW").click(); button("Connect BMW")?.click();
    await until(() => Boolean(button("Connect BMW")?.disabled) && text().includes("Read-only session established"));
    check(pairs === 1 && connects === 1 && maximum === 1, "StrictMode/probe/double click must share pairing and one connection");
    check(text().includes("Local bridge found"), "Successful discovery must be visible");
    check(!text().includes(token) && !container.innerHTML.includes(token), "Automatic token must not be rendered");
    report("PASS: actual StrictMode workspace, one probe + one connection, no overlapping requests, token hidden");
    button("Disconnect").click(); await until(() => text().includes("Disconnected. The next Connect"));
    report("PASS: authenticated disconnect and visible disconnected state");

    await mount("old"); await until(() => text().includes("Update TuneSight Bridge"));
    button("Advanced").click(); await until(() => Boolean(container.querySelector('input[aria-label="Bridge token"]')));
    const field = container.querySelector<HTMLInputElement>('input[aria-label="Bridge token"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, token);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    button("Connect BMW").click(); await until(() => text().includes("Read-only session established"));
    check(connects === 1 && maximum === 1, "Manual fallback must connect without overlapping probes");
    check(field.value === "", "Manual entry must clear after successful connection");
    report("PASS: older bridge upgrade message, Advanced manual fallback remains functional");

    for (const [scenario, expected] of [["offline", "bridge is not running"], ["denied", "Local Network Access denied"], ["untrusted", "Untrusted hosted origin"]]) {
      await mount(scenario); await until(() => text().includes(expected));
      check(!button("Connect BMW").disabled, "Failure must leave retry accessible");
      check(connects === 0 && maximum <= 1, "Failed probe must not access vehicle");
      report(`PASS: ${scenario} message and accessible retry`);
    }
    await mount("no-vehicle"); await until(() => text().includes("Local bridge found"));
    button("Connect BMW").click(); await until(() => text().includes("ENET cable/DME not found"));
    check(!button("Connect BMW").disabled, "DME failure must allow retry");
    report("PASS: bridge discovery remains distinct from missing ENET/DME");
  } finally {
    root?.unmount(); await until(() => active === 0);
    window.fetch = originalFetch; navigator.permissions.query = originalQuery;
  }
}
