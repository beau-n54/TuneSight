# TuneSight Bridge for Windows — Founder beta

Version: **0.1.0-beta.1**. Protocol: **1**. Minimum hosted bridge client: **1**.

This is an **unsigned draft beta**, not a subscriber-ready release. Public download promotion requires a verified installer, signing, clean-user installation evidence and Founder acceptance of the entire hosted TuneSight → installed bridge → ENET → DME → gauges path. The public release feed intentionally has `latest: null` until then.

## Packaging decision

A small C# WinForms notification-tray host supervises the existing TypeScript bridge under a bundled, checksum-verified Node.js 24.14.1 x64 runtime. Inno Setup 6.7.3 builds the per-user installer. This avoids shipping another web browser or implementing a second diagnostic stack. The host contains Windows lifecycle, network enumeration, update notification and safe diagnostics only; DME services and conversions remain in `scripts/tunesightVehicleBridge.ts` and its existing dependencies.

Supported beta target: Windows x64, Windows 10 build 19041 or newer / Windows 11 with its included .NET Framework 4.8. A maintained Windows release is recommended. No Node.js, Git, npm, terminal, manually entered host address or pairing token is needed by subscribers. Developer build scripts still require the repository's toolchain.

The Node executable and archive are pinned to official SHA-256 values; the build also verifies its OpenJS Authenticode publisher. This signature covers Node, **not** TuneSight. The build verifies the official Inno installer digest/publisher and pins the extracted compiler binaries. Inno's bundled license permits commercial use and must be preserved; its compiler prints a commercial-license reminder. No signing or paid license credential is included in source.

## Install and daily use

1. Obtain the Founder draft installer and its `SHA256SUMS.txt` from the same reviewed release. Compare the checksum before testing. A checksum is integrity evidence, not a publisher signature.
2. Run the installer as the intended Windows user. It installs under `%LOCALAPPDATA%\Programs\TuneSight Bridge`, without an administrator prompt under normal account policy.
3. Leave **Start TuneSight Bridge with Windows** checked (default). The completion screen starts the bridge. Silent validation installs intentionally skip that launch and start it explicitly.
4. Connect direct ENET between laptop Ethernet and BMW OBD. Turn on ignition. Windows must obtain a link-local `169.254.x.x/16` address automatically. Wait for Windows address assignment if necessary; TuneSight never sets a static address or changes routes/firewall rules.
5. Open hosted TuneSight, select the vehicle's Live Telemetry page and press **Connect BMW**. Allow Local Network Access for the exact trusted TuneSight origin if the browser asks. The existing in-memory automatic pairing flow supplies the credential.
6. Check observed DME and channel support. An expected offline ROM is never presented as observed identity. Actual acquisition timestamps, read-only gauges, recording and JSON export retain their existing contracts.

Wi-Fi may remain connected for internet. The host enumerates only operational Ethernet interfaces; automatic discovery admits link-local IPv4 candidates, binds UDP to each candidate and uses that local address for the resulting TCP connection. HSFZ type `0x11` discovery replies are transport candidates, not DME identity evidence. DME support still requires a response from logical endpoint `0x12`. VPNs, static/private IPv4-only Ethernet, IPv6-only setups and unusual virtual-adapter arrangements are not silently reconfigured or claimed as qualified. Their physical compatibility requires separate validation.

## Tray actions and status meaning

- **Bridge ready**: the loopback HTTP listener is running; this says nothing about the car.
- **ENET cable not detected**: no operational Ethernet candidate is reported by Windows.
- **Ethernet ready; ENET verified on Connect BMW**: operational link-local Ethernet exists, not proof that the cable reaches a BMW.
- **Unsupported ENET network condition**: no supported address or adapter information, or transport interface failure. Wait for automatic address assignment, then retry; contact support if it persists.
- **DME not connected**: no current observed DME session.
- **Vehicle ignition/DME not responding**: a connection/read attempt failed. Check cable and ignition.
- **DME connected**: the existing read-only protocol observed supported DME responses.
- **Browser permission: check TuneSight page**: the desktop cannot know that a browser blocked a request before it reached loopback. Only the page can show a positively observed **Local Network Access denied** state. Unknown CORS/network failures are not mislabelled as permission denial.
- **Port already occupied**: another process owns port 57631. The application does not stop it, change ports or expose another listener.
- **Update TuneSight Bridge**: the page rejects incompatible protocol or minimum-hosted metadata. Reload hosted TuneSight and review the bridge download area. A legacy pairing-v1 Node bridge remains usable and is explicitly distinguished from a desktop installation.

