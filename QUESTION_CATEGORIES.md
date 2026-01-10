# SpecKit Interview Question Categories

> Universal framework for software requirements elicitation adapted for SDD (Spec-Driven Development).
> Adapts to any project type through Phase 0 discovery. Outputs feed directly into SpecKit memory documents.

## How This Framework Works

1. **Phase 0 (Discovery)** - Quickly learn what kind of project this is
2. **Populate `.specify/discovery/context.md`** - Record project type, constraints, relevance filters
3. **Adapt subsequent phases** - Skip irrelevant questions, add domain-specific ones
4. **Build questions on answers** - Each round references previous decisions
5. **Phase 11 (Memory Bootstrap)** - Generate draft memory documents for SpecKit

## Output Structure

All outputs go to `.specify/` folder following SDD best practices:

```
.specify/
├── discovery/                    # Interview artifacts
│   ├── state.md                  # Interview progress tracking
│   ├── context.md                # Project context and constraints
│   ├── decisions.md              # ADR-style decision log
│   └── summary.md                # Executive summary
├── memory/                       # Generated memory documents
│   ├── constitution.md           # Project principles (from Phase 1, 4)
│   ├── tech-stack.md             # Technology choices (from Phase 5)
│   ├── coding-standards.md       # Code conventions (from Phase 5)
│   ├── api-standards.md          # API patterns (from Phase 3, 5)
│   ├── security-checklist.md     # Security requirements (from Phase 4, 6)
│   ├── testing-strategy.md       # Test approach (from Phase 9)
│   ├── glossary.md               # Domain terms (from Phase 2, 3)
│   ├── design-system.md          # Visual standards (from Phase 7)
│   ├── performance-budgets.md    # Performance targets (from Phase 4)
│   ├── ux-patterns.md            # UX conventions (from Phase 7)
│   └── adrs/                     # Architecture decisions (from Phase 5)
├── templates/                    # Spec/plan/task templates
├── scripts/                      # Automation scripts
└── archive/                      # Archived documents
```

## Sources & Methodology

