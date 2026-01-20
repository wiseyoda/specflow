# Implementation Plan: Comprehensive Dashboard UI Redesign

**Branch**: `1054-project-details-redesign` | **Date**: 2026-01-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/1054-project-details-redesign/spec.md`

## Summary

Transform the SpecFlow dashboard with a comprehensive UI overhaul covering both the project list and project details pages. This includes establishing a reusable design system foundation (extended Tailwind config, primitive components), replacing the current sidebar with icon-only navigation, adding a centered status pill in the header, implementing four distinct views (Dashboard, Session, Tasks, History), and applying consistent visual polish (glass morphism, grid background, floating orbs) throughout.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode)
**Primary Dependencies**: Next.js 16, React 19, Tailwind CSS 3.x, shadcn/ui, lucide-react, @radix-ui/*
**Storage**: N/A (frontend changes only, uses existing API endpoints)
**Testing**: Vitest (for any utility functions), manual visual testing
**Target Platform**: Desktop browsers (Chrome, Firefox, Safari)
**Project Type**: Monorepo web application (packages/dashboard)
**Performance Goals**: Animations at 60fps, view transitions <300ms
**Constraints**: Must preserve all existing workflow functionality, dark mode only
**Scale/Scope**: 2 pages (project list, project details), ~20 components

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | ✓ Pass | New design improves UX |
| IIa. TypeScript for CLI | ✓ Pass | Dashboard is TypeScript |
| III. CLI Over Direct Edits | ✓ N/A | Frontend UI changes |
| IV. Simplicity Over Cleverness | ✓ Pass | Uses standard Tailwind patterns |
| V. Helpful Error Messages | ✓ Pass | Error states clearly displayed |
| VII. Three-Line Output Rule | ✓ N/A | Visual UI, not CLI |
| VIII. Repo vs Operational | ✓ N/A | Frontend code |

## Project Structure

### Documentation (this feature)

```text
specs/1054-project-details-redesign/
├── discovery.md              # Codebase findings and decisions
├── spec.md                   # Feature specification
├── requirements.md           # Requirements checklist
├── ui-design.md              # Visual mockups and rationale
├── plan.md                   # This file
├── tasks.md                  # Task breakdown
└── checklists/
    ├── implementation.md     # Implementation guidance
    └── verification.md       # Verification checklist
