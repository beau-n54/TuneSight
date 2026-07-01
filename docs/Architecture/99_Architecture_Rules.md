# TuneSight Engineering Rules

Version: Engineering Blueprint V2

Status:
🟢 Permanent

Document:
99_Architecture_Rules.md

Last Updated:
30 June 2026

Owner:
TuneSight Engineering

Purpose:
Define the permanent engineering principles that govern the design, implementation, maintenance, and evolution of TuneSight.

These rules apply to every subsystem, every feature, every refactor, and every future version of the project.

---

# Engineering Philosophy

TuneSight is built architecture-first.

The objective is not simply to build more software.

The objective is to build software that becomes simpler as it becomes more intelligent.

Every engineering decision should reduce complexity, strengthen ownership, and improve long-term maintainability.

---

# Core Principles

## Rule 1

Every responsibility has exactly one owner.

No responsibility should exist in multiple locations.

---

## Rule 2

Every piece of information has one source of truth.

Duplicate data creates inconsistent behaviour.

---

## Rule 3

Existing architecture must always be verified before creating new architecture.

Never assume a subsystem does not already exist.

Search first.

Verify second.

Build third.

---

## Rule 4

Documentation follows verification.

The Engineering Blueprint documents verified architecture, not assumptions.

---

## Rule 5

Refactoring follows understanding.

Do not move or rewrite code until responsibilities and dependencies have been verified.

---

## Rule 6

Deletion follows dependency verification.

No file is deleted until every dependency has been confirmed.

---

## Rule 7

Subsystem boundaries must remain clear.

Each subsystem owns a specific responsibility.

Subsystems communicate through well-defined interfaces.

---

## Rule 8

Reusable logic belongs in reusable locations.

Routes should orchestrate.

Libraries should implement.

Components should render.

---

## Rule 9

The simplest correct architecture is preferred.

Avoid unnecessary abstraction.

Avoid duplicate workflows.

Avoid temporary solutions becoming permanent architecture.

---

## Rule 10

Expand existing subsystems before creating new ones.

New subsystems should exist only when a genuinely new responsibility appears.

---

# Architectural Ownership

Logging owns:

- CSV parsing
- Platform translation
- Parsed Log generation

---

Intelligence owns:

- Event detection
- Evidence collection
- Root Cause analysis
- Candidate Ranking
- Cross Reference
- Diagnostic reasoning

---

Application owns:

- Routing
- API endpoints
- User interaction
- Dashboard presentation
- Workflow orchestration

---

Supabase owns:

- Storage
- Authentication
- Database persistence
- Row Level Security

---

Components own:

- Reusable UI

---

Hooks own:

- Reusable React behaviour

---

Types own:

- Shared type definitions

---

# Engineering Workflow

Every engineering session follows the same workflow.

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

Skipping steps introduces technical debt.

---

# Audit Standards

Every subsystem audit should answer:

- What is its purpose?
- Who owns it?
- What files belong to it?
- What depends on it?
- What does it depend on?
- Does duplicate ownership exist?
- Can anything be safely deleted?
- What should be refactored?

No assumptions.

Only verified conclusions.

---

# Refactoring Standards

A refactor should:

- simplify architecture
- reduce duplication
- strengthen ownership
- improve readability
- preserve behaviour

A refactor should never exist solely for stylistic reasons.

---

# Deletion Standards

Before deleting any file:

- Verify ownership.
- Verify dependencies.
- Verify imports.
- Verify routes.
- Verify runtime usage.
- Verify replacement.

Deletion without verification is prohibited.

---

# Engineering Blueprint

The Engineering Blueprint is the permanent architectural reference for TuneSight.

If the blueprint and the code disagree:

The code should be audited.

The blueprint should be updated only after verification.

---

# Long-Term Vision

TuneSight is intended to become an extensible engineering platform capable of supporting multiple vehicle platforms, logging systems, calibration formats, and intelligent diagnostic workflows.

Growth should come from expanding subsystem capability rather than increasing subsystem complexity.

Architecture should become clearer as functionality expands.

---

# Final Principle

Every engineering decision should make the next engineering decision easier.

If a change makes the system harder to understand, harder to maintain, or harder to extend, it should be reconsidered before implementation.

---

This document is permanent.

It should change only when the engineering philosophy of TuneSight fundamentally changes.