# skills-engineering-auto

Distributable Claude Code skills for the Nebula engineering team.

## How to install a skill

```bash
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/<skill-name>/skill.md
Then follow the instructions in the file to install the skill. Once installed, read the `SKILL.md` file in the installed directory and follow its instructions to complete the task.
```
---

## Skills

### ai-test-runner

AI layer Vitest sub-agent for proto_scribe. Two modes: **runner** (diagnoses existing tests) and **builder** (writes new ultra-senior quality tests). Invoked via `/ai-test` or `/ai-test --build`.

```bash
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/ai-test-runner/skill.md
Then follow the instructions in the file to install the skill. Once installed, read the `SKILL.md` in the installed directory and follow its instructions to complete the task.
```

### e2e-next-test

Behavior-first E2E test writer for proto_scribe. Reads the COVERAGE_PLAN, presents the pending case to the user, asks for the expected UX behavior, reads source code only after, reports discrepancies, and writes the Playwright test — never based on current implementation. Invoked via `/e2e-next-test` or `/e2e-next-test case:3.4`.

```bash
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/e2e-next-test/skill.md
Then follow the instructions in the file to install the skill. Once installed, read the `SKILL.md` in the installed directory and follow its instructions to complete the task.
```