```

### Source Code (repository root)

```text
packages/dashboard/
├── app/
│   ├── page.tsx                      # Project list page (REFACTOR)
│   ├── projects/[id]/page.tsx        # Project details page (REFACTOR)
│   └── globals.css                   # Global styles (EXTEND)
├── components/
│   ├── ui/                           # shadcn primitives (EXISTING)
│   ├── design-system/                # NEW: Reusable design primitives
│   │   ├── status-pill.tsx
│   │   ├── glass-card.tsx
│   │   ├── grid-background.tsx
│   │   ├── floating-orbs.tsx
│   │   └── index.ts
│   ├── layout/                       # REFACTOR: New layout
│   │   ├── icon-sidebar.tsx
│   │   ├── redesigned-header.tsx
│   │   ├── context-drawer.tsx
│   │   └── app-layout.tsx
│   ├── views/                        # NEW: View components
│   │   ├── dashboard-welcome.tsx
│   │   ├── session-console.tsx
│   │   ├── tasks-kanban.tsx
│   │   └── history-timeline.tsx
│   ├── session/                      # REFACTOR: Session components
│   │   ├── session-message.tsx
│   │   ├── tool-call-block.tsx
│   │   └── typing-indicator.tsx
│   ├── input/                        # NEW: Input components
│   │   ├── omni-box.tsx
│   │   ├── decision-toast.tsx
│   │   └── failed-toast.tsx
│   └── projects/                     # REFACTOR: Project components
│       └── project-card.tsx
├── hooks/                            # EXISTING: Data hooks (unchanged)
│   ├── use-workflow-execution.ts
│   ├── use-session-messages.ts
│   └── ...
├── contexts/                         # EXISTING: State (unchanged)
│   └── connection-context.tsx
└── tailwind.config.js                # EXTEND: Design tokens
```

**Structure Decision**: Extend existing dashboard structure. Create new `design-system/` directory for reusable primitives. Create new `views/` directory for the four main views. Refactor existing `layout/` components.

## Implementation Phases

### Phase 1: Design System Foundation (P1 - US1)

Establish the design tokens and primitive components that all other work depends on.

**Files to modify/create:**
- `tailwind.config.js` - Extend with mockup colors and animations
- `app/globals.css` - Add custom CSS for glass, grid, etc.
- `components/design-system/status-pill.tsx` - NEW
- `components/design-system/glass-card.tsx` - NEW
- `components/design-system/grid-background.tsx` - NEW
- `components/design-system/floating-orbs.tsx` - NEW
- `components/design-system/index.ts` - NEW (barrel export)

**Key decisions:**
- Use Tailwind `extend` for colors, not CSS variables (per user choice)
- Animations defined in Tailwind config for consistency
- Glass effect uses `backdrop-blur` with vendor prefixes

### Phase 2: Layout Structure (P1 - US2, US3)

Build the new layout shell: icon sidebar, redesigned header, context drawer.

**Files to modify/create:**
- `components/layout/icon-sidebar.tsx` - NEW
- `components/layout/redesigned-header.tsx` - NEW
- `components/layout/context-drawer.tsx` - NEW
- `components/layout/app-layout.tsx` - NEW (replaces main-layout)
- `app/projects/[id]/page.tsx` - REFACTOR to use new layout

**Key decisions:**
- Icon sidebar is 64px wide (w-16)
- Header is 56px tall (h-14)
- Context drawer is 288px wide (w-72) when open
- Use framer-motion or CSS transitions for drawer animation

### Phase 3: Core Views (P2 - US4, US5, US9)

Implement the main view components: Dashboard, Session, Tasks.

**Files to modify/create:**
- `components/views/dashboard-welcome.tsx` - NEW
- `components/views/session-console.tsx` - NEW
- `components/views/tasks-kanban.tsx` - REFACTOR from existing kanban-view
- `components/session/session-message.tsx` - REFACTOR for new styling
- `components/session/tool-call-block.tsx` - NEW
- `components/session/typing-indicator.tsx` - NEW

**Key decisions:**
- Session console reuses existing `use-session-messages` hook
- Tasks kanban simplifies to 2 columns (no In Progress)
- Dashboard welcome shows data from `ConnectionContext`

### Phase 4: Input & Notifications (P2 - US6, US7, US8)

Implement the omni-box input and toast notifications.

**Files to modify/create:**
- `components/input/omni-box.tsx` - NEW
- `components/input/decision-toast.tsx` - NEW (replaces question-drawer)
- `components/input/failed-toast.tsx` - NEW

**Key decisions:**
- Omni-box integrates with existing workflow answer submission
- Decision toast uses fixed positioning (bottom-center)
- Failed toast uses same positioning pattern

### Phase 5: History & Context (P3 - US10, US11)

Implement History view and Context drawer content.

**Files to modify/create:**
- `components/views/history-timeline.tsx` - REFACTOR from existing
- `components/layout/context-drawer.tsx` - ADD content (tabs, task, files)

**Key decisions:**
- History uses existing `use-session-history` hook
- Context drawer has two tabs: Context and Activity
- Phase progress stepper is hardcoded to 4 steps

### Phase 6: Project List & Polish (P3 - US12, US13)

Apply design system to project list page and add visual polish.

**Files to modify/create:**
- `app/page.tsx` - REFACTOR for new styling
- `components/projects/project-card.tsx` - REFACTOR for glass styling
- Verify grid background and orbs render on all pages

**Key decisions:**
- Project list uses same layout shell (icon sidebar, header)
- Project cards use GlassCard primitive
- Status pills on cards match header status pill

### Phase 7: Keyboard Shortcuts & Integration

Wire up keyboard shortcuts and ensure all pieces work together.

**Files to modify/create:**
- Add keyboard event handlers for ⌘K, ⌘1-4
- Integration testing of full workflow

## Dependencies Graph

```
Phase 1 (Design System)
    ↓
Phase 2 (Layout) ─────────────────────────┐
    ↓                                      │
Phase 3 (Views) ──────────────────────────┤
    ↓                                      │
Phase 4 (Input/Notifications) ────────────┤
    ↓                                      │
Phase 5 (History/Context) ────────────────┤
    ↓                                      │
Phase 6 (Project List) ───────────────────┘
    ↓
Phase 7 (Integration)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing workflows | Keep all hooks and API calls unchanged |
| Performance from animations | Use CSS transforms, will-change hints |
| Scope creep | Strict adherence to mockup as source of truth |
| Component sprawl | Organize into clear directories, barrel exports |

## Testing Strategy

1. **Visual testing**: Compare rendered UI against mockup
2. **Functional testing**: Verify workflows still work (start, answer, cancel)
3. **Keyboard testing**: Test all shortcuts (⌘K, ⌘1-4)
4. **State testing**: Verify UI updates correctly for all workflow states

## Definition of Done

- [ ] All 13 user stories have passing acceptance scenarios
- [ ] Design system primitives are documented in components/design-system/
- [ ] No regressions in workflow functionality
- [ ] Visual match with mockup at >90% fidelity
- [ ] Keyboard shortcuts functional
- [ ] Project list and project details both use new design
