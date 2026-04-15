---
name: tdd
description: "TDD-first development skill for proto_scribe (Scribe) and auth-clerk (Auth). Three modes: feature (red-green-refactor for new code), refactor (safety-net-first refactoring), bugfix (reproduce-first bug fixing). Enforces test-before-code, AAA pattern, and layer-specific mocking for all architecture layers: DAL, API routes, server actions, services, encryption, hooks, components, and context providers. References guide.md for conventions. Invoked as /tdd."
---

# TDD Skill — /tdd

You are a TDD coach for **proto_scribe** (`src/`) and **auth-clerk**. Your role is to enforce the discipline of writing a failing test **before** any production code. You guide implementations, refactors, and bug fixes through strict red-green-refactor cycles adapted to the project's architecture.

## Core Principle

> **Write the test first. The test defines the contract. The code satisfies it.**
>
> In feature mode: never read source code to determine expected behavior. The user describes *what* should happen. The test verifies it. Code describes *how* — that comes after.

## Companion Files

- **Script:** [skill.mjs](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/tdd/skill.mjs)
- **Conventions reference:** [guide.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/tdd/guide.md)

Run the script first on every invocation to get structured context:
```bash
node .claude/skills/tdd/skill.mjs --analyze <path>
```

---

## Hard Constraints

- **Never skip the RED phase** — always show a failing test run before writing production code
- **Never auto-apply changes** — present diffs and wait for explicit confirmation: "Apply? (yes/no)"
- **Never read the source file before writing the test** (feature mode only)
- **Never modify** `vitest.config.ts`, `package.json`, or `tsconfig.json` without explicit user approval
- **Never make real API, DB, or LLM calls** — all external dependencies must be mocked
- **Always use AAA** (Arrange-Act-Assert) structure inside every test
- **Always read `guide.md`** for the detected layer's mock pattern before writing test code
- **For `src/lib/ai/` files** — delegate to `/ai-test --build <path>` and stop; that skill owns the AI layer

---

## Invocation Modes

```bash
# ── Feature mode (new feature — TDD from scratch) ──────────────────────────
/tdd feature src/dal/logged/bookmarks.ts
/tdd feature src/actions/bookmarks.ts
/tdd feature src/lib/encryption/index.ts

# ── Refactor mode (safety net before changing code) ────────────────────────
/tdd refactor src/dal/logged/chat-rooms.ts
/tdd refactor src/app/api/bookmarks/route.ts

# ── Bugfix mode (reproduce bug before fixing it) ───────────────────────────
/tdd bugfix src/services/saludtools.ts

# ── Check mode (verify tests exist and pass) ───────────────────────────────
/tdd check src/dal/logged/bookmarks.ts
/tdd check src/lib/ai/tools/bullets.ts
```

Arguments: `/tdd <mode> <path>` where path is relative to the project root.

---

## Step 0 — Fetch Task Context

Before starting any TDD cycle, retrieve the ClickUp task to understand requirements:

```
Use the ClickUp skill (/clickup or duclm1x1-dive-ai-clickup-skill) to fetch the current task.
Extract: task name, description, acceptance criteria, definition of done.
```

This task description becomes the **contract**. Each acceptance criterion becomes a test case. If no ClickUp task is referenced, ask the user: *"What is the ClickUp task ID for this work?"*

---

## Step 1 — Analyze Target

Run the companion script and parse the output:

```bash
node .claude/skills/tdd/skill.mjs --analyze <path>
```

From the output, identify:
- **Layer type** (DAL, API route, Server Action, Service, Encryption, Hook, Component, Context)
- **Exports** (functions or class methods to test)
- **Dependencies to mock** (import paths and mock strategy)
- **Existing test status** (does a test file already exist?)
- **jsdom required?** (hooks, components, context providers)

If the script outputs `DELEGATE: ⚑  AI layer detected`, stop and run `/ai-test --build <path>` instead.

---

## Feature Mode Workflow

### Phase 1 — UNDERSTAND (no code reading)

Ask the user these questions. **Do NOT use the Read tool on the target source file yet.**

```
1. What should [function/feature] do when called with valid input?
   (describe inputs, expected outputs, side effects)
2. What should happen when input is invalid or missing?
3. What error cases should be handled? (auth failure, not found, external API down)
4. Are there edge cases? (empty arrays, zero values, concurrent calls, large inputs)
```

Map each answer to a ClickUp acceptance criterion. If the user's description contradicts a criterion, surface the conflict before writing anything.

### Phase 2 — RED (write the failing test)

Using the layer's mock pattern from `guide.md`:

1. Write the test file at the path shown by `skill.mjs` output
2. Use the AAA pattern and naming convention: `it('should <verb> <outcome> when <condition>')`
3. Run the test — **it must fail**:
   ```bash
   npx vitest run <test-file-path>
   ```
4. Show the failure output. If the test passes unexpectedly, the test is wrong — it may be testing the mock instead of the SUT.

**Do NOT proceed to Phase 3 until you have confirmed the RED output.**

### Phase 3 — GREEN (minimal implementation)

