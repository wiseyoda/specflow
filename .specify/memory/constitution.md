# SpecFlow Constitution

> Core principles and governance for SpecFlow development. All implementation decisions must align with these principles.

**Version**: 1.1.0
**Created**: 2026-01-10
**Status**: ACTIVE

---

## Preamble

SpecFlow is a spec-driven development framework for Claude Code. It provides CLI tools and slash commands that guide AI-assisted development through structured workflows. This constitution defines the fundamental principles guiding development.

---

## Core Principles

### I. Developer Experience First
All features prioritize ease of use for developers working with Claude Code.
- **Rationale**: If it's not easy to use, developers won't use it
- **Implications**: Clear CLI output, helpful error messages, intuitive command structure

### II. POSIX-Compliant Bash
All scripts are written in POSIX-compliant bash, validated with shellcheck.
- **Rationale**: Portability across macOS and Linux, reliability
- **Implications**: No bash-specific features without fallbacks, shellcheck validation in CI

### III. CLI Over Direct Edits
State and artifact changes go through CLI commands, not direct file edits.
- **Rationale**: Consistency, validation, audit trail
- **Implications**: `specflow state set`, `specflow tasks mark`, not Edit tool on JSON

### IV. Simplicity Over Cleverness
Prefer readable, maintainable code over clever optimizations.
- **Rationale**: Code is read more often than written
- **Implications**: Clear naming, explicit over implicit, documented decisions

### V. Helpful Error Messages
Every error provides context and suggests next steps.
- **Rationale**: Users shouldn't have to guess what went wrong or what to do
- **Implications**: All errors include actionable guidance

### VI. Graceful Degradation
Features should work partially when dependencies are missing.
- **Rationale**: Don't block users unnecessarily
- **Implications**: Warn about missing optional features, continue with core functionality

### VII. Three-Line Output Rule
CLI output must put user-critical information in the first 3 lines.
- **Rationale**: Claude Code CLI only shows 3 lines by default; decorative headers waste this space
- **Implications**:
  - **Line 1**: Status (OK/ERROR/WARN) + primary result
  - **Line 2**: Key data or metric (count, percentage, file path)
  - **Line 3**: Next step hint or secondary info
  - **Lines 4+**: Detailed output, decorative elements, system info
- **Pattern**: Use `print_summary()` for final output, avoid leading `print_header()`
- **Example**:
  ```
  OK: Tasks 40/40 complete (100%)
    File: specs/0020-onboarding-polish/tasks.md
    Next: Run /specflow.verify to complete phase
  ```

---

## Governance

### Decision Making
- **Architecture decisions**: Documented in ADRs (`.specify/memory/adrs/`)
- **New CLI commands**: Must follow existing patterns
- **Principle changes**: Require documented rationale

### Enforcement
- **shellcheck**: All bash scripts pass shellcheck
- **Exit codes**: 0=success, 1=error, 2=warning
- **All scripts**: Support `--help` and `--json` flags

---

## Amendment Process

To amend this constitution:
1. Propose change with rationale
2. Document impact on existing code/decisions
3. Update version number and changelog

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-01-10 | Added Principle VII: Three-Line Output Rule |
| 1.0.0 | 2026-01-10 | Initial constitution for SpecFlow |
