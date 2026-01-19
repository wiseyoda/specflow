# Lessons Learned - Phase 1051: Questions & Notifications

## Decisions

- **Chose div with overflow instead of ScrollArea**: The ScrollArea component didn't exist in the UI library, so used a simple div with `overflow-y-auto` for the scrollable question area. Works well and is simpler.

- **Notification permission on first workflow start**: Requesting permission before the workflow begins (not when questions arrive) provides a more predictable user experience and avoids interrupting the workflow.

- **Status transition detection via ref**: Used `previousStatusRef` to track status changes and detect transitions to `waiting_for_input`. This prevents multiple notifications from firing during re-renders.

## Patterns

- **Drawer state lifted to page component**: Rather than managing drawer open/close state within StatusView, lifted it to the project detail page. This allows the header badge and status view to both control the drawer.

- **Question key derivation**: Used `question.header || \`q${index}\`` pattern for answer keys, matching the POC debug page implementation. This ensures consistent API communication.

- **Multi-select serialization**: Used comma-separated string format for multi-select answers, which matches the existing API expectations.

## Gotchas

- **Build error for missing UI component**: Initially imported ScrollArea which didn't exist. Always check available UI components in `components/ui/` before using.

- **Hook parameter changes**: When adding `projectName` option to `useWorkflowExecution`, needed to update the project detail page to pass the project before the hook call (moved project lookup earlier in the component).
