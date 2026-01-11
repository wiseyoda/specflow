# Requirements Checklist: Integration Options

**Phase**: 0040
**Created**: 2026-01-11

## Functional Requirements

### Detection (US1)
- [ ] FR1.1: `speckit detect --docs` command exists
- [ ] FR1.2: Detects README.md, CONTRIBUTING.md, ARCHITECTURE.md
- [ ] FR1.3: Detects docs/ and doc/ directories
- [ ] FR1.4: Detects ADR directories (adr/, adrs/, docs/adr/, docs/decisions/)
- [ ] FR1.5: Detects ADR files with common naming patterns
- [ ] FR1.6: Detects OpenAPI/Swagger files
- [ ] FR1.7: Outputs human-readable summary
- [ ] FR1.8: Supports --json output

### Import (US2)
- [ ] FR2.1: `speckit import adrs <path>` command exists
- [ ] FR2.2: Creates .specify/memory/adrs/ directory
- [ ] FR2.3: Copies ADR files preserving content
- [ ] FR2.4: Preserves original filenames
- [ ] FR2.5: Creates ADR index file
- [ ] FR2.6: Supports --dry-run flag
- [ ] FR2.7: Handles numbered ADR formats (001-*, ADR-001-*)

### Reference (US3)
- [ ] FR3.1: Detection identifies architecture documents
- [ ] FR3.2: Can add references to memory documents
- [ ] FR3.3: References use relative paths

### Documentation (US4)
- [ ] FR4.1: Integration guide exists in README or docs/
- [ ] FR4.2: Guide explains detection workflow
- [ ] FR4.3: Guide explains import workflow
- [ ] FR4.4: Guide includes examples

## Non-Functional Requirements

- [ ] NFR1: Original files are never modified
- [ ] NFR2: All commands support --help
- [ ] NFR3: Error messages are actionable
- [ ] NFR4: Commands follow CLI conventions (exit codes, output format)
- [ ] NFR5: Operations are idempotent where possible