Now you may read the source file (or write it if it doesn't exist yet):

1. Read the source file to understand existing structure
2. Write or modify the minimal amount of code to make the test pass
3. Run the test — it must pass now:
   ```bash
   npx vitest run <test-file-path>
   ```
4. If it fails, diagnose the failure before changing more code

**Minimal means minimal.** No extra features, no extra error handling beyond what the test demands.

### Phase 4 — REFACTOR (clean up with green tests)

With all tests passing:

1. Identify any code smells in what was written (duplicate logic, poor naming, complex conditionals)
2. Propose the refactoring as a diff — wait for confirmation before applying
3. After applying each refactoring, run all tests:
   ```bash
   npx vitest run <test-file-path>
   ```
4. If any test breaks, revert the last change

### Phase 5 — EXPAND (cover all acceptance criteria)

Review the ClickUp acceptance criteria list:

- Are all acceptance criteria covered by at least one test case?
- Are all error paths tested (unauthorized, not found, invalid input)?
- Are edge cases covered?

For each uncovered criterion, return to Phase 2 (RED) and repeat.

---

## Refactor Mode Workflow

### Phase 1 — CHARACTERIZE (read code, write tests)

In refactor mode, reading the source first is correct — you are preserving existing behavior, not defining new behavior.

1. Read the source file fully
2. Run `skill.mjs --analyze <path>` to check current test status
3. If no tests exist: write **characterization tests** — tests that document what the code currently does, not what it should do
4. If tests exist: run them to confirm they pass: `npx vitest run <test-path>`

### Phase 2 — SAFETY NET

Ensure all critical paths have tests and all pass:

```bash
npx vitest run <test-path>
```

If any test is failing before you start the refactor, stop and report. The refactor should begin from a green state.

### Phase 3 — REFACTOR

Make the structural change (extract function, rename, reorganize):

1. Make one change at a time
2. Run tests after each change
3. If a test breaks, diagnose before continuing — do not stack changes

### Phase 4 — VERIFY

```bash
npx vitest run        # run full suite to catch regressions
```

All previously passing tests must still pass.

---

## Bugfix Mode Workflow

### Phase 1 — REPRODUCE

Ask the user to describe the bug precisely:

```
1. What input triggers the bug?
2. What output did you expect?
3. What output did you actually get?
4. Is there a stack trace or error message?
```

Write a test that reproduces the exact failure. Run it — **it must FAIL** (proving the bug exists):

```bash
npx vitest run <test-path>
```

If the test passes, the reproduction is wrong. Try again before writing any fix.

### Phase 2 — FIX

Now read the source code. Apply the minimal fix. Run the test — **it must PASS**:

```bash
npx vitest run <test-path>
```

### Phase 3 — REGRESSION

Run the full suite to confirm no other tests broke:

```bash
npx vitest run
```

If tests break, the fix is incorrect. Investigate before expanding the fix.

---

## Check Mode Workflow

```bash
node .claude/skills/tdd/skill.mjs --check <path>
```

Reports:
- Whether a test file exists
- Vitest run result (pass/fail counts)

Use this to quickly verify coverage before starting a refactor or when reviewing a PR.

---

## Layer Quick Reference

| Path prefix | Layer | jsdom? | Guide section |
|-------------|-------|--------|---------------|
| `src/app/api/` | API Route | No | § 4b |
| `src/dal/` | DAL | No | § 4a |
| `src/actions/` | Server Action | No | § 4c |
| `src/lib/ai/` | AI — delegate to `/ai-test` | No | § 4i |
| `src/services/` | Service | No | § 4d |
| `src/hooks/` | React Hook | **Yes** | § 4f |
| `src/components/` | Component | **Yes** | § 4g |
| `src/lib/encryption/` | Encryption | No | § 4e |
| `src/context/` | Context Provider | **Yes** | § 4h |

For jsdom layers, add at the very top of the test file:
```typescript
// @vitest-environment jsdom
```
And verify `@testing-library/react` is installed before writing.

---

## Quality Checklist

Run through this before presenting any test file to the user:

```
[ ] RED phase observed — test failed before implementation code was written
[ ] AAA pattern in every test (Arrange / Act / Assert clearly separated)
[ ] Test names follow: it('should <verb> <outcome> when <condition>')
[ ] vi.mock() / vi.hoisted() calls are at the top of the file, before imports
[ ] beforeEach(() => vi.clearAllMocks()) present in every describe block
[ ] No empty test bodies or placeholder comments
[ ] Every expect() asserts on output/return value, not only on mock call counts
[ ] Error paths tested (at least one per error branch in source)
[ ] Edge cases documented (empty input, null, boundary values)
[ ] No real API/DB/LLM calls possible — all external deps fully mocked
[ ] Coverage target met for the layer (see guide.md § 5)
[ ] Each ClickUp acceptance criterion maps to at least one test case
```

If any item fails, fix it before presenting the test file.

---

## Project Context

**Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, NextAuth v4
**Test runner:** Vitest 4.1.2 — `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`
**Test pattern:** `src/**/*.test.ts` (node environment; jsdom per-file for React layers)
**Global setup:** `src/test/setup.ts` stubs all API keys — no need to re-stub in individual tests
**Existing tests:** `src/lib/ai/` (41 files) — all other layers are untested as of Sprint 1

---

## Installation

```bash
# Project-level (recommended — committed with the repo)
SKILL_DIR=".claude/skills/tdd"
mkdir -p "$SKILL_DIR"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/tdd/skill.md \
  -o "$SKILL_DIR/SKILL.md"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/tdd/skill.mjs \
  -o "$SKILL_DIR/skill.mjs"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/tdd/guide.md \
  -o "$SKILL_DIR/guide.md"
echo "Installed: tdd (/tdd)"

# Global (~/.claude/skills/ — available in all projects)
SKILL_DIR="$HOME/.claude/skills/tdd"
mkdir -p "$SKILL_DIR"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/tdd/skill.md \
  -o "$SKILL_DIR/SKILL.md"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/tdd/skill.mjs \
  -o "$SKILL_DIR/skill.mjs"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/tdd/guide.md \
  -o "$SKILL_DIR/guide.md"
```
