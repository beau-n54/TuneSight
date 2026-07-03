
# Intelligence Subsystem

Version:
Engineering Blueprint V2

Status:
🟢 Verified (Production Core)

Document:
03_Subsystem_Intelligence.md

Last Updated:
30 June 2026

Owner:
Intelligence Engine

Primary Responsibility:
Transform translated log data into engineering conclusions, diagnostic reasoning, candidate rankings and calibration intelligence.

---

# Purpose

The Intelligence Subsystem is responsible for converting a platform-independent Parsed Log into engineering knowledge.

It is the reasoning layer of TuneSight.

The subsystem begins after the Logging Subsystem has produced a Parsed Log and ends when structured diagnostic results are returned to the Application Layer.

---

# Current Verified Architecture

The current production implementation has been verified through source-code inspection.

Version 5 migration modules are documented separately until fully integrated.

Current production implementation:

```text
Parsed Log
    ↓
lib/analysis/
    ↓
Analysis Engine
    ↓
Evidence Collection
    ↓
Root Cause Engine
    ↓
Candidate Ranking
    ↓
Cross Reference
    ↓
Narrative Output
```

Supporting production utilities:

```text
lib/diagnostics/
```

Version 5 migration layer:

```text
lib/intelligence/
```

---

# Current Implementation

## Production Core

Status:

🟢 Production

Current owner:

`lib/analysis/`

Verified responsibilities:

- Analysis orchestration
- Validation
- Event routing
- Root cause reasoning
- Candidate ranking
- Tune profile generation
- Shared analysis types

This is the active production intelligence engine.

---

## Supporting Utilities

Status:

🟢 Production Support

Current owner:

`lib/diagnostics/`

Verified responsibilities:

- Diagnostic grouping
- Historical diagnostic generation
- Display support

These utilities support presentation and history.

They do not perform diagnostic reasoning.

---

## Migration Layer

Status:

🟡 Partially Integrated

Current owner:

`lib/intelligence/`

Purpose:

Provide a future abstraction layer for TuneSight intelligence by combining translated logger information and tune-profile intelligence.

Current state:

- Structure verified.
- Internal dependencies verified.
- Full production integration not yet verified.

Because these files were created during the recent Version 5 architecture migration, they should be treated as migration architecture rather than mature production ownership.

---

# Responsibilities

The Intelligence Subsystem owns:

- Analysis
- Evidence evaluation
- Root cause generation
- Candidate ranking
- Confidence modelling
- Narrative generation
- Calibration intelligence
- Cross-reference generation

It does not own:

- CSV parsing
- Logger translation
- File uploads
- Dashboard rendering
- Database persistence

---

# Data Flow

```text
Parsed Log
    ↓
Analysis Engine
    ↓
Evidence
    ↓
Root Cause Engine
    ↓
Candidate Ranking
    ↓
Cross Reference
    ↓
Narrative
    ↓
Application Layer
```

---

# Dependencies

Depends on:

- Logging Subsystem
- Parsed Log
- Vehicle metadata
- Tune metadata

Consumed by:

- Application Subsystem
- Analysis page
- Dashboard
- Future AI services

---

# Implementation Status

Production

🟢 lib/analysis

Production Support

🟢 lib/diagnostics

Migration

🟡 lib/intelligence

# Technical Health

Production Core:

🟢 Stable

Migration Status:

🟡 In Progress

Findings:

- lib/analysis is the verified production intelligence engine.
- lib/diagnostics provides supporting utilities.
- lib/intelligence is a migration layer introduced during Version 5 and is not yet fully integrated.

---

# Technical Debt

Current priorities:

- Continue expanding root cause coverage.
- Continue expanding evidence relationships.
- Complete integration of lib/intelligence.
- Review rootCauseEngine.ts for future modularisation after the Lib audit is complete.

No deletion decisions should be made until the entire lib subsystem audit is complete.

---

# Future Direction

Version 5 continues to separate responsibilities into clearer subsystem boundaries.

Target architecture:

- Logging translates.
- Analysis reasons.
- Diagnostics supports presentation.
- Intelligence becomes the high-level abstraction layer once migration is complete.

---

# Engineering Rules

- Every diagnosis begins with evidence.
- Root causes compete.
- Candidate ranking prioritises.
- Cross Reference explains calibration.
- Narrative explains results.
- Logging never performs reasoning.
- Intelligence never performs translation.

---

This document represents the git status as of the latest engineering audit.

Historical audit progression is maintained in:

`docs/Audit/Audit_Log.md`
