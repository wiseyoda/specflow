# Implementation Checklist: Smart Batching & Orchestration

**Purpose**: Implementation guidance and quality verification during development
**Created**: 2026-01-21
**Feature**: [spec.md](../spec.md)

## Claude Helper Implementation

- [ ] I-001 claudeHelper() accepts typed ClaudeHelperOptions<T> with Zod schema
- [ ] I-002 Result is validated against provided schema before returning
- [ ] I-003 Session management supports: new session, resume (--resume), fork (--fork-session)
- [ ] I-004 Model selection supports sonnet, haiku, opus with fallback option
- [ ] I-005 Tool restrictions via --tools and --disallowedTools flags work correctly
- [ ] I-006 Budget enforcement stops execution when limit exceeded
- [ ] I-007 Timeout handling kills process and returns error
- [ ] I-008 Decision calls use read-only tools (Read, Grep, Glob only)

## Batch Parser Implementation

- [ ] I-010 Parser correctly identifies `##` section headers in tasks.md
- [ ] I-011 Each section with incomplete tasks becomes one batch
- [ ] I-012 Completed tasks are excluded from batches
- [ ] I-013 Fallback to fixed-size batches (default 15) when no sections found
- [ ] I-014 BatchPlan includes section names, task IDs, and counts

## Orchestration Service Implementation

- [ ] I-020 State machine has all phases: design, analyze, implement, verify, merge
- [ ] I-021 Dual confirmation waits for BOTH state update AND process completion
- [ ] I-022 State is persisted to {project}/.specflow/workflows/orchestration-{id}.json
- [ ] I-023 Decision log captures all transitions with timestamps and reasons
- [ ] I-024 Integration with specflow status --json parses output correctly
- [ ] I-025 Single orchestration per project enforced (rejects concurrent)
- [ ] I-026 Skip flags (skipDesign, skipAnalyze) correctly bypass steps

## Auto-Healing Implementation

- [ ] I-030 Failure context captures: stderr, attempted tasks, completed tasks, failed tasks
- [ ] I-031 Healer prompt includes error details and remaining task IDs
- [ ] I-032 Healer only attempts remaining tasks in current batch
- [ ] I-033 Max heal attempts per batch is enforced (default 1)
- [ ] I-034 Healer success marks batch as "healed" and continues
- [ ] I-035 Healer failure stops orchestration with full context for user

## API Routes Implementation

- [ ] I-040 POST /api/workflow/orchestrate validates project exists
- [ ] I-041 POST /api/workflow/orchestrate checks for existing orchestration
- [ ] I-042 Response includes orchestrationId and detected batch info
- [ ] I-043 GET /api/workflow/orchestrate/status returns full state
- [ ] I-044 POST /api/workflow/orchestrate/cancel terminates process and updates state
- [ ] I-045 POST /api/workflow/orchestrate/resume only works on paused orchestrations
- [ ] I-046 POST /api/workflow/orchestrate/merge only works when status is "waiting_merge"

## UI Components Implementation

- [ ] I-050 Configuration modal shows detected batch count in header
- [ ] I-051 Core options section always visible with correct defaults
- [ ] I-052 Advanced options collapsed by default, expandable
- [ ] I-053 Budget limits section validates numeric input
- [ ] I-054 PhaseProgressBar highlights current phase correctly
- [ ] I-055 BatchProgress shows section name, task counts, percentage
- [ ] I-056 DecisionLogPanel is collapsible and scrollable
- [ ] I-057 OrchestrationControls shows Pause/Cancel during active run
- [ ] I-058 MergeReadyPanel shows when status is "waiting_merge"
- [ ] I-059 OrchestrationBadge different color than workflow badges

## Integration Implementation

- [ ] I-060 CompletePhaseButton is primary (prominent styling, icon, subtitle)
- [ ] I-061 Secondary buttons (Orchestrate, Merge, Review, Memory) remain accessible
- [ ] I-062 Action buttons replaced by OrchestrationProgress when active
- [ ] I-063 Project card menu has "Complete Phase" first and highlighted
- [ ] I-064 "Run Workflow" reorganized as secondary flyout
- [ ] I-065 Reconciliation detects in-progress orchestrations on startup
- [ ] I-066 Reconciliation resumes or marks as failed based on process health

## Code Quality

- [ ] I-070 All new code uses TypeScript strict mode
- [ ] I-071 All external data validated with Zod schemas
- [ ] I-072 Error messages include context and next steps (Principle V)
- [ ] I-073 State stored in .specflow/ not .specify/ (Principle VIII)
- [ ] I-074 No direct edits to state files - use specflow CLI (Principle III)

## Notes

- Check items off as completed: `[x]`
- Reference task IDs from tasks.md when applicable
- Flag blockers immediately
