# Project Memory

## Technology Stack

- Development environment: devcontainer
- Node.js v24.11.0
- TypeScript 5.x
- Package manager: npm

## Basic Principles of Spec-Driven Development

### Basic Flow

1. **Document creation**: Define "what to build" in persistent documents (`docs/`)
2. **Work planning**: Plan "what to do this time" in steering files (`.steering/`)
3. **Implementation**: Implement according to tasklist.md and update progress as you go
4. **Verification**: Testing and operation checks
5. **Update**: Update documents as needed

### Important Rules

#### When Creating Documents

**Create one file at a time, and always obtain the user's approval before moving on to the next.**

When waiting for approval, communicate clearly:
```
"The creation of [document name] is complete. Please review the content.
Once you approve, I will proceed to the next document."
```

#### Checks Before Implementation

Before starting a new implementation, always check the following:

1. Read CLAUDE.md
2. Read the related persistent documents (`docs/`)
3. Search for existing similar implementations with Grep
4. Understand existing patterns before starting implementation

#### Steering File Management

Create `.steering/[YYYYMMDD]-[task-name]/` for each piece of work:

- `requirements.md`: The requirements for this work
- `design.md`: The implementation approach
- `tasklist.md`: A concrete task list

Naming convention: `20250115-add-user-profile` format

#### Steering File Management

**Use the `steering` skill when planning work, implementing, and verifying.**

- **When planning work**: Mode 1 (creating steering files) via `Skill('steering')`
- **When implementing**: Mode 2 (implementation and tasklist.md update management) via `Skill('steering')`
- **When verifying**: Mode 3 (retrospective) via `Skill('steering')`

Detailed procedures and update-management rules are defined within the steering skill.

## Directory Structure

### Persistent Documents (`docs/`)

Define "what to build" and "how to build it" for the application. The specs are
organized by phase:

- **`docs/phase1/`** — the shipped MVP (M1–M12 + the app-shell redesign). This is the
  canonical, current specification. The shared **development-guidelines.md** and
  **design-guidelines.md** live here and apply to all phases.
- **`docs/phase2/`** — the next phase: building the sidebar destinations (Explore,
  Search, Notifications, Bookmarks, Discover) into full-featured experiences.

#### Drafts and Ideas (`docs/phase1/ideas/`)
- Outputs of brainstorming and ideation
- Technical research notes
- Free-form (minimal structure)

#### Official Documents (per phase)
- **product-requirements.md** - Product requirements document
- **functional-design.md** - Functional design document
- **architecture.md** - Technical specification
- **repository-structure.md** - Repository structure definition document
- **development-guidelines.md** - Development guidelines (shared, in `docs/phase1/`)
- **design-guidelines.md** - UI/UX + app-shell design rules (shared, in `docs/phase1/`)
- **glossary.md** - Ubiquitous language definitions
- **implementation-plan.md** - Milestone roadmap

### Work-Unit Documents (`.steering/`)

Define "what to do this time" for a specific development task:

- `requirements.md`: The requirements for this work
- `design.md`: The design of the changes
- `tasklist.md`: The task list

## Development Process

### Initial Setup

1. Use this template
2. Create persistent documents with `/setup-project` (interactively creating six)
3. Implement features with `/add-feature [feature]`

### Day-to-Day Usage

**Basically, just make requests through normal conversation:**

```bash
# Editing documents
> Please add a new feature to the PRD
> Review the performance requirements in architecture.md
> Add a new domain term to glossary.md

# Adding features (use commands for the standard flow)
> /add-feature edit user profile

# Detailed review (when a detailed report is needed)
> /review-docs docs/product-requirements.md
```

**Key point**: You do not need to be conscious of the details of spec-driven development. Claude Code will determine and load the appropriate skill.

## Principles of Document Management

### Persistent Documents (`docs/`)

- Describe the fundamental design
- Not updated frequently
- The "north star" for the entire project

### Work-Unit Documents (`.steering/`)

- Specialized for a specific task
- Created anew for each piece of work
- Retained as history
