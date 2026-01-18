# Verification Checklist: Phase 1040 - CLI Actions from UI

> Use this checklist during `/specflow.verify` to confirm implementation completeness.

## User Gate Verification (Required)

These items MUST pass for phase completion:

### VG-1: Create Issue from UI
- [x] Open dashboard and press Cmd+K
- [x] Search for "issue create"
- [x] Select command and enter issue title "Test verification issue"
- [x] Verify output drawer shows command execution
- [x] Verify `.specify/issues/` contains new issue file
- [x] Verify toast shows success message

### VG-2: Run Any SpecFlow Command
- [x] Open command palette (Cmd+K)
- [x] Verify command list shows all specflow commands
- [x] Run `specflow status`
- [x] Verify output appears in drawer
- [x] Run `specflow tasks status`
- [x] Verify output appears in drawer

### VG-3: Command Output Streaming
- [x] Run a command that produces multiple lines of output
- [x] Verify output streams character-by-character or line-by-line (not all at once)
- [x] Verify streaming latency feels responsive (< 100ms perceived)

### VG-4: Error Handling
- [x] Run an invalid command (e.g., malformed arguments)
- [x] Verify error toast appears with helpful message
- [x] Verify "View Details" opens drawer with full error output
- [x] Verify error message includes actionable guidance

---

## Functional Requirements Verification

### FR-001: CLI Command Execution
- [x] API route `/api/commands/execute` accepts POST requests
- [x] Commands execute via child_process.spawn (not exec)
- [x] Project path is correctly passed to CLI

### FR-002: Output Streaming
- [x] SSE endpoint `/api/commands/stream` sends stdout events
- [x] SSE endpoint sends stderr events
- [x] SSE endpoint sends exit code on completion

### FR-003: Output Drawer
- [x] Drawer expands from side of screen
- [x] Drawer can be collapsed/minimized
- [x] Drawer shows command being executed

### FR-004: Toast Notifications
- [x] Success toast appears on command completion
- [x] Error toast appears on command failure
- [x] Toast has "View Details" action for errors

### FR-005: Input Sanitization
- [x] Commands with shell metacharacters are rejected or escaped
- [x] Only allowlisted commands can be executed
- [x] Arguments are validated before execution

### FR-006: Project Path
- [x] Commands receive correct project path from context
- [x] Multiple projects can be targeted correctly

### FR-007: Command Discovery
- [x] `/api/commands/list` returns available commands
- [x] Commands are parsed from `specflow help` output
- [x] Command list includes subcommands

### FR-008: Timeout Handling
- [x] Long-running commands timeout after 60 seconds
- [x] Timeout shows appropriate error message

### FR-009: Command History
- [x] Recent commands appear in command palette
- [x] History is session-scoped (clears on page refresh)

### FR-010: Argument Prompts
- [x] Commands requiring arguments show input field
- [x] User can enter argument and submit
- [x] Empty arguments are handled appropriately

### FR-011: Command Cache
- [x] Command list is cached on first load
- [x] Cache refreshes periodically

---

## Non-Functional Requirements

### NFR-001: Streaming Latency
- [x] Output appears within 100ms of CLI producing it

### NFR-002: Palette Speed
- [x] Command palette opens in < 200ms

### NFR-003: Non-Blocking
- [x] UI remains responsive during command execution
- [x] Other features (navigation, views) still work

---

## Edge Cases

- [x] CLI not installed: Shows installation instructions
- [x] Invalid project path: Shows clear error with path
- [x] Command in progress: Handles concurrent execution gracefully
- [x] SSE disconnect: Reconnects and shows partial output

---

## Security

- [x] No command injection vulnerabilities
- [x] Inputs are validated with Zod schemas
- [x] Only specflow commands can be executed (no arbitrary shell)

---

## Documentation

- [x] Command palette usage documented in README
- [x] API endpoints documented (optional)
