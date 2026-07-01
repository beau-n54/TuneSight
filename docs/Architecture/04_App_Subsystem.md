# Application Subsystem

Version: Engineering Blueprint V2

Status:
🟢 Verified

Document:
04_App_Subsystem.md

Last Updated:
30 June 2026

Owner:
Application Layer

Audit Sprint:
Sprint 1

Primary Responsibility:
Provide the user interface, application routes, API endpoints, and orchestration between the user and the core TuneSight subsystems.

Verification Method:

✔ Entire app/ directory inspected

✔ Route structure verified

✔ API routes verified

✔ Dashboard pages inspected

✔ Major files analysed

---

# Purpose

The Application Subsystem is responsible for exposing TuneSight functionality to the user.

It provides:

- Next.js routing
- Dashboard pages
- Vehicle pages
- Authentication pages
- Upload workflows
- API endpoints
- UI orchestration

The Application Subsystem does not own engineering intelligence.

Its responsibility is to coordinate the Logging and Intelligence subsystems while presenting information through the user interface.

---

# Architecture

```
User

↓

Application Layer

↓

Logging Subsystem

↓

Intelligence Subsystem

↓

Database

↓

Application Layer

↓

User
```

The Application Layer orchestrates the flow of information but should not become the permanent owner of reusable engineering logic.

---

# Responsibilities

The Application Subsystem owns:

- Route definitions
- Dashboard navigation
- Vehicle pages
- Authentication pages
- Upload pages
- API endpoints
- UI orchestration
- Data fetching
- User interaction

The Application Subsystem does not own:

- CSV translation
- Diagnostic reasoning
- Root Cause analysis
- Candidate Ranking
- Cross Reference logic
- Tune intelligence
- Reusable engineering algorithms

---

# Verified Route Areas

The following route groups were verified during Sprint 1.

## Public

- Home
- Login
- Signup

---

## Dashboard

- Dashboard
- Garage
- Vehicle Overview
- Vehicle Edit
- Vehicle Logs
- Vehicle Tune
- Vehicle Analysis

---

## API

Verified API endpoints include:

- Vehicle update
- Log upload
- Tune upload
- ROM Library

---

## Supporting Routes

The following routes remain part of the application and require future dependency verification before any removal.

- Logs
- Mods
- Vehicle
- Checkout
- Account

These routes should not be deleted until usage has been verified.

---

# Major Verified Files

## analysis/page.tsx

Status:

🟧 Important

Approximate Size:

2600+ lines

Purpose:

Primary analysis dashboard.

Current responsibilities include:

- Data loading
- Analysis rendering
- Legacy compatibility
- Cross Reference display
- Tune reasoning
- Helper functions
- UI rendering

Assessment:

This file currently owns multiple responsibilities and should eventually be divided into reusable components and helper libraries.

No changes should occur until dependencies have been fully audited.

---

## update-log/route.ts

Status:

🟧 Important

Approximate Size:

1000+ lines

Purpose:

Primary log upload API.

Current responsibilities include:

- CSV processing
- Translation pipeline
- Parsed Log generation
- Statistics generation
- Supabase interaction
- Analysis orchestration

Assessment:

The route is functioning correctly but currently contains reusable parsing logic that should eventually migrate into the Logging Subsystem.

---

## update-tune/route.ts

Status:

🟨 Improvement

Purpose:

Tune upload and tune comparison workflow.

Responsibilities include:

- Tune upload
- ROM detection
- Binary comparison
- Tune profile generation
- Supabase storage

Assessment:

The architecture is stable but reusable workflow logic should eventually migrate into dedicated libraries.

---

## TelemetryGraphV1.tsx

Status:

🟨 Improvement

Purpose:

Telemetry graph rendering.

Assessment:

This component currently resides inside the analysis route.

It should eventually move into the Components Subsystem where reusable UI belongs.

---

# Dependencies

## Depends On

- Logging Subsystem
- Intelligence Subsystem
- Supabase
- Components
- Shared Types

---

## Used By

End users access the entire TuneSight platform through the Application Layer.

---

# Technical Health

Status:

🟧 Good

Major achievements:

- Universal Log Translator integrated.
- Intelligence pipeline integrated.
- Dashboard architecture operational.
- Vehicle workflow operational.
- Upload workflow operational.

Current technical debt is primarily organisational rather than architectural.

---

# Technical Debt

## High Priority

analysis/page.tsx

Reason:

Large file with mixed responsibilities.

Future action:

Split into:

- UI Components
- Page orchestration
- Helper libraries

---

update-log/route.ts

Reason:

Contains reusable parsing logic.

Future action:

Move reusable parsing into Logging libraries while keeping the route focused on orchestration.

---

## Medium Priority

TelemetryGraphV1.tsx

Move into reusable Components architecture.

---

update-tune/route.ts

Move reusable workflow logic into dedicated Tune libraries.

---

# Duplicate Responsibility Review

Possible legacy workflow overlap exists between:

- logs/
- vehicle/
- mods/
- newer dashboard vehicle pages

These routes require dependency verification before any architectural decisions.

No deletions are currently recommended.

---

# Architecture Rules

The Application Layer follows these permanent rules.

• Routes orchestrate.

• Components render.

• Logging translates.

• Intelligence reasons.

• Database stores.

• Application code should not permanently own reusable engineering logic.

---

# Future Refactoring Opportunities

Following completion of the remaining subsystem audits:

- Split analysis page into reusable UI components.
- Reduce API route responsibilities.
- Improve route organisation.
- Remove verified legacy pages.
- Improve component reuse.
- Simplify dashboard architecture.

These changes should only occur after the Components and Lib subsystems have been audited.

---

# Audit History

## Sprint 1

Status:

🟢 Completed

Summary:

- Entire app/ directory audited.
- Major files inspected.
- Route ownership verified.
- API responsibilities documented.
- Technical debt identified.
- No deletions performed.

---

This subsystem is considered architecturally sound.

Future work should focus on simplifying implementation while preserving the existing separation between the Logging, Intelligence and Application subsystems.