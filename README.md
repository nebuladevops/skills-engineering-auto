# skills-engineering-auto

Distributable Claude Code skills for the Nebula engineering team.

## How to install a skill

```bash
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/<skill-name>/skill.md
Then follow the instructions in the file to install the skill. Once installed, read the `SKILL.md` file in the installed directory and follow its instructions to complete the task.
```

## Heads-up before installing

- **API tokens are required by some skills.** The `clickup` skill needs `CLICKUP_API_TOKEN` (ClickUp → Settings → Apps → Generate API Token). The installer prompts for it and writes it to `~/.claude/settings.json` under `env`. If a command returns `401 Unauthorized` or `ERROR: CLICKUP_API_TOKEN environment variable not set`, that token is the cause.
- **Nebula-specific IDs.** Some skills hard-code workspace, list and custom-field IDs for the Nebula Medical ClickUp workspace — e.g. the `clickup` skill's Requests list `901712856936` and its Item Type / MoSCoW / Initiative custom-field IDs. Outside that workspace those IDs return `404`. If the skill fails on task creation, replace the IDs in the installed `SKILL.md` first.

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

### tdd

TDD-first development skill for proto_scribe and auth-clerk. Three modes: **feature** (red-green-refactor), **refactor** (safety-net-first), **bugfix** (reproduce-first). Enforces AAA pattern and layer-specific mocking across all architecture layers. Includes companion script and guide.md. Invoked via `/tdd`.

```bash
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/tdd/skill.md
Then follow the instructions in the file to install the skill. Once installed, read the `SKILL.md` in the installed directory and follow its instructions to complete the task.
```

### clickup

ClickUp project-management skill for the Nebula Medical engineering team. Enforces the Nebula Task Protocol v1.0 on every AI-created task (verb+object title, user story, ≥2 verifiable acceptance criteria, story-point estimation, single owner, type and priority, Sogamoso-bug rule, clinical-sign-off rule). Provides CRUD + reporting + time tracking through a Python companion client (`clickup_client.py`) and references `protocol.md` and `reference.md`. Requires `CLICKUP_API_TOKEN`. Invoked via `/clickup`.

```bash
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/clickup/skill.md
Then follow the instructions in the file to install the skill. Once installed, read the `SKILL.md` in the installed directory and follow its instructions to complete the task.
```
