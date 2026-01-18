# Verification Checklist: Command JSON Output

**Purpose**: Post-implementation verification
**Created**: 2026-01-18
**Feature**: [spec.md](../spec.md)

## Functional Verification

- [x] V-001 `specflow state set foo=bar --json` outputs valid JSON
- [x] V-002 `specflow state init --json` outputs valid JSON with project info
- [x] V-003 `specflow state sync --json` outputs valid JSON with changes array
- [x] V-004 `specflow state sync --dry-run --json` shows planned changes without applying
- [x] V-005 All JSON output parseable by jq (no malformed JSON)

## Error Handling Verification

- [x] V-006 `specflow state set invalid --json` returns error JSON with message and hint
- [x] V-007 `specflow state init --json` on existing file without --force returns error JSON
- [x] V-008 Error JSON structure matches other commands (consistent format)

## Backward Compatibility

- [x] V-009 `specflow state set foo=bar` (no --json) outputs text as before
- [x] V-010 `specflow state init` (no --json) outputs text as before
- [x] V-011 `specflow state sync` (no --json) outputs text as before
- [x] V-012 Existing --quiet flag still works with state set

## Schema Documentation

- [x] V-013 .specify/memory/cli-json-schema.md exists
- [x] V-014 Schema covers all 17 commands (14 existing + 3 new)
- [x] V-015 Each command has example output in schema doc
- [x] V-016 Error format documented in schema doc

## Integration Verification

- [x] V-017 `specflow status --json` still works (regression check)
- [x] V-018 `specflow next --json` still works (regression check)
- [x] V-019 All tests pass: `pnpm --filter @specflow/cli test`
- [x] V-020 Build succeeds: `pnpm --filter @specflow/cli build`

## Notes

- V-001 to V-005: Core functionality
- V-006 to V-008: Error handling
- V-009 to V-012: Backward compatibility
- V-013 to V-016: Documentation
- V-017 to V-020: Integration/regression
