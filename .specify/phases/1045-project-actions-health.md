# Phase 1045: Project Actions & Health

> **Status**: Not Started
> **Branch**: `1045-project-actions-health`
> **Depends On**: Phase 1040 (CLI Actions from UI)

## Summary

Enable users to manage project lifecycle actions directly from the dashboard UI, including initialization, diagnostics, and version upgrades.

## Context

The dashboard now displays 4 project states:
1. **Not Initialized** - No `.specify/` directory or orchestration state
2. **Needs Setup** - Has state but no phases (needs discovery/roadmap)
3. **Ready** - Fully configured and working
4. **Error** - Health check failures or configuration issues

This phase adds actionable buttons to address each state.

## Goals

- Run `speckit init` on uninitialized projects from UI
- Run `speckit doctor` to diagnose and fix issues
- Run `speckit scaffold` to set up project structure
- Handle v1 → v2 schema migration via `speckit state migrate`
- Show command output in real-time (streaming)
- Provide confirmation dialogs for destructive operations

## Non-Goals

- Full terminal emulator (just command output display)
- Arbitrary CLI command execution (only predefined safe actions)
- Background job queuing (actions run one at a time)

## Technical Approach

### UI Components

1. **Action Buttons** - Context-aware buttons based on project status
   - Not Initialized: "Initialize Project" button
   - Needs Setup: "Run Discovery" / "Create Roadmap" buttons
   - Error: "Run Doctor" / "Fix Issues" buttons
   - Ready: "Doctor" in overflow menu

2. **Command Output Modal** - Shows real-time command output
   - Streaming output via SSE or WebSocket
   - Success/failure indication
   - Copy output button
   - Auto-close on success (with delay)

3. **Confirmation Dialog** - For operations that modify state
   - Clear description of what will happen
   - Cancel/Confirm actions

### API Endpoints

```typescript
// POST /api/projects/[id]/actions
// Body: { action: "init" | "doctor" | "scaffold" | "migrate" }
// Returns: SSE stream of command output

// GET /api/projects/[id]/health
// Returns: Detailed health check results
```

### Backend Implementation

1. **Command Executor** - Safe wrapper for CLI commands
   - Whitelist of allowed commands
   - Working directory validation
   - Timeout handling
   - Output streaming

2. **Health Check** - Deeper analysis than current state
   - Schema version check
   - Required files check
   - ROADMAP.md validation
   - Memory documents check

## Verification Checklist

- [ ] "Initialize Project" works on uninitialized project
- [ ] "Run Doctor" shows issues and offers fixes
- [ ] v1 → v2 migration works from UI
- [ ] Command output streams in real-time
- [ ] Confirmation dialog appears before destructive actions
- [ ] Error states update after successful fix
- [ ] Keyboard accessible (Enter to confirm, Escape to cancel)

## Files to Create/Modify

### New Files
- `src/app/api/projects/[id]/actions/route.ts` - Action execution endpoint
- `src/app/api/projects/[id]/health/route.ts` - Health check endpoint
- `src/components/projects/action-button.tsx` - Contextual action button
- `src/components/projects/command-output-modal.tsx` - Output display
- `src/components/ui/confirmation-dialog.tsx` - Confirmation UI
- `src/lib/command-executor.ts` - Safe command execution

### Modified Files
- `src/components/projects/project-card.tsx` - Add action buttons
- `src/components/projects/project-detail-header.tsx` - Add actions menu
- `packages/shared/src/schemas/` - Add action/health types

## Dependencies

- Existing SSE infrastructure from Phase 1020
- CLI commands: `speckit init`, `speckit doctor`, `speckit scaffold`, `speckit state migrate`

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Command hangs | Implement timeout (60s default) |
| Partial state after error | Run doctor after failed operations |
| User confusion about actions | Clear descriptions and confirmations |

## Sizing Estimate

Medium complexity - primarily UI work with some backend command execution. Should fit in a single session.
