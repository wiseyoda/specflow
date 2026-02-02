# SpecFlow Constitution

> Core principles and governance for SpecFlow development. All implementation decisions must align with these principles.

**Version**: 1.4.0
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

### II. POSIX-Compliant Bash for Scripts
Shell scripts in `scripts/bash/` are written in POSIX-compliant bash, validated with shellcheck.
- **Rationale**: Portability across macOS and Linux, reliability
- **Implications**: No bash-specific features without fallbacks, shellcheck validation in CI
- **Scope**: Applies to `scripts/bash/*.sh` and `bin/` dispatcher scripts

### IIa. TypeScript for CLI Packages
CLI packages in `packages/cli/` are written in TypeScript with strict mode.
- **Rationale**: Type safety, testability, shared types with dashboard, modern tooling
- **Implications**: ESM modules, Zod validation, Commander.js patterns
- **Scope**: Applies to `packages/cli/` and related monorepo packages
- **Relationship to II**: TypeScript CLI coexists with bash scripts during transition; hybrid dispatcher routes appropriately

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

### VIII. Repo Knowledge vs Operational State
Project files are separated into repo knowledge (`.specify/`) and operational state (`.specflow/`).
- **Rationale**: If a user stops using SpecFlow, they can delete `.specflow/` and retain all valuable documentation
- **Implications**:
  - **`.specify/`**: Memory docs, phases, templates, discovery, archive, history - survives uninstall
  - **`.specflow/`**: orchestration-state.json, manifest.json, workflows/ - delete to uninstall
- **Rule**: Never store valuable repo knowledge in `.specflow/`; never store transient operational data in `.specify/`

### IX. Single Source of Truth for State
Each piece of state has ONE authoritative location. No parallel state tracking, no reconciliation.
- **Rationale**: Multiple sources of truth lead to sync bugs, reconciliation hacks, and state confusion
- **Implications**:
  - **CLI state file** (`.specflow/orchestration-state.json`) is THE orchestration state
  - Dashboard reads CLI state, it does NOT maintain separate state
  - Sub-commands (flow.design, flow.implement) own their step state - they set `step.status`
  - Dashboard watches and reacts to state changes, it doesn't second-guess them
- **Anti-patterns to AVOID**:
  - Separate "execution" objects that mirror CLI state
  - "Reconciliation" code that syncs parallel state sources
  - Guards that fix state after it's already wrong
  - Claude/AI fallback for "unclear state" (if state is unclear, fix the state schema)
- **When state seems wrong**: Fix the ROOT CAUSE. Don't add workarounds that mask the problem.

### X. No Hacks or Workarounds
When encountering edge cases, fix the root cause. Do not add conditional guards or workarounds.
- **Rationale**: Hacks accumulate. Each hack requires another hack to handle its edge cases. Soon you have unmaintainable spaghetti.
- **Implications**:
  - If state can get into an invalid configuration, fix the code that allows it
  - If decision logic has ambiguous cases, simplify the state model
  - If you need a "guard" to prevent bad behavior, the upstream code is wrong
- **Code Comment Rule**: If you write a comment like `// HACK:`, `// WORKAROUND:`, `// GUARD:`, or `// FIXME:` - STOP. This is a signal to find the real fix, not document the problem.
- **Refactoring Threshold**: If decision logic exceeds 100 lines, it's too complex. Simplify the state model.
- **Phase 1058 Learning**: The orchestration system accumulated 6+ hacks in ~2 months. The fix was 1 week of work. Hacks are NOT faster.

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
| 1.4.0 | 2026-01-24 | Added Principles IX (Single Source of Truth) and X (No Hacks) from Phase 1058 learnings |
| 1.3.0 | 2026-01-19 | Added Principle VIII: Repo Knowledge vs Operational State (.specify/ vs .specflow/) |
| 1.2.0 | 2026-01-18 | Added Principle IIa: TypeScript for CLI Packages; clarified II scope |
| 1.1.0 | 2026-01-10 | Added Principle VII: Three-Line Output Rule |
| 1.0.0 | 2026-01-10 | Initial constitution for SpecFlow |
