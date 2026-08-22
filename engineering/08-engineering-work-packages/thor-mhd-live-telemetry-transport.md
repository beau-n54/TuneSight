# THOR/MHD Live Telemetry Transport

**Status:** Externally researched and synthetically validated; both owned physical adapters remain unverified.

## Evidence boundary

The owned adapters are identified by manufacturer/product profile, network behaviour and protocol evidence—not colour. THOR's WiFi dongle is strongly evidenced as a D-CAN serial bridge at `192.168.4.1:23`. The orange MHD generation is documented as the `MHD CAN` WiFi profile and as distinct from the black `MHD ENET` profile. Its IP address, socket port and framing are not publicly established strongly enough for implementation.

Sources: MHD's [official adapter page](https://mhdtuning.com/pages/mhd-wireless-adapter), [MHD user guide](https://data.mhdtuning.com/downloads/MHD%20User%20Guide.pdf), [BimmerCode connection guide](https://bimmercode.app/manual/), [BimmerGeeks THOR listing](https://www.bimmergeeks.net/product-page/protool-thor-xhp-wifi-adapter), and secondary THOR endpoint evidence from [BMW Klub Polska](https://www.bmwklubpolska.pl/forum/topic/173014-n47-m47-aplikacja-android-diagnostyka-dpf-i-wi%C4%99cej/page/203/).

Neither owned profile has established B58/ENET capability. Available evidence instead identifies both as CAN-era/E-series profiles; the BimmerGeeks listing specifically reports that MHD Flasher with THOR does not work for B58. Physical B58 success must not be assumed.

## Shared transport and Windows boundary

Both profiles can share an adapter-neutral WiFi serial-transport interface, while endpoint, discovery and framing remain profile-specific. They do not yet share a proven wire implementation. The web UI communicates only with a local Windows Vehicle Bridge. The bridge owns adapter discovery, allowlisted socket access, connection/session state, bounded read-only channel requests, health, timeout and disconnect.

The bridge binds to loopback, requires explicit TuneSight session association, validates an exact adapter-profile revision, accepts only profile endpoints and qualified Channel Revision identities, and imposes payload/channel/sample limits. It exposes no arbitrary socket, host/port, diagnostic-payload or LAN-wide proxy.

## BMW protocol and channel qualification

THOR and orange MHD evidence indicates K+DCAN/CAN transport for the initial N54 vector. Exact DME identity, RPM and pressure request bytes, response layouts and rates remain unverified and are deliberately absent. B58 typically requires an ENET-capable path; neither owned adapter is presently qualified for it.

A real Channel Definition may be admitted only from an exact DME/software applicability binding plus governed request/service identity, response layout, datatype, scaling, unit, rate and provenance. XDF Calibration Definitions are not runtime Channel authority.

Pressure is preserved canonically as kPa with deterministic bar/psi presentation conversion. Actual absolute charge pressure, requested/target absolute charge pressure, ambient absolute pressure and relative boost remain separate semantics. Relative boost may be derived only from qualified pressure sources; no atmospheric constant is assumed.

## Synthetic proof and physical hold

The deterministic proof streams RPM, actual absolute charge pressure and a separately identified target pressure channel with common acquisition timestamps, exact Channel Revision identities, ordered samples, failure handling and clean disconnect. These are synthetic values and synthetic protocol identities only.

Independent THOR and MHD physical gates each require: prepare Windows; attach adapter to OBD; join its verified WiFi; observe discovery/endpoint/framing; open bridge; establish a read-only session; identify the DME; qualify exact RPM and actual pressure channels; display live values; observe safe response; disconnect; reconnect; and validate failure handling. Packet capture must confirm endpoint, framing, timing and any handshake. The MHD endpoint and both adapters' owned firmware/SSID must be recorded. B58 requires an independently proven ENET-capable adapter path if these devices fail capability qualification.

Multi-channel observations remain suitable for a later ordered native recording and WP-005 Evidence candidate. No persistence, production UI, Diagnostics, DTC clearing, coding, programming, flashing, WP-005.1 or physical-validation claim is included.
