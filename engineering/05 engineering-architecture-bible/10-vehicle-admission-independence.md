This document forms part of TuneSight's Engineering Governance Framework.

**Authority:** Founder architectural clarification extending Vehicle Identity and Cross-Domain Engineering Contracts

**Status:** Founder Ratified under TS-RAT-023

# Vehicle Admission and Capability Independence

## Controlling Rule

Vehicle/platform admission must not depend on exact-ROM Calibration coverage. TuneSight admits a legitimate current-system identity only to the highest confidence supported by Vehicle Identity evidence. Every product capability remains independently fail-closed until its own authoritative dependencies are qualified.

Unknown is not unsupported. Unknown preserves insufficient authority and limits only the capabilities that require the missing truth.

## Identity Admission

Vehicle Identity may publish exact vehicle identity, chassis/platform, engine family, ECU/DME family, exact ROM/software, ROM family, a newly observed ROM revision and unresolved fields. Each field retains its own evidence, qualification and conflict state. A partial identity preserves established fields and does not fabricate unresolved ones.

A vehicle is admitted when exact vehicle identity or qualified platform-and-engine identity establishes legitimacy without conflict. Conflicting or insufficient identity remains rejected. An observed but previously unknown ROM cannot invalidate an otherwise established vehicle/platform identity.

## Independent Capability Envelope

The capability envelope communicates, without transferring authority:

- `VEHICLE_WORKSPACE` from Vehicle Identity admission;
- `ANALYSIS` from qualified log/evidence-source requirements;
- `TELEMETRY` from qualified transport, ECU identity, diagnostic services, addresses, Channels and conversion;
- `CALIBRATION_VIEW` from exact qualified Definition applicability;
- `CALIBRATION_EDIT` from VIEW plus independent EDIT authority;
- `CALIBRATION_RECONSTRUCT` from EDIT plus exact source and reconstruction authority;
- `CALIBRATION_EXPORT` from reconstruction plus checksum/integrity authority; and
- `FLASH` from separately qualified transport, write, recovery and safety authority.

No available capability grants another. Calibration XDF coverage is not telemetry authority. Vehicle admission is not Calibration, Analysis, telemetry, Export or Flash authority.

## Calibration Resolver Boundary

The Master Calibration Resolver answers only what Calibration capability TuneSight can responsibly provide for an observed binary/ROM. `ROM_RECOGNIZED_DEFINITIONS_UNAVAILABLE`, `ROM_UNKNOWN`, candidate coverage, conflict and invalid-binary outcomes retain their existing Calibration meanings. They do not decide whether the vehicle may exist in TuneSight.

Unknown legitimate ROM evidence remains retained as discovery evidence. It grants no addresses, guessed Definitions, XDF applicability, EDIT, reconstruction, Export or Flash capability and never invokes Development Preview fallback.

## Progressive Convergence

Acquired XDF candidacy does not grant capability. Qualification progresses independently: XDF/applicability to VIEW; EDIT authority to EDIT; exact source/reconstruction authority to RECONSTRUCT; checksum/integrity authority to EXPORT; and transport/write/recovery authority to FLASH.

## Compatibility

This clarification is prospective and additive. It preserves all historical ratifications, exact qualified relationships, Current/Working Calibration, quarantine, acquired-XDF governance, checksum fail-closed behavior, locked Export and unqualified Flash. It does not weaken any evidence standard or authorise Live Telemetry, public XDF upload, DME writes or flashing implementation.