This framework synthesizes:
- [Requirements Elicitation Techniques](https://www.softwaretestinghelp.com/requirements-elicitation-techniques/) - Interview best practices, 5 Whys technique
- [Product Discovery Questions](https://www.productboard.com/blog/essential-product-discovery-questions-for-impactful-product-development/) - Marty Cagan's 4 questions (valuable, usable, feasible, strategic)
- [Jobs-to-be-Done Framework](https://productschool.com/blog/product-fundamentals/jtbd-framework) - Understanding user motivations
- [Architecture Decision Records](https://adr.github.io/) - Capturing decisions with context and consequences
- [SDLC Requirements](https://www.altexsoft.com/blog/functional-and-non-functional-requirements-specification-and-types/) - Functional vs non-functional requirements
- [Spec-Driven Development](https://specdriven.dev/) - Memory documents, constitution-first approach

---

## Phase 0: Project Discovery (Q1-8)

> CRITICAL: Complete this phase first. It shapes all subsequent questions.

### 0.1 Project Identity (Q1-4)
- What is this project? (one sentence)
- What type of software is this? (CLI, API, web app, library, mobile, etc.)
- Who is this for? (developers, end users, machines, internal team)
- What stage is this? (greenfield, brownfield, rewrite, prototype)

### 0.2 Context & Constraints (Q5-8)
- What already exists? (existing code, prototypes, documents to reference)
- What's already decided? (technology constraints, team constraints, timeline)
- What's the team size and composition?
- What's the criticality level? (prototype, internal, production, mission-critical)

**After Phase 0:**
1. Create `.specify/` folder structure if not exists
2. Update `.specify/discovery/context.md` with project type taxonomy
3. Set relevance filters for all subsequent phases
4. Identify domain-specific concerns needing custom questions
5. List reference materials to review

**Memory Document Impact:**
- → `constitution.md`: Product Vision section (draft)

---

## Adaptation Rules

After Phase 0, apply these rules to subsequent phases:

### By Project Type

| Project Type | Emphasize | De-emphasize |
|--------------|-----------|--------------|
| CLI Tool | UX (CLI design), Error messages | Scalability, Real-time |
| Library/SDK | API design, Versioning, Docs | Deployment, Operations |
| API Service | Performance, Security, Reliability | Desktop UX |
| Web Application | UX, Accessibility, Performance | CLI interface |
| Mobile App | Offline, Battery, Platform-specific | Server operations |
| Infrastructure | Reliability, Security, Automation | End-user UX |
| Data Pipeline | Data quality, Scalability, Recovery | Real-time UX |
| AI/ML System | Data, Evaluation, Bias, Drift | Traditional testing |

### By Criticality

| Level | Emphasize | Acceptable to Skip |
|-------|-----------|-------------------|
| Prototype | Speed, Learning | Reliability, Security, Ops |
| Internal | Functionality | Polish, Extensive docs |
| Production | Reliability, Security, Ops | Nothing - cover all |
| Mission-critical | Everything + Redundancy | Nothing |

---

## Phase 1: Problem & Vision (Q9-24)

> Establish the "why" before the "what". Understand the job to be done.

### 1.1 Problem Statement
- What specific pain point does this solve?
- Who experiences this pain most acutely?
- What's the cost of not solving this? (time, money, frustration)
- What triggers the need? (When does the user "hire" this product?)

### 1.2 Current State
- How do people solve this today? (workarounds, manual processes)
- What's broken about current solutions?
- What would make someone switch to this?

### 1.3 Success Criteria
- How will you know this succeeded?
- What metrics matter? (quantitative)
- What feelings matter? (qualitative)

### 1.4 Scope Boundaries
- What is explicitly NOT in scope?
- What adjacent problems will you ignore?
- What constraints are non-negotiable?

**Memory Document Impact:**
- → `constitution.md`: Product Vision, Core Principles (draft)
- → `glossary.md`: Key domain terms identified

---

## Phase 2: Users & Stakeholders (Q25-36)

> Who cares about this and why? Different users have different needs.

### 2.1 User Types
- Who are the primary users? (hands on keyboard)
- Who are secondary users? (occasional, supervisory)
- Who are affected non-users? (receive outputs, impacted by system)
- What's the skill level assumed?

### 2.2 User Journeys
- What's the happy path workflow?
- Where do users spend most of their time?
- What tasks are frequent vs. rare?

### 2.3 Stakeholder Needs
- Who approves/funds this project?
- What do stakeholders care about that users don't?
- Who might resist this and why?

**Memory Document Impact:**
- → `glossary.md`: User personas, role definitions
- → `ux-patterns.md`: Primary workflows (draft)

---

## Phase 3: Functional Requirements (Q37-56)

> What does the system DO? Core capabilities and behaviors.

### 3.1 Core Functions
- What are the 3-5 essential capabilities?
- What actions can users take?
- What does the system do automatically?
- What outputs does it produce?

### 3.2 Data & State
- What data does the system manage?
- Where does data come from?
- Where does data go?
- What state must persist across sessions?

### 3.3 Integrations
- What external systems does it connect to?
- What APIs does it consume?
- What APIs does it expose?
- What data formats are required?

**Memory Document Impact:**
- → `api-standards.md`: Integration patterns, data formats (draft)
- → `glossary.md`: Data entities, domain concepts

---

## Phase 4: Non-Functional Requirements (Q57-76)

> HOW WELL does the system work? Quality attributes.

### 4.1 Performance
- What's acceptable latency for key operations?
- What's the expected throughput/load?
- What are the resource constraints? (memory, CPU, cost)

### 4.2 Reliability
- What's the availability requirement? (99.9%? Best effort?)
- What's the cost of downtime?
- What's the recovery time objective (RTO)?

### 4.3 Scalability
- What's the expected growth?
- What dimension scales? (users, data, requests)
- What's the ceiling before redesign?

### 4.4 Security
- What are the trust boundaries?
- What's the authentication model?
- What's the authorization model?
- What data is sensitive?

### 4.5 Maintainability
- Who maintains this? (skills, availability)
- What's the update/release cadence?
- What's the expected lifespan?

**Memory Document Impact:**
- → `constitution.md`: Non-functional principles (Security, Reliability)
- → `performance-budgets.md`: SLO/SLA targets (draft)
- → `security-checklist.md`: Security requirements (draft)

---

## Phase 5: Architecture & Design (Q77-96)

> How is it built? Technical structure and patterns.

### 5.1 High-Level Architecture
- What are the major components?
- How do components communicate?
- What's stateless vs. stateful?
- What's the deployment topology?

### 5.2 Technology Choices
- What languages/frameworks are required/preferred?
- What infrastructure is available?
- What existing systems must be leveraged?
- What technology is explicitly avoided?

### 5.3 Data Architecture
- How is data stored?
- How is data accessed?
- What's the consistency model?

### 5.4 Build & Deploy
- How is it built?
- How is it deployed?
- How is it versioned?

**Memory Document Impact:**
- → `tech-stack.md`: Complete technology matrix (draft)
- → `coding-standards.md`: Code conventions (draft)
- → `adrs/*.md`: Major architecture decisions

---

## Phase 6: Error Handling & Recovery (Q97-112)

> What happens when things go wrong? Failure modes and recovery.

### 6.1 Error Categories
- What types of errors are expected?
- What's transient vs. permanent?
- What's recoverable vs. fatal?

### 6.2 Detection & Alerting
- How are errors detected?
- Who gets notified?
- What's the escalation path?

### 6.3 Recovery Strategies
- What's automatic vs. manual recovery?
- How does retry logic work?
- How is state restored?

**Memory Document Impact:**
- → `security-checklist.md`: Error handling patterns
- → `api-standards.md`: Error response formats

---

## Phase 7: User Experience (Q113-124)

> How do people interact with it? Interface and feedback.

### 7.1 Interaction Model
- What's the primary interface? (CLI, API, UI, config files)
- What feedback do users receive?
- How do users know it's working?

### 7.2 Onboarding
- How do new users get started?
- What's the learning curve?
- What documentation exists?

### 7.3 Accessibility
- What accessibility requirements exist?
- What environments must be supported?
- What's the offline experience?

**Memory Document Impact:**
- → `design-system.md`: Visual/interaction standards (draft)
- → `ux-patterns.md`: Interaction patterns (draft)

---

## Phase 8: Operations & Observability (Q125-136)

> How is it run in production? Day-to-day operations.

### 8.1 Monitoring
- What metrics are critical?
- How is health checked?
- What dashboards exist?

### 8.2 Logging & Tracing
- What's logged?
- How long are logs retained?
- How is tracing/correlation done?

**Memory Document Impact:**
- → `performance-budgets.md`: Monitoring thresholds

---

## Phase 9: Testing & Quality (Q137-148)

> How is correctness verified? Testing strategy.

### 9.1 Test Strategy
- What's the testing pyramid? (unit, integration, e2e)
- What's the coverage target?
- What's tested automatically vs. manually?

### 9.2 Acceptance Criteria
- How is "done" verified?
- What's the acceptance test process?
- Who approves releases?

### 9.3 Quality Metrics
- What quality metrics are tracked?
- What's the bug SLA?
- How is regression prevented?

**Memory Document Impact:**
- → `testing-strategy.md`: Complete test approach (draft)

---

## Phase 10: Evolution & Extensibility (Q149-160)

> How does it grow? Future-proofing and change management.

### 10.1 Roadmap
- What's planned for phase 2?
- What's the long-term vision?
- What might change the direction?

### 10.2 Versioning & Compatibility
- How are breaking changes handled?
- What's the deprecation policy?
- What's the backwards compatibility window?

**Memory Document Impact:**
- → `constitution.md`: Governance, versioning policy

---

## Phase 11: Memory Bootstrap (Q161-172) [NEW]

> Generate SpecKit memory documents from interview decisions.

### 11.1 Constitution Review
- Review all principles captured - are they complete?
- What's the governance model for changing principles?
- Who has authority to amend the constitution?

### 11.2 Tech Stack Finalization
- Confirm all technology choices
- Identify any gaps in tooling decisions
- Document package policies (must-use, must-not-use)

### 11.3 Standards Review
- Are coding standards complete enough?
- Are API standards documented?
- Is security checklist comprehensive?

### 11.4 Memory Document Generation
- Generate draft memory documents from decisions
- Identify gaps requiring follow-up
- Prioritize documents for `/speckit.constitution` refinement

**Output:**
- Draft memory documents in `.specify/memory/`
- Gap analysis report
- Handoff prompt for `/speckit.constitution`

---

## Question Dependencies Graph

```
Phase 0 (Discovery)
    └──> Phase 1 (Problem/Vision) ──> constitution.md (vision)
             └──> Phase 2 (Users) ──> glossary.md, ux-patterns.md
                      └──> Phase 3 (Functional) ──> api-standards.md
                               ├──> Phase 4 (Non-Functional) ──> security, performance
                               ├──> Phase 5 (Architecture) ──> tech-stack.md, adrs/
                               └──> Phase 7 (UX) ──> design-system.md
                                        │
    Phase 4 ─────────────────┬─┴──> Phase 6 (Errors)
    Phase 5 ─────────────────┘          │
                                        v
                              Phase 8 (Operations)
                                        │
                                        v
                              Phase 9 (Testing) ──> testing-strategy.md
                                        │
                                        v
                              Phase 10 (Evolution)
                                        │
                                        v
                              Phase 11 (Memory Bootstrap) ──> All memory docs
```

---

## Decision to Memory Document Mapping

| Decision Category | Memory Document | Sections Affected |
|-------------------|-----------------|-------------------|
| Vision, principles | `constitution.md` | Product Vision, Core Principles |
| User types, personas | `glossary.md` | Domain Terms |
| Data entities | `glossary.md` | Data Model Terms |
| Technology choices | `tech-stack.md` | Version Matrix, Package Policies |
| Architecture decisions | `adrs/*.md` | Individual ADRs |
| Code conventions | `coding-standards.md` | All sections |
| API patterns | `api-standards.md` | Request/Response, Errors |
| Security requirements | `security-checklist.md` | All sections |
| Performance targets | `performance-budgets.md` | Budgets, Thresholds |
| Test approach | `testing-strategy.md` | Pyramid, Coverage |
| UX patterns | `ux-patterns.md` | Interactions, Feedback |
| Visual standards | `design-system.md` | Colors, Typography, Components |

---

## Interview Execution Notes

### For the Interviewer (Claude)

1. **Start each round with context**: "Based on your answer about X, I want to explore Y"
2. **Offer options but allow custom answers**: Use the AskUserQuestion tool with good defaults
3. **Capture decisions immediately**: Update `.specify/discovery/decisions.md` after each round
4. **Note open questions**: Not everything gets answered - track what needs follow-up
5. **Track memory document impacts**: Note which decisions affect which memory docs
6. **Challenge vague answers**: "Can you be more specific?" "What's an example?"
7. **Surface trade-offs**: "If you want A, you might have to sacrifice B"

### For the Interviewee

1. **Think out loud**: Share your reasoning, not just conclusions
2. **Say "I don't know"**: It's better to flag uncertainty than guess
3. **Provide examples**: Concrete scenarios clarify abstract requirements
4. **Push back**: If a question doesn't apply, say so
5. **Mention constraints**: Budget, timeline, team skills matter
