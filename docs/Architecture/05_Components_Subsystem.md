# Components Subsystem

Version:
Engineering Blueprint V2

Status:

🟡 Partially Verified

Document:
05_Components_Subsystem.md

Owner:
TuneSight Engineering

Last Updated:
30 June 2026

Audit Sprint:
Sprint 2

Primary Responsibility:
Document reusable UI components within TuneSight.

Verification Method:

✔ Full project structure scanned

✔ No top-level components/ folder found

✔ Reusable components located under lib/components/

---

# Purpose

The Components Subsystem documents reusable UI components used by TuneSight.

At the current stage of the project, reusable components are not stored in a top-level components/ folder.

They currently live inside:

lib/components/

This document reflects the verified project structure rather than an assumed folder layout.

---

# Verified Component Location

Current reusable component folder:

lib/components/

Current verified subfolder:

lib/components/diagnostics/

---

# Verified Files

lib/components/diagnostics/MiniMetricBar.tsx

lib/components/diagnostics/WorkshopDiagnosticCard.tsx

---

# Current Status

The Components Subsystem is partially verified.

A full audit of lib/components/ is required before any refactoring decisions are made.

---

# Audit Objective

Sprint 2 will inspect:

- component purpose
- component ownership
- component dependencies
- where each component is used
- whether the component is reusable
- whether duplicate UI exists elsewhere
- whether additional UI should be migrated from app/
- whether the current location is correct

---

# Known Architectural Context

The app subsystem audit identified that some reusable UI may still be embedded inside large route files, especially:

app/dashboard/vehicles/[id]/analysis/page.tsx

This file should not be refactored until lib/components/ has been audited.

---

# Architecture Rule

Components render.

Components should not own:

- diagnostic reasoning
- log parsing
- candidate ranking
- database persistence
- route orchestration

Reusable UI should live in a reusable component location.

---

# Next Step

Perform Architecture Audit Sprint 2 on:

lib/components/

---

# Sprint 2 Audit Result

Status:

🟢 Completed

Audited Location:

lib/components/

Verified Files:

- lib/components/diagnostics/MiniMetricBar.tsx
- lib/components/diagnostics/WorkshopDiagnosticCard.tsx

## Component Ownership

The Components Subsystem currently owns reusable diagnostic UI components.

Current reusable diagnostic components:

- MiniMetricBar
- WorkshopDiagnosticCard

## Verified Dependencies

WorkshopDiagnosticCard imports:

- MiniMetricBar

MiniMetricBar imports:

- No internal project files

## Verified Usage

WorkshopDiagnosticCard is used by:

- app/dashboard/vehicles/[id]/analysis/page.tsx

MiniMetricBar is used by:

- lib/components/diagnostics/WorkshopDiagnosticCard.tsx

## Technical Health

Status:

🟢 Healthy

Findings:

- Components are reusable.
- Components are isolated from diagnostic reasoning.
- Components do not own data fetching.
- Components do not own parsing.
- Components do not own candidate ranking.
- Components correctly render supplied data.

## Technical Debt

Status:

🟨 Minor Improvement

Future opportunities:

- Replace `relatedXdfTables?: any[]` with a typed interface.
- Consider moving more reusable analysis UI out of app/dashboard/vehicles/[id]/analysis/page.tsx after the App and Lib audits are complete.
- Consider creating a diagnostics component index/export file if this folder grows.

## Safe Deletion Candidates

None.

## Refactoring Recommendation

Do not refactor this subsystem yet.

The current component files are small, readable, and correctly scoped.

Future work should focus on extracting reusable UI currently embedded inside large route files, especially:

- app/dashboard/vehicles/[id]/analysis/page.tsx