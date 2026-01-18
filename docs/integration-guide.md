# Integration Guide

This guide explains how to integrate SpecFlow with projects that have existing documentation.

## Overview

SpecFlow can detect and import existing documentation from your project, preserving your institutional knowledge while adding SpecFlow's structured workflow. This is especially useful for:

- Projects with existing Architecture Decision Records (ADRs)
- Established codebases with existing documentation
- Teams migrating from other documentation systems

## Detection

### Detecting Existing Documentation

Use the detect command to scan for existing documentation:

```bash
specflow detect --docs
```

This scans for:

| Pattern | Description |
|---------|-------------|
| `docs/`, `doc/` | Documentation directories |
| `adr/`, `adrs/`, `docs/adr/`, `docs/decisions/` | ADR directories |
| `ARCHITECTURE.md`, `CONTRIBUTING.md`, `DESIGN.md` | Key architecture documents |
| `openapi.yaml`, `swagger.json` | API specifications |
| `.github/` | GitHub templates and workflows |

### Output

```
============================================================
  Existing Documentation
============================================================

ADR Directories Found:
  docs/adr/ (5 ADRs)

Suggested next step:
  specflow import adrs docs/adr
```

### JSON Output

For programmatic use:

```bash
specflow detect --docs --json
```

## Importing ADRs

### Basic Import

Import Architecture Decision Records into SpecFlow's memory structure:

```bash
specflow import adrs <path>
```

Example:
```bash
specflow import adrs docs/adr
```

This will:
1. Create `.specify/memory/adrs/` directory
2. Copy all ADR files preserving original names
3. Generate `.specify/memory/adr-index.md` with titles and statuses

### Preview Changes

Use dry-run mode to see what would happen without making changes:

```bash
specflow import adrs docs/adr --dry-run
```

### Force Overwrite

If you've already imported ADRs and want to reimport:

```bash
specflow import adrs docs/adr --force
```

### Supported ADR Patterns

The import command recognizes these filename patterns:

- `001-decision-name.md` (3-digit numbered)
- `0001-decision-name.md` (4-digit numbered)
- `ADR-001-decision-name.md` (ADR prefix)
- `adr-001-decision-name.md` (lowercase ADR prefix)

### What Gets Imported

| Source | Destination |
|--------|-------------|
| `docs/adr/001-use-react.md` | `.specify/memory/adrs/001-use-react.md` |
| `docs/adr/002-database.md` | `.specify/memory/adrs/002-database.md` |
| (generated) | `.specify/memory/adr-index.md` |

### ADR Index

The generated `adr-index.md` includes:

- Table of all ADRs with ID, title, and status
- Import metadata (source path, date, count)
- Links to each imported ADR

Example:
```markdown
# Architecture Decision Records

**Imported from**: `docs/adr`
**Import date**: 2024-01-15
**Total ADRs**: 5

## Index

| ID | Title | Status |
|----|-------|--------|
| 001 | [Use React for Frontend](./adrs/001-use-react.md) | Accepted |
| 002 | [PostgreSQL Database](./adrs/002-postgresql.md) | Accepted |
```

## Important Notes

### Original Files Are Preserved

**Import never modifies or deletes your original files.**

The import command copies files to the SpecFlow structure. Your original ADR files in `docs/adr/` (or wherever they are) remain untouched.

### Status Extraction

The import command attempts to extract status from your ADR files by looking for:

- `Status: Accepted` lines
- `**Status**: Accepted` markdown patterns

If no status is found, it will show "Unknown".

### Re-importing

If your original ADRs change, you can re-import with `--force` to update the SpecFlow copies. This will overwrite the files in `.specify/memory/adrs/`.

## Common Workflows

### New Project with Existing ADRs

```bash
# 1. Initialize SpecFlow
specflow scaffold

# 2. Detect existing docs
specflow detect --docs

# 3. Import ADRs
specflow import adrs docs/adr

# 4. Verify import
ls .specify/memory/adrs/
cat .specify/memory/adr-index.md
```

### Checking Before Import

```bash
# See what would be imported
specflow import adrs docs/adr --dry-run

# If satisfied, run actual import
specflow import adrs docs/adr
```

### After Import

Once ADRs are imported, SpecFlow's AI workflows can reference them:

- The `/specflow.start` command auto-detects your project state and routes to the right workflow
- The `/specflow.specify` command can consider existing decisions
- The `/specflow.plan` command can reference ADRs for context
- Memory documents can link to relevant ADRs

**Recommended**: Use `/specflow.start` to begin any workflow - it will detect your imported ADRs and current project state automatically.

## Troubleshooting

### "No ADR files found"

The import command looks for specific file patterns. Ensure your ADRs match one of:
- `NNN-*.md` (3-digit number prefix)
- `NNNN-*.md` (4-digit number prefix)
- `ADR-NNN-*.md` (ADR prefix with number)

### "Target directory already contains files"

Use `--force` to overwrite existing imports:
```bash
specflow import adrs docs/adr --force
```

### ADR Status Shows "Unknown"

The status extractor looks for `Status:` lines. If your ADRs use a different format, the status will show as "Unknown". This doesn't affect the import - you can manually update the index if needed.
