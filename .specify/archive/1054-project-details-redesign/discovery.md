# Discovery: Project Details Redesign

**Phase**: `1054-project-details-redesign`
**Created**: 2026-01-19
**Status**: Complete

## Phase Context

**Source**: ROADMAP Phase 1054 + User clarification
**Goal**: Comprehensive UI overhaul transforming both the project list and project details pages to match the v3 mockup design, while establishing reusable design patterns for the entire dashboard.

---

## Codebase Examination

### Related Implementations

| Location | Description | Relevance |
|----------|-------------|-----------|
| `packages/dashboard/app/projects/[id]/page.tsx` | Project details page | Primary redesign target |
| `packages/dashboard/app/page.tsx` | Projects listing page | Secondary redesign target |
| `packages/dashboard/components/layout/` | Header, Sidebar, MainLayout | Will be replaced/refactored |
| `packages/dashboard/components/projects/` | 24 project-related components | Many will be refactored |
| `packages/dashboard/components/ui/` | 10 shadcn/ui components | Foundation to build upon |
| `packages/dashboard/hooks/` | 9 data fetching hooks | Will be reused as-is |
| `packages/dashboard/contexts/` | ConnectionContext | State management stays |
| `mockups/project-details-redesign/index-v3.html` | Target design mockup | Design reference |

### Existing Patterns & Conventions

- **Component Structure**: "use client" directive, Props interface at top, cn() for className merging
- **Data Fetching**: Custom hooks with polling (3s intervals), SSE for real-time updates
- **Styling**: Tailwind CSS with `dark:` prefix for dark mode, neutral color palette
- **State Management**: React Context (ConnectionContext) distributes project/state data
- **UI Components**: shadcn/ui primitives (Button, Card, Sheet, Dialog, etc.)

### Integration Points

- **SSE Events**: `/api/events` stream for real-time updates - unchanged
- **API Endpoints**: All existing endpoints remain unchanged
- **Hooks**: All existing hooks (use-workflow-execution, use-session-messages, etc.) remain
- **ConnectionContext**: Core state distribution - unchanged

### Constraints Discovered

- **React 19 + Next.js 16**: Must use current React patterns (server/client components)
- **shadcn/ui**: Build on existing primitives, don't replace
- **Dark Mode Only**: Mockup is dark-only, current app supports light/dark - decision: dark-mode first
- **Tailwind 3.x**: Use standard Tailwind config extension patterns

---

## Requirements Sources

### From ROADMAP/Phase File

1. Icon-only sidebar navigation with tooltips and hotkeys (⌘1-4)
2. Centered status pill in header (idle/running/waiting/failed states)
3. Dashboard view (idle state welcome) with quick actions
4. Session view (inline console) with agent attribution
5. Omni-box unified input with state-aware styling
6. Decision toast for questions (replaces modal)
7. Failed state toast for errors
8. Tasks view (2-column Kanban)
9. History view (master-detail timeline)
10. Context drawer (right-side collapsible)
11. Visual polish (glass morphism, grid, orbs, animations)
12. Keyboard shortcuts (⌘K, ⌘1-4)

### From User Clarification

- **Comprehensive UI overhaul** - not just project details
- **Reusable design patterns** - establish design system foundation
- **Project list view redesign** - apply new patterns to listing page

### From Memory Documents

- **Constitution Principle VII**: Three-Line Output Rule (less relevant for UI)
- **Tech Stack**: Next.js 16, React 19, Tailwind 3.x, shadcn/ui
- **Coding Standards**: TypeScript strict mode, Zod validation

---

## Scope Clarification

### Questions Asked

#### Question 1: Navigation Approach

**Context**: Current app has a full left sidebar with project list. Mockup shows icon-only sidebar.

**Question**: How should we handle the mockup's sidebar navigation vs the current left sidebar?

**Options Presented**:
- A (Recommended): Replace entirely - Remove current sidebar, use new icon-only sidebar
- B: Keep both - Icon sidebar for views, existing sidebar for project list
- C: Adapt existing - Modify current sidebar to match mockup style

