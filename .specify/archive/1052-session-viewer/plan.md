# Implementation Plan: Session Viewer

**Branch**: `1052-session-viewer` | **Date**: 2026-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/1052-session-viewer/spec.md`

## Summary

Build a session viewer panel that displays real-time Claude session messages in a slide-out drawer. The viewer parses Claude's JSONL session files, calculates project path hashes for file discovery, and polls for updates during active workflows. User and assistant messages are displayed with distinct styling; tool calls are filtered out per user preference.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode)
**Primary Dependencies**: Next.js 16.x, React 19.x, shadcn/ui (Sheet component), Tailwind CSS
**Storage**: Claude session files at `~/.claude/projects/{hash}/*.jsonl`
**Testing**: Vitest (if tests requested)
**Target Platform**: Web (Next.js dashboard)
**Project Type**: Web application (monorepo)
**Performance Goals**: Panel opens <500ms, messages update within 3s polling interval
**Constraints**: Tail mode only (~100 messages), no tool call display, hash must match Claude Code algorithm
**Scale/Scope**: Single session viewer per project detail page

## Constitution Check

_GATE: Must pass before implementation._

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | PASS | Slide-out panel is intuitive, non-disruptive |
| IIa. TypeScript for CLI Packages | PASS | Dashboard uses TypeScript with strict mode |
| III. CLI Over Direct Edits | N/A | No state file edits - read-only session display |
| IV. Simplicity Over Cleverness | PASS | Tail mode, polling (not SSE), minimal components |
| V. Helpful Error Messages | PASS | Empty/error states with explanatory text |
| VI. Graceful Degradation | PASS | Shows "No active session" when applicable |
| VII. Three-Line Output Rule | N/A | Dashboard UI, not CLI output |
| VIII. Repo vs Operational State | N/A | Read-only access to Claude files |

## Project Structure

### Documentation (this feature)

```text
specs/1052-session-viewer/
├── discovery.md        # Codebase examination and decisions
├── spec.md             # Feature specification
├── requirements.md     # Requirements quality checklist
├── ui-design.md        # Visual mockups and component inventory
├── plan.md             # This file
├── tasks.md            # Task list (to be generated)
└── checklists/
    ├── implementation.md
    └── verification.md
```

### Source Code (repository)

```text
packages/dashboard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── session/
│   │   │       └── content/
│   │   │           └── route.ts     # NEW: Session content API
│   │   └── projects/
│   │       └── [id]/
│   │           └── page.tsx         # MODIFY: Add session drawer state
│   ├── components/
│   │   └── projects/
│   │       ├── project-detail-header.tsx  # MODIFY: Add Session button
│   │       └── session-viewer-drawer.tsx  # NEW: Session viewer panel
│   ├── hooks/
│   │   └── use-session-messages.ts  # NEW: Session polling hook
│   └── lib/
│       ├── session-parser.ts        # NEW: JSONL parser
│       └── project-hash.ts          # NEW: Claude path hash calculator
```

**Structure Decision**: Web application structure within existing Next.js monorepo. New files follow established patterns (components in `components/projects/`, hooks in `hooks/`, utilities in `lib/`).

## Technical Design

### 1. Project Path Hash Calculation

Claude Code hashes project paths for directory naming. Based on Claude's implementation:

```typescript
// lib/project-hash.ts
import { createHash } from 'crypto';

export function calculateProjectHash(projectPath: string): string {
  // Claude Code uses SHA-256 on UTF-8 encoded path and takes first 16 hex chars
  // NOTE: Verify against actual Claude Code implementation during T010
  return createHash('sha256')
    .update(projectPath, 'utf8')
    .digest('hex')
    .substring(0, 16);
}
```

### 2. Session Parser

Parse JSONL files line-by-line, filtering for user/assistant messages:

```typescript
// lib/session-parser.ts
interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ParseResult {
  message: SessionMessage | null;  // Only user/assistant messages
  toolCall?: { name: string; filesModified?: string[] };  // Extract metrics from tool calls
}

export function parseSessionLine(line: string): ParseResult {
  try {
    const data = JSON.parse(line);
    if (data.type === 'user' || data.type === 'assistant') {
      return {
        message: {
          role: data.type,
          content: data.content || data.text || '',
          timestamp: data.timestamp,
        },
      };
    }
    // Parse tool calls for metrics (not displayed as messages)
    if (data.type === 'tool_use' || data.type === 'tool_result') {
      return {
        message: null,
        toolCall: {
          name: data.name || 'unknown',
          filesModified: data.files_modified || [],
        },
      };
    }
    return { message: null };
  } catch {
    return { message: null }; // Skip malformed lines
  }
}
```

### 3. API Route

```typescript
// GET /api/session/content?projectPath=<path>&sessionId=<id>&tail=100
// Returns: { messages: SessionMessage[], elapsed: number, filesModified: number }
```

The API:
1. Calculates hash from projectPath
2. Locates JSONL file: `~/.claude/projects/{hash}/{sessionId}.jsonl`
3. Reads last N lines (tail mode)
4. Parses and filters messages
5. Returns formatted response

### 4. Session Polling Hook

```typescript
// hooks/use-session-messages.ts
export function useSessionMessages(
  projectPath: string | null,
  sessionId: string | null,
  isActive: boolean
) {
  // Poll every 3 seconds when active
  // Return { messages, elapsed, filesModified, isLoading, error }
}
```

### 5. Component Architecture

```
SessionViewerDrawer
├── SessionHeader (session ID, elapsed, files modified)
├── SessionMessageList (ScrollArea with auto-scroll)
│   └── SessionMessage (individual message with role styling)
├── SessionEmptyState (when no session)
└── SessionErrorState (when file not found)
```

## File Dependencies

```
project-hash.ts          # No dependencies
session-parser.ts        # No dependencies
route.ts                 # Depends on: project-hash, session-parser
use-session-messages.ts  # Depends on: API route
session-viewer-drawer.tsx # Depends on: use-session-messages hook
project-detail-header.tsx # Depends on: session-viewer-drawer
page.tsx                 # Depends on: session-viewer-drawer, use-session-messages
```

## Implementation Order

1. **Utilities first**: project-hash.ts, session-parser.ts (no deps, testable)
2. **API route**: /api/session/content (depends on utilities)
3. **Hook**: use-session-messages (depends on API)
4. **Components**: SessionViewerDrawer (depends on hook)
5. **Integration**: Modify header and page (depends on all above)
