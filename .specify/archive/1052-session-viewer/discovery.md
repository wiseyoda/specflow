# Discovery: Session Viewer

**Phase**: `1052-session-viewer`
**Created**: 2026-01-19
**Status**: Complete

## Phase Context

**Source**: PDR workflow-dashboard-orchestration.md / ROADMAP Phase 1052
**Goal**: View agent progress in real-time via session JSONL parsing with slide-out panel

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `packages/dashboard/src/components/projects/question-drawer.tsx` | Right-side slide-out drawer for answering workflow questions | Direct pattern to follow for session viewer drawer |
| `packages/dashboard/src/components/output-drawer.tsx` | Terminal-style output display with auto-scroll | Pattern for message display styling and auto-scroll |
| `packages/dashboard/src/lib/services/workflow-service.ts:725` | Stores `sessionId` from Claude CLI output | Source of session ID for JSONL lookup |
| `packages/dashboard/src/app/projects/[id]/page.tsx` | Project detail page with drawer integration | Integration point for session viewer |
| `packages/dashboard/src/hooks/use-workflow-execution.ts` | 3-second polling for workflow status | Pattern for session content polling |

### Existing Patterns & Conventions

- **Drawer Pattern**: Uses shadcn `Sheet` component (right-side slide, 500px width)
- **State Management**: Controlled open/onOpenChange props, useEffect reset on open
- **Auto-scroll**: Scroll to bottom on new content, pause when user scrolls up
- **Polling**: 3-second intervals for active content, stops on terminal states
- **Terminal Styling**: Dark background (bg-neutral-950), monospace font, line numbers

### Integration Points

- **Project Detail Header**: Add "Session" button next to workflow controls
- **Drawer Container**: Same level as QuestionDrawer in page.tsx
- **Workflow Execution**: Pass `workflowExecution.sessionId` to session viewer
- **API Layer**: New `/api/session/*` routes for content retrieval

### Constraints Discovered

- **JSONL Location**: Files stored in `~/.claude/projects/{path_hash}/` - need hash algorithm
- **File Size**: Sessions can be large - must use tail/streaming approach
- **Real-time Updates**: Active sessions grow continuously - need polling or tailing
- **Claude Code Hash**: Must match Claude Code's hashing algorithm for project paths

---

## Requirements Sources

### From ROADMAP/Phase File

1. Parse Claude session JSONL files from `~/.claude/projects/{hash}/{session}.jsonl`
2. Session viewer slide-out panel with formatted messages
3. Active session detection (link workflow sessionId to JSONL)
4. Basic progress indicators (files modified, time elapsed)

### From PDR (workflow-dashboard-orchestration.md)

- Session viewer should open from project detail
- Show current/recent session with streaming updates
- Formatted message display (user/assistant)
- Auto-scroll with "pause on scroll up" behavior

### From Memory Documents

- **Constitution VII**: Three-Line Output Rule - applies to CLI, less relevant for dashboard UI
- **Constitution IIa**: TypeScript for CLI packages - dashboard uses Next.js/React patterns
- **Tech Stack**: Next.js 16.x, React 19.x, shadcn/ui components, Tailwind CSS

---

## Scope Clarification

### Questions Asked

#### Question 1: UI Trigger

**Context**: Project detail page has QuestionDrawer pattern available; could also add as new tab.

**Question**: How should the session viewer be triggered from the project detail page?

**Options Presented**:
- A (Recommended): Header button - Add a 'Session' button in the project header next to workflow controls
- B: Side tab - Add a 'Sessions' tab alongside Status/Kanban/Timeline

**User Answer**: Header button (Recommended)

---

#### Question 2: Content Scope

**Context**: JSONL files can be very large for long sessions; need to balance completeness vs performance.

**Question**: Should the session viewer show the complete JSONL history or only recent messages?

**Options Presented**:
- A (Recommended): Tail mode - Show last ~100 messages with auto-scroll
- B: Full history - Load entire session history with pagination
- C: Both modes - Default to tail mode with option to load full

**User Answer**: Tail mode (Recommended)

---

#### Question 3: File Discovery

**Context**: Claude stores sessions in `~/.claude/projects/{hash}/` where hash is derived from project path.

**Question**: How should Claude session JSONL files be located?

**Options Presented**:
- A (Recommended): Hash lookup - Calculate project path hash using Claude Code's algorithm
- B: Session ID match - Search all directories for session ID match
- C: Workflow-stored path - Store full path in workflow execution state

**User Answer**: Hash lookup (Recommended)

---

#### Question 4: Message Types

**Context**: JSONL contains user messages, assistant messages, and tool calls with potentially verbose details.

**Question**: What message types should be displayed in the session viewer?

**Options Presented**:
- A (Recommended): All types - User, assistant, and tool calls with collapsible details
- B: Messages only - Only user and assistant messages, hide tool calls
- C: Configurable - Let user toggle message types

**User Answer**: Messages only

---

### Confirmed Understanding

**What the user wants to achieve**:
A slide-out session viewer panel that shows real-time agent activity during workflow execution. Opens via header button, displays last ~100 messages in tail mode, shows only user and assistant messages (not tool calls), uses Claude's project hash algorithm to locate JSONL files.

**How it relates to existing code**:
- Follows QuestionDrawer pattern for slide-out panel implementation
- Uses OutputDrawer styling patterns for terminal-like message display
- Integrates with existing workflow execution state (sessionId already stored)
- Adds new API routes following existing `/api/workflow/*` patterns

**Key constraints and requirements**:
- Must calculate same path hash as Claude Code for file lookup
- Tail mode only (~100 messages) for performance
- User and assistant messages only (no tool calls)
- Real-time updates via polling for active sessions
- Auto-scroll with pause-on-scroll-up behavior

**Technical approach (if discussed)**:
1. Create session parser utility for JSONL files
2. Add API route to stream session content (tail mode)
3. Create SessionViewerDrawer component following QuestionDrawer pattern
4. Add "Session" button to project detail header
5. Implement polling hook for real-time updates

**User confirmed**: Yes - 2026-01-19

---

## Recommendations for SPECIFY

### Should Include in Spec

- JSONL parser for Claude session format
- API route `/api/session/content` for retrieving messages
- SessionViewerDrawer component with slide-out panel
- Header button integration in project detail
- Polling mechanism for real-time updates
- Auto-scroll behavior with scroll-pause detection
- Progress indicators (files modified, time elapsed)
- Project path hash calculation matching Claude Code

### Should Exclude from Spec (Non-Goals)

- Full session history with pagination (tail mode only)
- Tool call display (messages only per user preference)
- Configurable message type filters
- Multiple session selection
- Session export functionality
- Post-workflow summary view (deferred to future phase)

### Potential Risks

- **Hash Algorithm Mismatch**: If hash calculation differs from Claude Code, file lookup will fail
- **Large File Performance**: Even tail mode may be slow for very long sessions
- **Race Conditions**: New messages may arrive while reading, need atomic tail operation

### Questions to Address in CLARIFY

- None - all questions resolved during discovery
