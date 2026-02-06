# SpecFlow Agent Team Roles

These project-scoped Claude agent definitions support Agent Teams mode in flow commands.

## Roles

- `specflow-coordinator`: Lead orchestration, synchronization, and aggregation.
- `specflow-codebase-scanner`: Codebase pattern and dependency discovery.
- `specflow-memory-checker`: Constitution and memory-doc compliance checks.
- `specflow-researcher`: Focused external research and option analysis.
- `specflow-quality-auditor`: Artifact quality and verification checks.
- `specflow-goal-coverage`: Goal -> requirement -> task mapping.
- `specflow-fixer`: File-scoped artifact fixes during analyze loops.
- `specflow-review-scanner`: Category scan worker for flow.review.
- `specflow-doc-assembler`: Structured document and checklist assembly.
- `specflow-implementation-worker`: Independent [P] task implementation worker.

## Usage

Flow commands should prefer Agent Teams when available:
- Require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Fall back to Task agents when Agent Teams are unavailable
- Preserve write isolation and synchronization barriers
