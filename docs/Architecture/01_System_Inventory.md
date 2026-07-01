# TuneSight System Inventory

Version: V2

Status: 🟢 Active

Document:
01_System_Inventory.md

Last Updated:
30 June 2026

Owner:
TuneSight Engineering

---

# Purpose

The System Inventory is the master index of every major subsystem within TuneSight.

It provides a single location for tracking subsystem ownership, audit progress, technical health, dependencies, and engineering priorities.

Unlike the individual subsystem documents, this file provides a high-level overview of the entire application.

---

# Current Architecture

TuneSight is organised into a number of major subsystems.

Each subsystem has one owner and one primary responsibility.

No responsibility should exist in multiple subsystems.

```
CSV

↓

Universal Log Translator

↓

Parsed Log

↓

Analysis Engine

↓

Root Cause Engine

↓

Candidate Ranking

↓

Cross Reference

↓

Telemetry

↓

Dashboard
```

---

# Subsystem Inventory

| Subsystem | Owner | Status | Audit Sprint | Priority | Health |
|-----------|-------|--------|--------------|----------|--------|
| Logging | Logging Engine | 🟢 Verified | Pre-Sprint | 🟩 Healthy |
| Intelligence | Intelligence Engine | 🟢 Verified | Pre-Sprint | 🟩 Healthy |
| App | Application Layer | 🟢 Verified | Sprint 1 | 🟧 Refactor Opportunities |
| Components | UI Layer | ⚪ Pending | - | Unknown |
| Hooks | React Layer | ⚪ Pending | - | Unknown |
| Types | Shared Type System | ⚪ Pending | - | Unknown |
| Lib | Core Engine | ⚪ Pending | - | Highest |
| Supabase | Database Layer | ⚪ Pending | - | Unknown |
| Scripts | Tooling | ⚪ Pending | - | Unknown |
| Public | Static Assets | ⚪ Pending | - | Unknown |

---

# Audit Progress

Current engineering audit order.

```
✅ app/

⬜ components/

⬜ hooks/

⬜ types/

⬜ lib/

⬜ supabase/

⬜ scripts/

⬜ public/
```

---

# Subsystem Responsibilities

## Logging

Responsible for:

- Log translation
- CSV parsing
- Channel mapping
- Platform translators
- Parsed log creation

Reference:

02_Subsystem_Logging.md

---

## Intelligence

Responsible for:

- Root Cause Engine
- Candidate Ranking
- Evidence analysis
- Cross Reference
- Tune intelligence
- Diagnostic reasoning

Reference:

03_Subsystem_Intelligence.md

---

## App

Responsible for:

- Next.js routes
- API endpoints
- Dashboard pages
- Upload pages
- Authentication pages
- User interface orchestration

Reference:

04_App_Subsystem.md

---

## Components

Responsible for reusable UI components.

Status:

Pending audit.

---

## Hooks

Responsible for reusable React hooks.

Status:

Pending audit.

---

## Types

Responsible for shared TypeScript types.

Status:

Pending audit.

---

## Lib

Responsible for all reusable business logic.

Expected contents include:

- Logging
- Analysis
- Intelligence
- ROM library
- Binary comparison
- Utilities

Status:

Pending audit.

---

## Supabase

Responsible for:

- Database schema
- Storage
- Authentication
- Row Level Security
- Data persistence

Status:

Pending audit.

---

## Scripts

Responsible for engineering utilities and maintenance scripts.

Status:

Pending audit.

---

## Public

Responsible for static assets delivered directly to the browser.

Status:

Pending audit.

---

# Engineering Health

Priority levels used throughout the Engineering Blueprint.

🟥 Critical

Architectural issue requiring immediate attention.

Examples:

- Duplicate ownership
- Incorrect responsibility
- Broken dependency

---

🟧 Important

Should be improved after verification.

Examples:

- Large files
- Mixed responsibilities
- Refactoring opportunities

---

🟨 Improvement

Quality improvements.

Examples:

- Better organisation
- Better naming
- Documentation improvements

---

🟩 Healthy

Verified architecture that aligns with the Engineering Blueprint.

---

# Current Findings

## Logging

🟩 Universal Log Translator successfully owns MHD translation.

---

## Intelligence

🟩 Candidate Ranking, Root Cause Engine, Cross Reference and Telemetry operate through the translated log pipeline.

---

## App

🟧 Analysis page exceeds 2600 lines and contains multiple responsibilities.

🟧 Update Log API route contains significant parsing logic that should eventually migrate into reusable libraries.

---

# Long-Term Goal

Every subsystem within TuneSight will eventually have:

- Verified ownership
- Verified dependencies
- Verified call flow
- Technical debt assessment
- Duplicate responsibility assessment
- Safe refactoring opportunities
- Safe deletion candidates

The System Inventory provides the overall status of that engineering effort.

---

# Audit History

## Sprint 1

Completed

Verified:

- app/

Next:

- components/

Status:

Engineering Blueprint migration in progress.