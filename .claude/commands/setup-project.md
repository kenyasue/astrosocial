---
description: "Initial setup: interactively create the six persistent documents"
---

# Initial Project Setup

This command interactively creates the project's six persistent documents.

## How to Run

```bash
claude
> /setup-project
```

## Pre-Run Check

Check the files in the `docs/ideas/` directory.
```bash
# Check
ls docs/ideas/

# If files exist
✅ Found docs/ideas/initial-requirements.md
   The PRD will be created based on its contents

# If no files exist
⚠️  No files found in docs/ideas/
   The PRD will be created interactively
```

## Procedure

### Step 0: Read the Inputs

1. Read all markdown files in `docs/ideas/`
2. Understand their contents and use them as reference for creating the PRD

### Step 1: Create the Product Requirements Document

1. Load the **prd-writing skill**
2. Create `docs/product-requirements.md` based on the contents of `docs/ideas/`
3. Flesh out the ideas raised during brainstorming:
   - Detailed user stories
   - Acceptance criteria
   - Non-functional requirements
   - Success metrics
4. Ask the user for confirmation and **wait until approved**

**The subsequent steps are based on the Product Requirements Document, so they are created automatically**

### Step 2: Create the Functional Design Document

1. Load the **functional-design skill**
1. Read `docs/product-requirements.md`
3. Create `docs/functional-design.md` following the skill's template and guide

### Step 3: Create the Architecture Design Document

1. Load the **architecture-design skill**
2. Read the existing documents
3. Create `docs/architecture.md` following the skill's template and guide

### Step 4: Create the Repository Structure Document

1. Load the **repository-structure skill**
2. Read the existing documents
3. Create `docs/repository-structure.md` following the skill's template

### Step 5: Create the Development Guidelines

1. Load the **development-guidelines skill**
2. Read the existing documents
3. Create `docs/development-guidelines.md` following the skill's template

### Step 6: Create the Glossary

1. Load the **glossary-creation skill**
2. Read the existing documents
3. Create `docs/glossary.md` following the skill's template

## Completion Criteria

- All six persistent documents have been created

Completion message:
```
"Initial setup is complete!

Documents created:
✅ docs/product-requirements.md
✅ docs/functional-design.md
✅ docs/architecture.md
✅ docs/repository-structure.md
✅ docs/development-guidelines.md
✅ docs/glossary.md

You are now ready to start development.

How to use going forward:
- Editing documents: just ask in normal conversation
  Examples: 'Add a new feature to the PRD', 'Review architecture.md'

- Adding features: run /add-feature [feature name]
  Example: /add-feature User authentication

- Document review: run /review-docs [path]
  Example: /review-docs docs/product-requirements.md
"
```
