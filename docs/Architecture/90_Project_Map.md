# TuneSight Project Map

Version: Engineering Blueprint V2

Status:
🟢 Active

Document:
05_Project_Map.md

Last Updated:
30 June 2026

Owner:
TuneSight Engineering

Purpose:
Provide a high-level map of the TuneSight project structure, subsystem relationships, engineering audit progress, and overall architecture.

---

# Project Overview

TuneSight is organised into independent engineering subsystems.

Each subsystem has a single owner, a defined responsibility, and a documented interface with the rest of the application.

The project is designed so that every new feature extends an existing subsystem before introducing a new one.

---

# High-Level Architecture

```
                    User
                      │
                      ▼
              Application Layer
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
 Logging Subsystem         Intelligence Subsystem
         │                         │
         └────────────┬────────────┘
                      ▼
                 Supabase
                      │
                      ▼
                Dashboard UI
```

---

# Logging Pipeline

```
CSV

↓

Platform Detection

↓

Platform Translator

↓

Universal Log Translator

↓

Parsed Log

↓

Analysis Engine
```

---

# Intelligence Pipeline

```
Parsed Log

↓

Event Detection

↓

Evidence Collection

↓

Root Cause Engine

↓

Candidate Ranking

↓

Cross Reference

↓

Narrative Summary

↓

Telemetry

↓

Dashboard
```

---

# Current Project Structure

```
app/
components/
hooks/
lib/
public/
scripts/
supabase/
types/

docs/
```

---

# Audit Progress

Current subsystem audit order.

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

# Current Engineering Status

| Subsystem | Status |
|------------|---------|
| Logging | 🟢 Verified |
| Intelligence | 🟢 Verified |
| App | 🟢 Verified |
| Components | ⚪ Pending |
| Hooks | ⚪ Pending |
| Types | ⚪ Pending |
| Lib | ⚪ Pending |
| Supabase | ⚪ Pending |
| Scripts | ⚪ Pending |
| Public | ⚪ Pending |

---

# Data Ownership

Every major responsibility has a single owner.

| Responsibility | Owner |
|----------------|-------|
| CSV Parsing | Logging |
| Channel Translation | Logging |
| Parsed Log | Logging |
| Event Detection | Intelligence |
| Evidence Collection | Intelligence |
| Root Cause Analysis | Intelligence |
| Candidate Ranking | Intelligence |
| Cross Reference | Intelligence |
| Dashboard Rendering | Application |
| API Routing | Application |
| Database Storage | Supabase |

Duplicate ownership is not permitted.

---

# Engineering Workflow

Every engineering session follows the same process.

```
Inspect

↓

Understand

↓

Verify

↓

Document

↓

Improve

↓

Code
```

No architectural changes should occur before verification.

---

# Version 5 Objectives

Current priorities:

- Complete engineering audit of every subsystem.
- Eliminate duplicate responsibilities.
- Reduce technical debt.
- Strengthen subsystem ownership.
- Expand diagnostic intelligence.
- Expand platform support.
- Continue simplifying architecture.

---

# Long-Term Vision

The goal is to build TuneSight as a modular engineering platform.

Every subsystem should be understandable in isolation while integrating cleanly with every other subsystem.

Future growth should come from expanding subsystem capability rather than increasing subsystem complexity.

The Engineering Blueprint should remain the primary reference for every architectural decision made throughout the life of the project.

---

# Audit History

## Sprint 1

Completed:

- Engineering Blueprint V2 established.
- Logging architecture documented.
- Intelligence architecture documented.
- Application subsystem audited.
- Project structure mapped.

Next:

Components Subsystem Audit.