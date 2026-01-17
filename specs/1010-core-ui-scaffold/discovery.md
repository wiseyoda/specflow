# Discovery: 1010 - Core UI Scaffold

> Codebase examination and scope clarification findings.

**Date**: 2026-01-17
**Phase**: 1010 - Core UI Scaffold

---

## Codebase Findings

### Current Project Structure
- **Pure Bash CLI**: All current functionality in `scripts/bash/speckit-*.sh`
- **No existing frontend**: No `packages/`, TypeScript, or React files exist
- **Test framework**: Custom bash test runner in `tests/test-runner.sh`
- **25+ CLI commands**: state, scaffold, context, roadmap, tasks, doctor, etc.

### Registry Format
Location: `~/.speckit/registry.json`
```json
{
  "projects": {
    "<uuid>": {
      "path": "/path/to/project",
      "name": "project-name",
      "registered_at": "ISO-date",
      "last_seen": "ISO-date"
    }
  }
}
```

### Approved Tech Stack (from tech-stack.md)
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 14+ with App Router |
| UI Library | React 18+ |
| Styling | Tailwind CSS 3.x |
| Components | shadcn/ui |
| Package Manager | pnpm |
| Language | TypeScript 5.x (strict) |
| Database | SQLite (future, not this phase) |
| Design | Linear-inspired (clean, keyboard-driven) |

### Constitution Constraints
- Principle III: CLI Over Direct Edits (dashboard should use CLI under the hood)
- Principle VII: Three-Line Output Rule (dashboard CLI output should follow this)
- Principle I: Developer Experience First

### Related Prior Work
- No existing dashboard code
- Registry mechanism already implemented for project tracking
- CLI commands available for all operations

---

## Integration Points

### Data Sources
1. **Registry** (`~/.speckit/registry.json`) - Project list
2. **State files** (`.specify/orchestration-state.json`) - Per-project state
3. **ROADMAP.md** - Phase status
4. **Phase files** (`.specify/phases/*.md`) - Phase details

### CLI Commands to Wrap
- `speckit status --json` - Comprehensive project status
- `speckit roadmap status` - Phase statuses
- `speckit tasks status --json` - Task progress
- `speckit issue list --json` - Issues

---

## Confirmed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo structure | pnpm workspaces with `packages/` | Approved in tech-stack.md |
| Server mode | Both (production default, --dev flag) | Flexibility for dev and deployment |
| Project navigation | Expand inline details | Keep context while browsing |
| Data access | Direct file reading with Zod validation | Performance + type safety |
| Schema sharing | `packages/shared` with Zod schemas | Single source of truth for structure |
| Sync strategy | Polling every 5 seconds | Simple auto-refresh, acceptable for MVP |

---

## Scope Confirmation

### In Scope (Phase 1010)
- Next.js project setup with pnpm
- Basic layout: sidebar, header, main content
- Project list from registry.json
- Dark/light mode toggle
- Command palette shell (Cmd+K opens, placeholder content)
- `speckit dashboard` CLI command

### Out of Scope (Future Phases)
- Project detail views
- Task/issue management UI
- SQLite database
- Agent integration
- WebSocket real-time updates
- Full command palette functionality
