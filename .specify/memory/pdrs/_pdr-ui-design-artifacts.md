# PDR: UI/UX Design Artifacts

**PDR ID**: `pdr-ui-design-artifacts`
**Created**: 2026-01-11
**Author**: Agent (with user review)
**Status**: Implemented
**Phase**: 0050 - UX Simplification
**Priority**: P1

---

## Problem Statement

**The Problem**: When phases involve visual UI changes (dashboards, forms, screens), Claude makes UI/UX decisions during implementation without documenting the design rationale. This leads to inconsistent interfaces, missed design considerations, and difficulty reviewing/revising UI decisions after the fact.

**Who is affected**:
- Users reviewing implementations who can't see what was intended vs what was built
- Future developers who don't understand why UI decisions were made
- The agent itself, which lacks design constraints during implementation

**Current workaround**: UI decisions are made ad-hoc during implementation with no before/after documentation.

**Why now**: Phase 0050 (UX Simplification) involves documentation changes. Before building the Web UI Dashboard (Phase 1010), we need a process for UI design documentation.

---

## Desired Outcome

**After this feature ships, users will be able to**:
- See proposed UI changes BEFORE implementation begins
- Compare before/after states with clear rationale
- Review and approve UI designs during specification phase
- Reference design decisions during implementation

**The experience should feel**: intentional, reviewable, traceable

---

## User Stories

### Story 1: UI Phase Detection
**As a** SpecFlow user starting a UI-heavy phase,
**I want** the system to detect that my phase involves visual UI changes,
**So that** it automatically creates UI design documentation.

**Value**: No manual step to remember; UI design is captured by default.

**Detection keywords**: dashboard, form, button, screen, page, view, component, interface, modal, dialog, panel, widget, layout, navigation, menu, sidebar, header, footer

---

### Story 2: Before/After Documentation
**As a** reviewer of a UI phase,
**I want to** see the current state, proposed design, and rationale for changes,
**So that** I can understand and approve the design before implementation.

**Value**: Design decisions are explicit and reviewable.

---

### Story 3: Visual Mockups
**As a** developer implementing UI changes,
**I want to** see ASCII mockups or Mermaid diagrams of the proposed UI,
**So that** I have a clear target to implement toward.

**Value**: Reduces ambiguity, prevents "going rogue" with UI decisions.

---

### Story 4: Inline References
**As a** reader of spec.md,
**I want to** see links to UI designs inline with the requirements that describe them,
**So that** I can quickly navigate to relevant design documentation.

**Value**: Contextual linking reduces cognitive load.

---

## Success Criteria

| Criterion | Target | How We'll Measure |
|-----------|--------|-------------------|
| UI phases detected | 95%+ accuracy | Phases with UI keywords get ui/ folder |
| Design doc completeness | All UI phases have before/after/rationale | Manual review of generated docs |
| Implementation alignment | UI matches design | Verification step compares output to design |

---

## Constraints

- **Must**: Auto-detect UI phases (not manual opt-in)
- **Must**: Create documentation during `/specflow.specify` (early in workflow)
- **Must**: Verify existence during `/specflow.plan` (safety net)
- **Should**: Use mixed format (descriptions + ASCII + Mermaid)
- **Must Not**: Require external tools (no Figma, no image generation)
- **Must Not**: Block non-UI phases with unnecessary folders

---

## Non-Goals

- **Not solving**: Pixel-perfect mockups (use descriptions and ASCII)
- **Not solving**: Interactive prototypes
- **Out of scope**: CLI output formatting (this PDR is Visual UI only)
- **Out of scope**: Design system / component library management

---

## Dependencies

| Dependency | Type | Impact | Status |
|------------|------|--------|--------|
| `/specflow.specify` command | Blocking | Must modify to detect UI and create folder | Exists |
| `/specflow.plan` command | Blocking | Must modify to verify UI docs exist | Exists |
| `spec-template.md` | Informational | May need UI section guidance | Exists |

---

## Open Questions

- [ ] Should we add UI design to the verification checklist automatically?
- [ ] Should `design.md` have a template, or be free-form?
- [x] Should CLI output be included? → **Answer**: No, Visual UI only (user decision)

---

## Acceptance Criteria

### Must Complete

1. [ ] **Detection logic** added to `/specflow.specify`:
   - Scan phase scope/goal for UI keywords
   - Keywords: dashboard, form, button, screen, page, view, component, interface, modal, dialog, panel, widget, layout, navigation, menu, sidebar, header, footer
   - If detected: create `specs/XXXX/ui/` folder

2. [ ] **design.md** created with structure:
   ```markdown
   # UI/UX Design: [Phase Name]

   ## Current State (Before)
   [Description of existing UI, or "New feature - no existing UI"]

   ## Proposed Design (After)
   [Description of proposed UI]

   ### Visual Mockup
   ```
   [ASCII mockup or Mermaid diagram]
   ```

   ## Rationale
   [Why these design decisions were made]

   ## Component Inventory
   | Component | Type | Notes |
   |-----------|------|-------|
   | [name] | [button/form/panel/etc] | [description] |
   ```

3. [ ] **Inline references** in `spec.md`:
   - Where requirements mention UI elements, add: `(see [ui/design.md](ui/design.md#section))`
   - Link to specific sections using anchors

4. [ ] **Plan verification** in `/specflow.plan`:
   - Check if phase is UI-related (from spec or scope keywords)
   - If yes, verify `ui/design.md` exists
   - If missing, create it (with TODO markers)
   - Reference design in implementation approach

5. [ ] **Template** created at `templates/ui-design-template.md`

### Should Complete

6. [ ] Add to verification checklist: "UI implementation matches design.md"
7. [ ] Gate check in `/specflow.gate implement` for UI phases

---

## Related PDRs

- `pdr-ux-simplification` - Phase 0050, documentation updates (parallel work)

---

## Notes

### Example UI Detection

**Phase scope that SHOULD trigger UI docs:**
- "Build dashboard showing project status"
- "Add settings form for user preferences"
- "Create navigation sidebar"

**Phase scope that should NOT trigger UI docs:**
- "Refactor state management"
- "Add CLI command for issue tracking"
- "Fix validation bug in parser"

### Example design.md Output

```markdown
# UI/UX Design: Web UI Dashboard

## Current State (Before)
No existing dashboard. Users interact via CLI only.

## Proposed Design (After)
A web-based dashboard showing all registered SpecFlow projects with:
- Project cards in a grid layout
- Real-time status indicators
- Quick action buttons

### Visual Mockup
```
┌─────────────────────────────────────────────────────────┐
│  SpecFlow Dashboard                        [Settings] [?]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Project A   │  │ Project B   │  │ Project C   │     │
│  │ Phase: 003  │  │ Phase: 001  │  │ Complete    │     │
│  │ ● Active    │  │ ○ Paused    │  │ ✓ Done      │     │
│  │             │  │             │  │             │     │
│  │ [Continue]  │  │ [Resume]    │  │ [Archive]   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Rationale
- Grid layout scales with project count
- Status indicators visible at glance
- Action buttons reduce clicks to continue work

## Component Inventory
| Component | Type | Notes |
|-----------|------|-------|
| Header | navigation | Logo, settings, help |
| ProjectCard | card | Displays single project |
| StatusIndicator | badge | Active/Paused/Complete |
| ActionButton | button | Primary action per state |
```
