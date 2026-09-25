// Encoding/whitespace gate covers the complete Windows bridge release source package.
import fs from "node:fs";
const paths = [
  ".github/workflows/windows-bridge-beta.yml",
  "app/bridge/page.tsx",
  "components/BridgeDownload.tsx",
  "components/LiveBridgeControls.tsx",
  "desktop/bridge/BETA-NOTICE.txt",
  "desktop/bridge/TrayApplication.cs",
  "desktop/bridge/app.manifest",
  "desktop/bridge/desktopBridge.ts",
  "desktop/bridge/installer.iss",
  "docs/windows-bridge.md",
  "docs/vehicle-bridge-pairing.md",
  "lib/vehicle-interface/bridgeVersion.ts",
  "lib/vehicle-interface/bridgeRelease.ts",
  "lib/vehicle-interface/enetDiscovery.ts",
  "lib/vehicle-interface/desktopBridge.test.ts",
  "lib/vehicle-interface/bridgePairing.test.ts",
  "lib/vehicle-interface/localBridgeClient.ts",
  "lib/vehicle-interface/localBridgePairing.browser.test.tsx",
  "scripts/tunesightVehicleBridge.ts",
  "scripts/verifyBridgePairingUi.mjs",
  "scripts/build-windows-bridge.ps1",
  "scripts/test-windows-bridge.ps1",
  "scripts/verifyWindowsBridgeSources.mjs",
  "public/bridge/releases.json"
];
for (const path of paths) {
  const bytes = fs.readFileSync(path);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.includes("\uFFFD")) throw new Error(`${path}: replacement character`);
  if (text.split(/\r?\n/).some(line => /[ \t]+$/.test(line))) throw new Error(`${path}: trailing whitespace`);
  if (!text.endsWith("\n")) throw new Error(`${path}: missing final newline`);
}
console.log(`PASS: ${paths.length} release files decode as UTF-8 and pass new/tracked-file whitespace checks`);
