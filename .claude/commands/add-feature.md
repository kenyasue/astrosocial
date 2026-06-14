---
description: Implement a new feature following existing patterns, fully autonomously without stopping
---

# Adding a New Feature (Fully Autonomous Execution Mode)

**Important:** This workflow is designed to run fully automatically from start to finish without user intervention. After completing each step, immediately move on to the next step. Do not ask the user for confirmation mid-thought or interrupt the work.

**Argument:** feature name (e.g. `/add-feature User profile editing`)

---

## Step 1: Preparation and Context Setup

1. Establish the current task context:
  - Feature name: `[the feature name given as an argument]`
  - Date: `[get the current date in YYYYMMDD format]`
  - Steering directory path: `.steering/[date]-[feature name]/`
2. Create the steering directory above.
3. Create the following three empty files:
  - `[steering directory path]/requirements.md`
  - `[steering directory path]/design.md`
  - `[steering directory path]/tasklist.md`

## Step 2: Understand the Project

1. Read `CLAUDE.md` to grasp the overall picture of the project.
2. Review the persistent documents in the `docs/` directory to understand the relevant design philosophy and architecture.
3. **If the feature has any user-facing UI, read `docs/phase1/design-guidelines.md` and treat it as mandatory** for every screen/component you build.

## Step 3: Investigate Existing Patterns

1. Use the Grep tool to search the source code (`src/`) for keywords related to the feature name.
  ```bash
  Grep('[keyword related to the feature]', 'src/')
  ```
2. Analyze the search results to identify existing implementation patterns, naming conventions, and how components are used.

## Step 4: Planning Phase (Automatic Generation of Steering Files)

1. Run `Skill('steering')` in **planning mode** to generate the contents of the three files created in Step 1 (`requirements.md`, `design.md`, `tasklist.md`).
2. **Once this step completes successfully, never stop; immediately proceed to Step 5.**

## Step 5: Implementation Loop (Fully Working Through tasklist.md)

**This step is a loop that repeats automatically until all tasks in `tasklist.md` are `[x]`.**
**Once this step completes successfully, never stop; immediately proceed to Step 6.**

**Loop start:**

1. Read the task list:
  - Read the `[steering directory path]/tasklist.md` file.

2. Check progress:
  - Check whether any incomplete tasks (`[ ]`) exist in the file.
  - **If no incomplete tasks exist:** consider this implementation loop complete and immediately proceed to **Step 6**.
  - **If incomplete tasks exist:** proceed to the next step (3. Execute the task).

3. Execute the task:
  - Identify one **incomplete task at the top** of `tasklist.md`.
  - Carry out the implementation work needed to complete that task.
  - Use `Skill('steering')` in **implementation mode**.
  - Always follow the coding standards in `Skill('development-guidelines')`.
  - **For any user-facing UI, always implement the design according to `docs/phase1/design-guidelines.md`**: use the shared theme tokens and page shell, support the dark (default) and light themes, and make it responsive (desktop + mobile, one codebase), clean, modern, and accessible. Never ship unstyled/plain HTML.

4. Update the task list:
  - Once the executed task is complete, use the `Edit` tool to update `tasklist.md`, changing the task from `[ ]` to `[x]`.

5. Continue the loop:
  - **Return to the top of Step 5 (1. Read the task list) and repeat the process.**

---
### * Exception-Handling Rules Within the Implementation Loop *

If any of the following situations occur while the implementation loop is running, handle them autonomously according to these rules and continue the loop.

- **Rule A: When a task is too large**
  - **Handling:** Break the current task into multiple smaller subtasks. Use the `Edit` tool to delete the original task and insert the new subtasks (with `[ ]`) in its place. Then continue the loop.

- **Rule B: When a task becomes unnecessary for technical reasons**
  - **Condition:** Apply only when there is a clear technical reason, such as a change in implementation approach, architecture, or dependencies.
  - **Handling:** Use the `Edit` tool to update the task in the format `[x] ~~task name~~ (Reason: [briefly describe the specific technical reason])`. Then continue the loop.

