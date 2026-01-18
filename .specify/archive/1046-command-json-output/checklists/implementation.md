# Implementation Checklist: Command JSON Output

**Purpose**: Verify requirements quality and implementation guidance
**Created**: 2026-01-18
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] I-001 All 3 state commands (set, init, sync) have --json flag defined
- [x] I-002 Each command has typed output interface (StateSetOutput, etc.)
- [x] I-003 All output interfaces include status field with "success" | "error"
- [x] I-004 Error cases include error.message and error.hint fields
- [x] I-005 Backward compatibility maintained (text output when --json not used)

## Pattern Compliance

- [x] I-006 Uses existing output() function from lib/output.ts
- [x] I-007 Follows {CommandName}Output interface naming convention
- [x] I-008 Separates human-readable formatter into function
- [x] I-009 Checks options.json before calling output()

## Edge Case Coverage

- [x] I-010 --json and --quiet flags coexist correctly (JSON wins)
- [x] I-011 Invalid key format returns error JSON (not text error)
- [x] I-012 Missing state file returns error JSON
- [x] I-013 state sync --dry-run returns planned changes in JSON

## Testing Coverage

- [x] I-014 Unit test for state set success case
- [x] I-015 Unit test for state set error case
- [x] I-016 Unit test for state init success case
- [x] I-017 Unit test for state init overwrite case
- [x] I-018 Unit test for state sync with changes
- [x] I-019 Unit test for state sync dry-run

## Notes

- Check items off as implementation progresses
- Pattern compliance items reference existing commands as templates
- Edge cases derived from spec.md Edge Cases section
