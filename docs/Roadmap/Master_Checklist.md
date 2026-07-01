# TuneSight Master Roadmap

Version: V5

Status:
🟢 Active Development

Document:
Master_Checklist.md

Last Updated:
30 June 2026

Owner:
TuneSight Engineering

Purpose:
Track the engineering progress of TuneSight Version 5 from architecture audit through to public release.

Unlike the Engineering Blueprint, this document changes frequently and reflects the current development priorities.

---

# Current Phase

Architecture Audit

Current Sprint:

Sprint 1 Complete

Current Focus:

Complete a full engineering audit of every subsystem before continuing Version 5 feature development.

---

# Current Engineering Workflow

Every development session follows this workflow.

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

This workflow applies to every subsystem audit and every future feature.

---

# Overall Progress

## Phase 1 — Engineering Blueprint

Status:

🟢 Complete

Tasks:

- [x] Project Overview
- [x] System Inventory
- [x] Logging Subsystem
- [x] Intelligence Subsystem
- [x] Application Subsystem
- [x] Project Map
- [x] Architecture Rules

Result:

Engineering Blueprint Version 2 completed.

---

## Phase 2 — Architecture Audit

Status:

🟡 In Progress

Completed:

- [x] app/

Remaining:

- [ ] components/
- [ ] hooks/
- [ ] types/
- [ ] lib/
- [ ] supabase/
- [ ] scripts/
- [ ] public/

Goal:

Understand every subsystem before modifying architecture.

---

## Phase 3 — Architecture Refinement

Status:

⚪ Pending

Planned work:

- [ ] Split large Application files
- [ ] Reduce API route responsibilities
- [ ] Improve subsystem boundaries
- [ ] Remove duplicate responsibilities
- [ ] Improve reusable component architecture
- [ ] Simplify application flow

These tasks will only begin after every subsystem has been audited.

---

## Phase 4 — Intelligence Expansion

Status:

⚪ Pending

Future work includes:

- [ ] Expand Root Cause library
- [ ] Expand Evidence Engine
- [ ] Expand Candidate Ranking
- [ ] Expand Confidence modelling
- [ ] Expand Cross Reference knowledge
- [ ] Expand Tune Intelligence
- [ ] Expand ECU family support
- [ ] Expand ROM library
- [ ] Expand XDF library

---

## Phase 5 — Platform Expansion

Status:

⚪ Pending

Future platforms:

- [ ] bootmod3 improvements
- [ ] ProTool
- [ ] xHP
- [ ] Dimsport
- [ ] Additional CSV formats

Goal:

Support multiple logging ecosystems through the Universal Log Translator.

---

## Phase 6 — Binary Intelligence

Status:

⚪ Pending

Planned capabilities:

- [ ] Binary comparison improvements
- [ ] Automatic calibration suggestions
- [ ] Binary modification engine
- [ ] Stock vs Modified comparison improvements
- [ ] Intelligent calibration recommendations

---

## Phase 7 — Version 5 Release Preparation

Status:

⚪ Pending

Tasks:

- [ ] Performance optimisation
- [ ] Security review
- [ ] Database optimisation
- [ ] Beta testing
- [ ] Documentation review
- [ ] UI polish
- [ ] Release candidate testing

---

# Current Priorities

Priority 1

Complete Architecture Audit.

Priority 2

Remove architectural duplication.

Priority 3

Strengthen subsystem ownership.

Priority 4

Resume Version 5 feature development.

---

# Current Technical Debt

Known items awaiting future refactoring.

Application Layer

- analysis/page.tsx
- update-log/route.ts

Status:

Refactor only after architecture audit completion.

---

# Next Sprint

Architecture Audit Sprint 2

Subsystem:

components/

Objectives:

- Verify ownership
- Verify dependencies
- Identify duplicate responsibilities
- Identify reusable UI
- Document technical debt
- Update Engineering Blueprint

---

# Long-Term Vision

TuneSight is being engineered as a modular automotive intelligence platform.

Every subsystem should:

- have one owner
- have one responsibility
- integrate cleanly with every other subsystem
- become simpler as functionality expands

The objective is to create an engineering platform that can continue growing for many years without accumulating unnecessary complexity.

---

# Milestones

✅ Engineering Blueprint Version 2 completed.

✅ Universal Log Translator implemented.

✅ Intelligence pipeline established.

✅ Application subsystem audited.

⬜ Complete architecture audit.

⬜ Begin architecture refinement.

⬜ Resume Version 5 expansion.

⬜ Beta release.

⬜ Public Version 5 release.

---

This roadmap represents the current engineering priorities for TuneSight.

It should evolve as milestones are completed and new priorities emerge, while remaining aligned with the Engineering Blueprint.