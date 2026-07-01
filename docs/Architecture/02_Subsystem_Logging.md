# Logging Subsystem

Version: Engineering Blueprint V2

Status: 🟢 Verified

Document:
02_Subsystem_Logging.md

Last Updated:
30 June 2026

Owner:
Logging Engine

Audit Sprint:
Pre-Sprint (Verified during Universal Log Translator migration)

Primary Responsibility:
Translate raw log files into a platform-independent Parsed Log used by the Intelligence Engine.

Verification Method:

✔ Source code inspected

✔ Translation pipeline verified

✔ Universal Log Translator verified

✔ MHD migration completed

---

# Purpose

The Logging Subsystem is responsible for converting raw datalog files into a consistent internal format that can be consumed by every downstream subsystem.

It is the only subsystem that understands logging platform differences.

Every subsystem after logging operates on translated data only.

---

# Architecture

The logging pipeline follows a strict flow.

```
CSV

↓

Platform Detection

↓

Platform Translator

↓

Translated Log

↓

buildParsedLogFromTranslatedLog()

↓

Parsed Log

↓

Analysis Engine
```

No downstream subsystem should read raw CSV files directly.

---

# Responsibilities

The Logging Subsystem owns:

- CSV parsing
- Header detection
- Channel alias mapping
- Platform translation
- Universal Log Translator
- Parsed Log creation
- Logging statistics generation

The Logging Subsystem does **not** own:

- Diagnostic reasoning
- Root Cause analysis
- Candidate Ranking
- Tune comparison
- ROM detection
- Telemetry rendering
- Dashboard presentation

---

# Current Platform Support

## MHD

Status:

🟢 Verified

Translation handled by the Universal Log Translator.

---

## bootmod3 (BM3)

Status:

🟢 Existing translator verified.

BM3 maintains its own translator implementation.

Future work will migrate it toward the Universal Log Translator architecture where practical, while preserving compatibility.

---

## Future Platforms

Planned support includes:

- ProTool
- xHP
- Dimsport
- Custom CSV formats

Each platform should provide only a translator.

No platform should modify the Analysis Engine.

---

# Current Data Flow

```
Raw CSV

↓

Platform Translator

↓

Universal Log Format

↓

buildParsedLogFromTranslatedLog()

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

This architecture establishes a single source of truth for all logging data.

---

# Ownership Rules

The Logging Subsystem is the only owner of:

- Raw CSV interpretation
- Header aliases
- Channel translation
- Unit normalisation
- Platform-specific naming

Once translation is complete, platform-specific information should no longer exist.

All downstream systems consume the same Parsed Log structure regardless of the original logging platform.

---

# Dependencies

## Depends On

- CSV upload
- File storage
- Vehicle metadata

---

## Used By

- Analysis Engine
- Root Cause Engine
- Candidate Ranking
- Cross Reference
- Telemetry
- Dashboard
- Tune Intelligence

---

# Technical Health

Status:

🟩 Healthy

Major achievements:

- Universal Log Translator implemented.
- MHD successfully migrated.
- Translation ownership centralised.
- Downstream systems consume translated data.
- Duplicate parsing significantly reduced.

---

# Technical Debt

Status:

🟨 Improvement

Future work:

- Consolidate remaining BM3 translation logic where appropriate.
- Add additional logging platform translators.
- Improve platform auto-detection.
- Expand channel alias library.

No architectural issues currently require immediate refactoring.

---

# Architecture Rules

The Logging Subsystem follows these permanent rules.

• Every logging platform supplies a translator.

• Every translator produces the same internal format.

• No downstream subsystem may interpret raw CSV files.

• Platform-specific logic ends at translation.

• The Parsed Log is the single source of truth for all analysis.

---

# Future Expansion

Additional translators should integrate without changing:

- Analysis Engine
- Intelligence Engine
- Candidate Ranking
- Cross Reference
- Telemetry

Adding a new logging platform should require only:

1. Platform detection.
2. Translator implementation.
3. Translator registration.

No other subsystem should require modification.

---

# Audit History

## Universal Log Translator Migration

Status:

🟢 Completed

Summary:

- MHD migrated to Universal Log Translator.
- Existing BM3 translator verified.
- Parsed Log pipeline standardised.
- Logging ownership centralised.
- Architecture verified.

---

This subsystem is considered stable and serves as the foundation for all diagnostic analysis within TuneSight.

---

# Sprint 2.1 Audit Result

Status:

🟢 Completed

Audited Location:

lib/logging/

Verified Files:

- lib/logging/bm3.ts
- lib/logging/dimsport.ts
- lib/logging/helpers.ts
- lib/logging/mhd.ts
- lib/logging/protool.ts
- lib/logging/translator.ts
- lib/logging/types.ts
- lib/logging/xhp.ts

## Verified Ownership

lib/logging/ owns:

- logger platform detection
- platform translators
- raw row translation
- channel alias reading
- TranslatedLog types
- missing core channel detection

## Verified Call Flow

app/api/vehicles/update-log/route.ts

↓

lib/logging/translator.ts

↓

platform translator:

- mhd.ts
- bm3.ts
- dimsport.ts
- protool.ts
- xhp.ts

↓

TranslatedLog

↓

buildParsedLogFromTranslatedLog()

↓

Analysis Engine

## Verified Dependencies

translator.ts imports:

- bm3.ts
- dimsport.ts
- mhd.ts
- protool.ts
- xhp.ts
- types.ts

mhd.ts imports:

- helpers.ts
- types.ts

bm3.ts imports:

- helpers.ts
- types.ts

helpers.ts imports:

- types.ts

dimsport.ts imports:

- types.ts

protool.ts imports:

- types.ts

xhp.ts imports:

- types.ts

## Verified Usage

lib/logging/ is used by:

- app/api/vehicles/update-log/route.ts
- lib/intelligence/buildCalibrationIntelligence.ts
- lib/intelligence/loggerAdapter.ts

## Technical Health

Status:

🟢 Healthy core

Findings:

- Logging ownership is correctly centralised.
- MHD translation is implemented.
- BM3 translation is implemented.
- Shared helpers are correctly isolated.
- TranslatedLog types are correctly owned by lib/logging/types.ts.
- translator.ts acts as the central platform router.

## Technical Debt

Status:

🟨 Improvement

Findings:

- dimsport.ts is currently a placeholder translator.
- protool.ts is currently a placeholder translator.
- xhp.ts is currently a placeholder translator.
- buildParsedLogFromTranslatedLog() still lives inside app/api/vehicles/update-log/route.ts and should eventually move into lib/logging/ or lib/analysis/.
- Platform detection is header-term based and may need stronger scoring later.

## Safe Deletion Candidates

None.

Placeholder translators should not be deleted.

They represent planned platform support.

## Refactoring Opportunities

Future work:

- Move buildParsedLogFromTranslatedLog() out of the API route.
- Add real Dimsport translation.
- Add real ProTool translation.
- Add real xHP translation.
- Strengthen platform detection confidence scoring.
- Consider moving platform aliases into separate alias maps if translators grow larger.

## Architecture Decision

lib/logging/ is confirmed as the real Logging Subsystem implementation.

The Logging Subsystem document remains valid and should reference lib/logging/ as the verified owner of logger translation.