**User Answer**: Replace entirely (Recommended)

---

#### Question 2: Design System Foundation

**Context**: Need to establish reusable patterns for the UI overhaul.

**Question**: For the design system foundation, what level of abstraction do you want?

**Options Presented**:
- A (Recommended): Tailwind config + primitives - Extend config with colors/animations, create reusable components
- B: Full design tokens - Comprehensive CSS variables system
- C: Minimal - Focus on components only

**User Answer**: Tailwind config + primitives (Recommended)

---

#### Question 3: Project List Layout

**Context**: Current project list uses card layout. Could use different pattern.

**Question**: For the project list view, should we use the card-based layout or introduce a different pattern?

**Options Presented**:
- A (Recommended): Enhanced cards - Keep cards but apply new design styling
- B: Table/list view - Switch to table format
- C: Both with toggle - Support both views

**User Answer**: Enhanced cards (Recommended)

---

#### Question 4: Visual Polish Level

**Context**: Mockup includes decorative elements (floating orbs, grid background).

**Question**: Should we include the floating orbs and grid background from the mockup?

**Options Presented**:
- A (Recommended): Yes - full visual polish matching mockup
- B: Subtle version - Grid yes, tone down orbs
- C: No decorative elements - Focus on functionality

**User Answer**: Yes - full visual polish (Recommended)

---

### Confirmed Understanding

**What the user wants to achieve**:
A comprehensive UI overhaul that transforms both the project list and project details pages to match the polished v3 mockup design. This includes establishing reusable design patterns (design system primitives) that can be used throughout the dashboard.

**How it relates to existing code**:
- Replace current layout structure (sidebar, header) with new icon-based navigation
- Refactor existing components to use new design patterns
- Keep all data hooks and API integration unchanged
- Build on existing shadcn/ui foundation

**Key constraints and requirements**:
- Maintain full functionality during redesign
- Reuse existing hooks and state management
- Create reusable primitives for consistent styling
- Support keyboard shortcuts (⌘K, ⌘1-4)
- Full visual polish (glass effects, orbs, grid, animations)

**Technical approach**:
1. Extend Tailwind config with mockup's color palette and animations
2. Create design system primitives (StatusPill, GlassCard, etc.)
3. Build new layout components (IconSidebar, redesigned Header)
4. Refactor existing views to use new primitives
5. Apply consistent styling to project list page

**User confirmed**: Yes - 2026-01-19

---

## Recommendations for SPECIFY

### Should Include in Spec

1. **Design System Foundation**
   - Extended Tailwind config (colors, animations, keyframes)
   - Primitive components (StatusPill, GlassCard, OmniBox, Toast variants)
   - Background elements (grid, floating orbs)

2. **Layout Components**
   - IconSidebar with tooltips and indicators
   - Redesigned Header with centered status
   - Context drawer (right panel)

3. **Project Details Views**
   - Dashboard (idle welcome)
   - Session (inline console)
   - Tasks (2-column Kanban)
   - History (master-detail timeline)

4. **Interactive Components**
   - OmniBox input
   - DecisionToast (questions)
   - FailedToast (errors)
   - Notification panel

5. **Project List Page**
   - Enhanced project cards with new styling
   - Consistent visual language

6. **Keyboard Shortcuts**
   - ⌘K: Focus omni-box
   - ⌘1-4: View navigation

### Should Exclude from Spec (Non-Goals)

- Light mode support (focus on dark mode first)
- Settings page implementation
- User avatar/profile functionality
- Attachment upload (paperclip button - UI only, no backend)
- Mobile responsive design (desktop-only per tech stack)

### Potential Risks

- **Breaking existing functionality**: Mitigation - comprehensive testing of data flows
- **Scope creep**: Mitigation - strict adherence to mockup as source of truth
- **Performance impact from animations**: Mitigation - use CSS animations, hardware acceleration
- **Accessibility**: Mitigation - maintain keyboard navigation, proper ARIA attributes

### Questions to Address in CLARIFY

- None remaining - scope is clear