Open TuneSight opens the fixed HTTPS dashboard. Restart Bridge shuts down this application's child, creates a fresh bridge and rotates its in-memory credential; the browser's existing one-time 401 renewal handles restart. Check for Update reads only the fixed hosted release feed, with HTTPS, no redirects and bounded time/response size. It never silently downloads or executes an installer. Start with Windows controls only this user's TuneSight Run entry. Quit stops this app and its supervised child. A Windows job object terminates that child if the host exits unexpectedly. A per-user session mutex prevents duplicate hosts; the fixed loopback port also prevents another session from obtaining a second active bridge.

## Security and diagnostics

The packaged profile has fixed origins: `https://tunesight-beta.vercel.app`, `http://localhost:3000`, `http://127.0.0.1:3000`. It ignores developer `TUNESIGHT_*` overrides and strips inherited `NODE_*` injection settings from the child. Pairing still requires the actual listener and peer to be `127.0.0.1`, exact Host and Origin, and the existing CORS/preflight rules. Connect, sample, status and disconnect require a valid bearer. Tokens last 15 minutes and are renewed in page memory. No token is written to a URL, environment variable, log, cookie, persistent browser store or cloud service. No unauthenticated shutdown route is added. Native shutdown uses a current-user ACL-protected Windows event, outside the HTTP API.

No flash, coding, DTC clear, adaptation, actuator or arbitrary proxy route exists. The wrapper does not expand the read-only request allowlist. No tunnel, public bind, remote-control endpoint, firewall exception or network-setting change is installed.

Diagnostic Logs opens `%LOCALAPPDATA%\TuneSight\Bridge\Logs`. Logs rotate at 256 KiB with one preceding file. They contain UTC time, app/protocol/minimum-hosted versions and allowlisted state/error categories. Child exceptions and stderr are discarded rather than persisted. No VIN, exact host address, adapter name/MAC, vehicle sample, bearer or request body is logged. Export Diagnostic Report lets the user save those categories with the source commit, Node version and current state. It does not automatically upload anything. Uninstall retains these bounded support logs; the user may remove them when no longer needed.

## Repair, upgrade, uninstall and rollback

Re-running the installer performs an in-place repair. Later versions must keep the same AppId and installation directory. The installer requests graceful shutdown through the installed host before replacing its private files; it fails rather than killing an unrelated process. The uninstaller does the same and removes the executable, runtime, shortcuts and startup registration. Use Windows **Installed apps → TuneSight Bridge → Uninstall** or the Start-menu uninstaller.

For rollback, stop the bridge, uninstall the rejected beta and install the last approved checksum-verified package. Do not copy an older executable over a newer runtime. There is no cloud/vehicle database migration to reverse. Keep the public feed at the last accepted release; a source rollback must receive normal Founder authority and must not rewrite Git history. Same-version repair can be automated; cross-version upgrade and rollback require two actual versioned artifacts and remain in the Founder checklist.

## Build and release

From a clean committed checkout on Windows:

```powershell
npm ci
node --experimental-strip-types --test lib/vehicle-interface/*.test.ts
npx tsc --noEmit
# Run focused lint for every changed TS/TSX/MJS file.
npm run build
./scripts/build-windows-bridge.ps1 -OutputDirectory "$env:TEMP/TuneSight-Bridge-release"
./scripts/test-windows-bridge.ps1 -Installer "$env:TEMP/TuneSight-Bridge-release/artifacts/TuneSight-Bridge-0.1.0-beta.1-windows-x64-setup.exe" -InstallDirectory "$env:LOCALAPPDATA/TuneSight-Bridge-test"
```

Use a new output directory each time. `-AllowUncommitted` is restricted to development validation and marks artifact provenance as uncommitted; never distribute that artifact as the accepted source release. The final draft must be rebuilt from the clean commit. The build creates an installer, SHA256SUMS and a release manifest including source SHA, version, protocol, bundled Node version, size, digest and unsigned/pending-physical flags. Generated binaries stay outside Git.