- **❌ Strictly Forbidden Actions:**
  - Intentionally skipping an incomplete task for reasons such as "do it later" or "make it a separate task."
  - Leaving incomplete tasks unaddressed and ending the loop without reason.
  - Asking the user to make a decision.

---

## Step 6: Implementation Validation (Launch a Subagent)

1. Do a final check that all tasks in `tasklist.md` are complete.
2. Use the `Task` tool to launch the `implementation-validator` subagent to validate quality.
  - `subagent_type`: "implementation-validator"
  - `description`: "Implementation quality validation"
  - `prompt`: "Please validate the quality of all the changes related to the `[feature name]` implemented this time. The target files are `[list of paths of the implemented files]`. Focus on coding standards, error handling, testability, and consistency with existing patterns."

**Once this step completes successfully, never stop; immediately proceed to Step 7.**

## Step 7: Automatically Generate E2E Tests (Playwright)

**Generate end-to-end tests for the user-facing behavior introduced by this feature.**

1. Ensure Playwright is available in the project:
  - Check whether `@playwright/test` is listed in `package.json` and a config file (`playwright.config.ts`/`playwright.config.js`) exists.
  - If it is not set up, install and initialize it:
    ```bash
    Bash('npm install --save-dev @playwright/test')
    Bash('npx playwright install --with-deps')
    ```
  - If no config exists, create a minimal `playwright.config.ts` (set `testDir` to `e2e/`, configure `baseURL`, and add a `webServer` entry that launches the app for local runs).

2. Identify the user-facing flows added or changed by this feature:
  - Derive the critical user journeys from `requirements.md` and `design.md` in the steering directory.
  - Cover the happy path plus key error/edge cases (validation failures, empty states, permission checks).

3. Generate Playwright spec files under `e2e/` (e.g. `e2e/[feature-name].spec.ts`):
  - Follow existing E2E patterns in the repo if any exist (search with `Grep('test(', 'e2e/')` and reuse the Page Object Model or helpers already in place).
  - Use stable selectors (prefer `getByRole`, `getByLabel`, or `data-testid`) over brittle CSS/XPath.
  - Keep each test independent and idempotent (set up and tear down its own state).

4. Run the generated E2E tests and confirm they pass:
  ```bash
  Bash('npx playwright test')
  ```
  - If a test fails, determine whether the cause is the test or the implementation, fix the root cause, and re-run until green.

**Once this step completes successfully, never stop; immediately proceed to Step 8.**

## Step 8: Run Automated Tests

1. Run the following commands in order and confirm that all tests pass.
  ```bash
  Bash('npm test')
  Bash('npm run lint')
  Bash('npm run typecheck')
  ```
2. If any command produces an error, analyze the problem, generate and apply a fix, and then run this step again.

**Once this step completes successfully, never stop; immediately proceed to Step 9.**

## Step 9: Retrospective and Document Updates

1. Run `Skill('steering')` in **retrospective mode** and record handover notes in `tasklist.md`.
  - Implementation completion date
  - Differences between plan and actual
  - Lessons learned
  - Improvement suggestions for next time

2. Determine whether this change affects the project's fundamental design or architecture.

3. If there is an impact, use the `Edit` tool to update the relevant persistent documents in `docs/`.

## Completion Criteria

This workflow completes automatically once all of the following conditions are met.
- Step 5: All tasks in `tasklist.md` are complete (`[x]` or skipped for a valid reason).
- Any user-facing UI follows `docs/phase1/design-guidelines.md` (dark default + light theme, responsive single codebase, clean/modern/accessible — no unstyled HTML).
- Step 6: The `implementation-validator` subagent's validation passes.
- Step 7: E2E tests for the feature are generated with Playwright under `e2e/` and pass (`npx playwright test`).
- Step 8: The `test`, `lint`, and `typecheck` commands all succeed without errors.
- Step 9: Handover notes are recorded in `tasklist.md`.

Until these completion criteria are met, continue to think autonomously, solve problems, and carry on the work.
