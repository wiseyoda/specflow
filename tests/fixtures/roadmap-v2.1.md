# Project Roadmap (v2.1 Format)

Test fixture for new 4-digit ABBC format.

## Phase Overview

| Phase | Name | Status | Verification Gate |
|-------|------|--------|-------------------|
| 0010 | Foundation | ✅ Complete | Core structure works |
| 0020 | Core Features | 🔄 In Progress | Features accessible |
| 0021 | Hotfix Auth | ⬜ Not Started | Auth bug fixed |
| 0030 | Polish | ⬜ Not Started | Ready for release |

---

## Verification Gates

All gates require manual verification before phase completion.

---

### 0010 - Foundation

**Goal**: Set up the basic project structure.

**Scope**:
- Initialize project files
- Set up configuration
- Create basic CLI

**Deliverables**:
- `bin/cli` - Main entry point
- `config.json` - Configuration file

**Verification Gate**:
- CLI runs without errors

---

### 0020 - Core Features

**Goal**: Implement the main functionality.

**Scope**:
- Add feature A
- Add feature B
- Integration tests

**Deliverables**:
- Feature A implementation
- Feature B implementation

**Verification Gate**:
- All features work correctly

---

### 0021 - Hotfix Auth

**Goal**: Fix authentication bug discovered during testing.

**Scope**:
- Fix token refresh issue
- Add retry logic

**Deliverables**:
- Updated auth module

**Verification Gate**:
- Auth bug fixed

---

### 0030 - Polish

**Goal**: Final polish and documentation.

**Scope**:
- Documentation
- Error handling improvements
- Performance optimization

**Deliverables**:
- README.md
- User guide

**Verification Gate**:
- Ready for release

---

## Backlog

Deferred phases waiting for future prioritization.

| Phase | Name | Deferred Date | Reason |
|-------|------|---------------|--------|
| 0040 | Advanced Features | 2026-01-10 | Scope reduction for MVP |

### 0040 - Advanced Features

**Goal**: Add advanced features post-MVP.

**Scope**:
- Feature X
- Feature Y

**Deliverables**:
- Advanced feature implementations

**Verification Gate**:
- Features work correctly