`.github/workflows/windows-bridge-beta.yml` runs only by explicit workflow dispatch from main. Tests, type-check, focused lint, whitespace, production web build and installer smoke checks precede artifact upload or draft creation. It will not overwrite an existing release. CI uses an explicitly non-routable build-only Supabase URL and placeholder public key for prerender/compilation, and never deploys that web output. The real production web build is separately validated with the existing deployment configuration; no subscriber credentials are copied into GitHub. Missing build prerequisites fail the job, not the gate. The controlled React StrictMode browser harness is `node scripts/verifyBridgePairingUi.mjs` and must report all eleven PASS scenarios during local review. Real browser LNA and the car path are separate acceptance evidence.

The initial release is always **draft + prerelease**, unsigned, and absent from the public feed. To promote a later public installer: provision a genuine Windows code-signing certificate or managed signing service outside Git; sign the host, installer and uninstaller through a reviewed release process; verify Authenticode and timestamps; recompute the published installer hash after signing; complete physical acceptance; then review a feed change with the exact public artifact URL/version/hash/size and signed/physical-validation flags. The current pipeline does not pretend to implement a signing service before one is configured. Never commit a certificate, private key or password. SmartScreen reputation may still be new even for a signed build; record actual prompts rather than claiming immunity. Do not disable Windows protections.

## Founder acceptance checklist

Record Windows build, browser/version, installer SHA and outcome for each step. Keep the car stationary for connection/setup checks.

1. Use a clean standard Windows user or clean machine without Node, Git or npm. Install normally; confirm no admin/terminal requirement, startup default selected and bridge launches after completion. Record any SmartScreen/antivirus prompt; do not treat a silent CLI install as this evidence.
2. Confirm the tray icon and every menu action, readable states, diagnostic export and no credentials/VIN/IP in the report. Toggle startup off/on. Sign out and sign in (or reboot) to prove actual startup. Launch the shortcut twice and confirm one bridge listener.
3. With ENET unplugged, observe the cable state and a clear Connect failure. Plug in ENET with ignition off and distinguish Ethernet discovery from absent DME. Turn ignition on; allow automatic address assignment without entering an IP.
4. Keep Wi-Fi internet active. Open hosted Live Telemetry, grant LNA when prompted, press Connect BMW and confirm automatic pairing with no manual token. Exercise denial and later re-allow through normal browser controls. The tray should not claim it observed a browser-only denial.
5. Confirm the observed DME endpoint, unchanged exact-ROM limitation, qualified channels, current gauge values, axes and actual sample timestamps. Record/export a short and a longer eleven-gauge session; compare cadence, drops and timing to the accepted telemetry baseline. Do not infer extra samples.
6. Keep a session open beyond 15 minutes; verify renewal without repeated connection requests. Restart through the tray; reconnect and confirm the old credential is invalid. Unplug cable and restore it; check truthful failure/recovery without inferred data.
7. Check for updates with internet available and unavailable. No unreviewed executable should run. Test an incompatible-version fixture only in a controlled environment; the page must say Update TuneSight Bridge.
8. Quit, repair by rerunning the installer, and confirm startup preference. Once a second real beta exists, perform upgrade and rollback and check one Installed apps entry. Test port conflict with a controlled listener; the app must not terminate it.
9. Uninstall. Confirm no bridge process/listener/startup entry remains, and that only documented support logs are retained. Reinstall and repeat hosted-to-car connection.

Clean-user setup, actual logon, browser permission prompts, cross-version updates, Wi-Fi-plus-physical-ENET routing and the complete car path remain explicit acceptance gates. Passing controlled transport, UI or installer tests alone does not make this subscriber-ready.

## References

- [Microsoft NotifyIcon](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.notifyicon)
- [Inno per-user privileges](https://jrsoftware.org/ishelp/topic_setup_privilegesrequired.htm), [Inno license](https://jrsoftware.org/files/is/license.txt)
- [Official pinned Node checksums](https://nodejs.org/download/release/v24.14.1/SHASUMS256.txt)
- [Scapy HSFZ implementation](https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/bmw/hsfz.py): identification is transport evidence, not exact ROM qualification.
- [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access)
