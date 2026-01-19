---
phase: 1053
name: workflow-session-unification
status: not_started
created: 2026-01-19
updated: 2026-01-19
pdr: workflow-dashboard-orchestration.md
---

> **Architecture Context**: See [PDR: Workflow Dashboard Orchestration](../../memory/pdrs/workflow-dashboard-orchestration.md) for holistic architecture, design decisions, and how this phase fits into the larger vision.

### 1053 - Workflow-Session Unification

**Goal**: Unify workflows and Claude sessions as the same concept, fixing session detection on workflow start.

**Context**: Phase 1052 implemented the Session Viewer UI, but session detection has race conditions. The core issue is that workflows and sessions are treated as separate concepts when they're fundamentally the same thing - a Claude conversation. This phase unifies them architecturally.

**Problem Statement:**
1. Workflows stored in `~/.specflow/workflows/{execution_id}.json` (global)
2. Sessions stored in `~/.claude/projects/{hash}/{session_id}.jsonl` (Claude's storage)
3. Session ID only available AFTER first Claude turn completes with current implementation
4. Polling `sessions-index.json` has race conditions with multiple sessions

**Scope:**

1. **Architectural Unification**
   - Workflow = Session = Claude conversation (same concept)
   - Single source of truth for workflow/session state
   - Store workflow metadata in project: `.specflow/workflows/{session_id}/`
   - Link directly to Claude's JSONL files

2. **Immediate Session Detection**
   - Capture session ID when Claude CLI starts (not after first turn)
   - Options to explore:
     a. Parse `sessions-index.json` immediately (Claude updates on CLI start)
     b. Use `claude --context --output-format json` to query active session
     c. Match workflow start time to session `created` timestamp precisely
     d. Use `firstPrompt` field in index to match our skill prompt signature or use execution_id as first thing we say to claude as it shows in the index.
   - Eliminate race conditions with multiple sessions

3. **Workflow/Session History**
   - List all workflow/sessions for a project (new tab in details)
   - View any past session's messages
   - Resume capability for all sessions (inclusive of waiting for input), user may want to follow up with any session to keep the conversation going.
   - Storage: `.specflow/workflows/{session_id}/metadata.json` -> should link claude session id and path to JSONL when discovered

4. **Session Viewer Integration**
   - Update Session Viewer to use unified model
   - Show session detail table -> session in drawer
   - Quick switch between sessions
   - Clear indication of which session is "active"

**Technical Investigation Required:**

```bash
# Test: Does sessions-index.json update immediately on CLI start?
# Watch file while starting a new session
fswatch ~/.claude/projects/-Users-*/sessions-index.json &
claude -p "test" --output-format json

# Test: Can we match by firstPrompt?
cat ~/.claude/projects/-Users-*/sessions-index.json | jq '.entries[] | {sessionId, firstPrompt}'

# Test: Does --context show active session?
claude --context --output-format json
```

**Proposed Data Model:**

```
.specflow/workflows/
├── {session_id_1}/
│   ├── metadata.json      # Workflow state, skill, status, answers
│   └── → symlink or reference to ~/.claude/projects/{hash}/{session_id}.jsonl
├── {session_id_2}/
│   └── metadata.json
└── index.json             # Quick lookup: [{sessionId, skill, status, startedAt}]
```

**API Changes:**
- GET `/api/workflow/list?projectId=<id>` - Include sessionId in response
- GET `/api/session/history?projectPath=<path>` - List all sessions for project
- POST `/api/workflow/start` - Return sessionId immediately (within 2s of start)

**UI Components:**
- Update `SessionViewerDrawer.tsx` to correctly link to the clicked on session
- Update `useWorkflowExecution.ts` - Include sessionId immediately
- New `SessionHistoryList.tsx` - List of past sessions

**What This Phase Does NOT Include:**
- Full session replay/playback
- Session comparison
- Export/archive sessions
- Session search

**Dependencies:**
- Phase 1052 (Session Viewer UI - provides the viewing infrastructure)

**Verification Gate: USER**
- [ ] Start workflow → Session ID available within 2 seconds
- [ ] Session Viewer shows correct session immediately
- [ ] Can view history of past workflow sessions
- [ ] No race conditions when starting multiple workflows sequentially

**Estimated Complexity**: Medium-High (architectural change)

**Known Risks:**
- Claude's `sessions-index.json` format may change
- Need to handle edge cases (CLI crashes, network issues)
- Migration of existing workflow data
