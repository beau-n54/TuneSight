# Automatic local bridge pairing

Start the updated bridge on the same laptop with `npm run vehicle-bridge`, open
`https://tunesight-beta.vercel.app`, sign in and open a vehicle's Live Telemetry page.
The page probes the bridge, displays **Local bridge found**, and **Connect BMW**
pairs if needed before opening the existing read-only ENET session. Allow Local
Network Access for this trusted site if the browser prompts.

The safe default origins are exactly:

- `https://tunesight-beta.vercel.app`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

An explicitly set `TUNESIGHT_BRIDGE_ALLOWED_ORIGINS` replaces those defaults.
It must contain exact HTTPS origins or loopback HTTP development origins, separated
by commas, without trailing slashes or paths. No wildcard or public bridge is allowed.
The Node workflow and optional local `TUNESIGHT_ENET_HOST` remain supported.

## Pairing and compatibility

`GET http://127.0.0.1:57631/v1/pair` requires `Content-Type: application/json`, forcing
a browser CORS preflight. The server checks its actual loopback listener, peer,
single exact Host and Origin headers and the validated origin allowlist before
returning `tunesight.bridge-pairing.v1`, a token and its expiry. Responses use
`Cache-Control: no-store`. The endpoint performs no vehicle discovery or DME request.

Tokens last at most 15 minutes; pairing renews near expiry. The page renews as needed
and retries an authenticated request once only after a pre-operation 401. Tokens
live in bridge/page memory only: no URL, cookie, storage, cloud environment or log.
The new CLI no longer reads `TUNESIGHT_BRIDGE_TOKEN` or prints tokens.
Connect, sample, disconnect and status still require the valid bearer token.
The existing read-only operation and identity boundaries remain unchanged.

The **Advanced** manual field supports an older bridge with a locally supplied token.
It is hidden by default. An older bridge with no compatible pairing endpoint shows
**Update TuneSight Bridge** when its response can be read. Restart it from the updated
checkout; no installer or tray application is included here.

Local Network Access is enforced by the browser. Legacy Private Network Access
preflight headers are supported only for approved origins. The server cannot prove
browser permission from a caller-supplied header. Exact Origin checks protect the
browser boundary; a malicious local process can forge HTTP headers and is outside
this pairing trust boundary. Approved web origins can pair; this does not establish
a separate Supabase identity at the bridge.

Browsers intentionally hide details of failed CORS requests. A confirmed permission
denial has a specific message; an unreadable request states that an offline bridge,
denied permission or an untrusted origin cannot be distinguished. A bridge found
with no cable/DME response is reported separately. Do not disable browser security
or expose the bridge to work around a failure.

## Validation

Run `node --experimental-strip-types --test lib/vehicle-interface/*.test.ts`,
`npx tsc --noEmit --incremental false`, changed-file ESLint and `npm run build`.
For the actual React workspace's seven controlled browser assertions, run
`node scripts/verifyBridgePairingUi.mjs` and open the printed loopback URL. Expect
seven PASS messages and COMPLETE; stop the test server with Ctrl+C. The harness
uses development Strict Mode, mock HTTP/permission outcomes and no subscriber data.

At the car, confirm discovery and connection from the authenticated hosted origin
without opening Advanced, allow the browser's real Local Network Access prompt,
check all selected channels and recording/export, disconnect/reconnect, and verify
renewal during a session exceeding 15 minutes. Also check denied permission and
bridge-stopped recovery. Hosted physical acceptance remains a separate observation;
controlled tests do not substitute for it. Manual fallback remains until that passes.

## Windows desktop beta

The packaged Windows bridge reuses this pairing contract and the same read-only diagnostic implementation. See [Windows bridge installation, security and release process](windows-bridge.md). The Node workflow remains available for engineering use. The unsigned installer is a Founder draft until clean installation and hosted-to-car acceptance pass.
