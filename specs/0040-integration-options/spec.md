# Feature Specification: Integration Options

**Phase**: 0040
**Status**: Draft
**Created**: 2026-01-11
**Author**: Claude (via /specflow.orchestrate)

---

## Overview

This phase enables SpecFlow to support projects with existing documentation. Currently, SpecFlow assumes a greenfield project where all documentation is created from scratch. Many real-world projects have existing ADRs (Architecture Decision Records), README files, API documentation, and other technical documentation that should be preserved and integrated rather than replaced.

The goal is to detect existing documentation, offer integration options, and import relevant documents into the SpecFlow structure without losing information.

---

## Problem Statement

**Current State**: SpecFlow creates all documentation from scratch, ignoring existing project documentation.

**Pain Points**:
1. Projects with existing ADRs lose architectural context when adopting SpecFlow
2. Existing README, CONTRIBUTING, and other docs are not recognized
3. No way to reference existing architecture documents from memory docs
4. API documentation (OpenAPI, etc.) is not integrated

**Desired State**: SpecFlow detects and integrates existing documentation, preserving institutional knowledge while adding SpecFlow's structured workflow.

---

## User Stories

### US1: Detect Existing Documentation

**As a** developer adopting SpecFlow on an existing project,
**I want** SpecFlow to detect my existing documentation,
**So that** I can see what's available before deciding what to import.

**Acceptance Criteria**:
- [ ] `specflow detect --docs` scans for common documentation patterns
- [ ] Detects: README.md, CONTRIBUTING.md, ARCHITECTURE.md, docs/, ADRs
- [ ] Detects: OpenAPI/Swagger files (openapi.yaml, swagger.json)
- [ ] Output shows found documents with their paths
- [ ] JSON output available for programmatic use

### US2: Import ADRs

**As a** developer with existing Architecture Decision Records,
**I want** to import my ADRs into SpecFlow's memory structure,
**So that** the AI understands past architectural decisions.

**Acceptance Criteria**:
- [ ] `specflow import adrs <path>` imports ADR files
- [ ] Preserves original ADR format and content
- [ ] Creates `.specify/memory/adrs/` directory
- [ ] Links ADRs in constitution.md or creates adr-index.md
- [ ] Handles numbered ADRs (001-*, ADR-001-*, etc.)
- [ ] Supports dry-run mode to preview changes

### US3: Reference Existing Architecture Docs

**As a** developer with existing architecture documentation,
**I want** to link it to SpecFlow's memory documents,
**So that** the AI can reference it during planning.

**Acceptance Criteria**:
- [ ] `specflow detect` identifies architecture-related documents
- [ ] Offers to create references in tech-stack.md or constitution.md
- [ ] References use relative paths from project root
- [ ] Does not duplicate content, only references

### US4: Integration Guide

**As a** developer new to SpecFlow,
**I want** documentation explaining how to integrate existing docs,
**So that** I can make informed decisions about migration.

**Acceptance Criteria**:
- [ ] Integration guide added to README or docs/
- [ ] Explains detection, import, and reference workflows
- [ ] Includes examples for common scenarios
- [ ] Documents what happens to original files (preserved, not modified)

---

## Scope

### In Scope
- `specflow detect --docs` enhancement for documentation discovery
- `specflow import adrs <path>` command for ADR import
- Reference linking in memory documents
- Integration documentation

### Out of Scope
- Automatic migration of all documentation formats
- Modifying original documentation files
- Complex document format conversion (e.g., Confluence → Markdown)
- Real-time sync between original and imported docs

---

## Technical Considerations

### Detection Patterns

Common documentation patterns to detect:
```
README.md, README.rst, README.txt
CONTRIBUTING.md
ARCHITECTURE.md
docs/
doc/
documentation/
ADRs: adr/, adrs/, docs/adr/, docs/decisions/
  - 001-*.md, ADR-001-*.md, NNNN-*.md
OpenAPI: openapi.yaml, openapi.json, swagger.yaml, swagger.json
API docs: api.md, API.md, api/
```

### Import Strategy

ADR import should:
1. Copy files to `.specify/memory/adrs/`
2. Preserve original filenames
3. Create index file listing all ADRs
4. Add reference in constitution.md

### Non-Destructive Operation

All operations must:
- Never modify original files
- Support `--dry-run` for preview
- Create backups before any changes to SpecFlow files

---

## Success Metrics

- Detection identifies 90%+ of common documentation patterns
- Import preserves 100% of ADR content
- No original files are modified or deleted
- Integration completes without errors on standard project structures

---

## Dependencies

- Existing `specflow detect` command infrastructure
- Memory document structure (constitution.md, etc.)
- CLI common library functions

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Many documentation formats | Medium | Focus on common patterns, document limitations |
| Large number of ADRs | Low | Batch import with progress indicator |
| Conflicting file names | Low | Add prefix or prompt for resolution |
| Broken references after import | Medium | Validate paths exist before creating references |

---

## Clarifications

### ADR Index Location (Resolved)
**Decision**: ADRs will be indexed in a separate `.specify/memory/adr-index.md` file.
**Rationale**: Keeps constitution.md focused on principles rather than becoming a document index.

### Superseded ADRs
**Decision**: Import all ADRs regardless of superseded status. The adr-index.md will note superseded relationships if present in original ADR metadata.

### Non-Markdown Formats
**Decision**: Phase 0040 focuses on Markdown ADRs only. Detection will note non-markdown docs but import is out of scope.
