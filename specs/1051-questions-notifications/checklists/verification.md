# Verification Checklist - Phase 1051

## Browser Notifications (R1)

- [ ] V-001: First workflow start prompts for notification permission
- [ ] V-002: Permission prompt appears only once per browser session
- [ ] V-003: Notification appears when questions pending (permission granted)
- [ ] V-004: No error when notifications denied or unsupported
- [ ] V-005: Clicking notification focuses dashboard tab

## Question Badge on Cards (R2)

- [ ] V-006: Yellow badge with "?" visible on card when workflow waiting
- [ ] V-007: Badge shows question count accurately
- [ ] V-008: Badge not visible when workflow not waiting
- [ ] V-009: Clicking badge navigates to project detail

## Question Badge in Header (R3)

- [ ] V-010: Badge visible next to project name when waiting
- [ ] V-011: Clicking badge opens question drawer

## Question Drawer (R4)

- [ ] V-012: Drawer slides in from right on open
- [ ] V-013: Single-select questions show as radio buttons
- [ ] V-014: Multi-select questions show as checkboxes
- [ ] V-015: Text questions show as textarea
- [ ] V-016: Submit button disabled until all answered
- [ ] V-017: Submit shows loading spinner
- [ ] V-018: Drawer closes on successful submission
- [ ] V-019: Error toast appears on submission failure

## Free-form Follow-up (R5)

- [ ] V-020: Follow-up textarea visible at bottom of drawer
- [ ] V-021: Follow-up text optional (can submit without)
- [ ] V-022: Follow-up text included in submission

## End-to-End

- [ ] V-023: Start workflow → questions appear → answer → workflow continues
- [ ] V-024: Multi-question workflow answered correctly
