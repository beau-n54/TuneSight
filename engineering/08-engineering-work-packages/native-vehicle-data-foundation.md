# Native Vehicle Data Foundation

**Status:** Founder-authorised bounded implementation; synthetic validation only; physical validation on hold.

## Ownership

Vehicle Interface owns read-only acquisition sessions, physical-adapter and transport observations, ECU endpoint observations, Channel Definition acquisition contracts and ordered Channel Observations. It reports observations. Vehicle Identity, Calibration, Evidence and Knowledge retain authority over qualified meaning.

Calibration Map Definitions and runtime Telemetry Channel Definitions remain separate contracts.

## Host and Transport Boundary

TuneSight's browser application shall not assume arbitrary USB, Bluetooth, serial or raw Ethernet access. Web Serial and WebUSB may be used only where a browser and adapter genuinely support them. The preferred Windows high-rate architecture is a bounded local companion or native bridge that owns physical transport and exposes an authenticated local read-only protocol. Ethernet/network adapters remain transport plugins behind that boundary. A desktop wrapper may host the same adapter contract.

## Read-Only Foundation

The first adapter interface exposes only discover, open, connect, identify, bounded read, stream and disconnect. It contains no coding, adaptation, DTC clearing, reset, actuator, programming, calibration-write or flashing method.

## Contracts

Sessions possess deterministic identity, immutable lifecycle revisions, explicit timestamps, terminal reasons/failures and provenance. ECU identity observations preserve observed DME/software/calibration/VIN and capability material without authoring Vehicle Identity or Calibration conclusions.

Channel Definitions preserve stable acquisition identity separately from decoding revision, applicability, datatype, qualified scaling, unit, expected rate and provenance. Channel Observations bind exact session and Channel Revision identities, ordered sequence, acquisition/source timing, raw values, qualified converted values, validity and provenance.

## Synthetic Validation

The deterministic read-only harness proves connect, synthetic DME identification, qualified synthetic RPM resolution, ordered RPM observations, unsupported-channel handling, transport failure and clean disconnect. It uses explicit timestamps and values with no clock or randomness.

This result is **SYNTHETICALLY VALIDATED** and **NOT PHYSICALLY VEHICLE-VALIDATED**.

## Direct Logging Readiness

Session and Channel Observation identities can form a future ordered native source suitable for durable recording and later WP-005 Evidence candidacy. This slice does not persist observations, establish Evidence, or begin WP-005.1.

## Physical Validation Hold

Future authority is required to select and implement a real adapter plugin, connect through a Windows host boundary, observe a BMW DME identity, qualify RPM, display live RPM, and validate failure/reconnect behavior. N54 and B58 are initial physical vectors, not permanent platform limits.

## Exclusions

No real vehicle transport, production UI, persistence, Diagnostics, DTC mutation, coding, adaptation, actuator control, programming, flashing, Calibration change or WP-005.1 work is included.
