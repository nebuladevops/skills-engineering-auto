# CLAUDE.md — skills-engineering-auto

This file provides guidance to Claude Code when working inside this repository.

## What this repo is

A collection of distributable Claude Code skills for the Nebula engineering team.
Each skill is a self-contained folder with a `skill.md` (agent instructions) and optionally a `skill.mjs` (companion Node.js ESM script).

---

## Install Pattern — NEVER change this

Every skill in this repo uses the same install pattern. This is a hard constraint.
When adding or updating skills, the README entry for each skill MUST follow exactly this format:

```
### <skill-name>

<one-line description>

\`\`\`bash
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/<skill-name>/skill.md
\`\`\`

Then follow the instructions in the file to install the skill. Once installed, read the `SKILL.md` in the installed directory and follow its instructions to complete the task.
```

The sentence after the code block is fixed — do not paraphrase it.

---

## Invoke prompt (copy-paste to install any skill)

To install a skill from this repo, give an AI agent this exact prompt:

```
curl https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/<skill-name>/skill.md
Then follow the instructions in the file to install the skill. Once installed, read the SKILL.md file in the installed directory and follow its instructions to complete the task.
```

Replace `<skill-name>` with the folder name (e.g. `ai-test-runner`).

---

## Skill folder structure

```
<skill-name>/
├── skill.md      # Required. Claude Code skill definition.
└── skill.mjs     # Optional. Node.js ESM companion script.
```

### skill.md requirements

Must have YAML frontmatter:

```yaml
---
name: <skill-name>
description: "<one paragraph — this is the trigger mechanism for the Skill tool>"
---
```

Rules:
- `name` matches the folder name exactly
- `description` is dense and specific — it is what Claude reads to decide whether to invoke this skill
- Keep `skill.md` under 500 lines. Move reference content to a `references/` subfolder if needed
- If a `skill.mjs` exists, `skill.md` MUST include a hyperlink to the raw GitHub URL so agents can fetch it:

```markdown
Source: [skill.mjs](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/<skill-name>/skill.mjs)
```

### skill.mjs requirements

- Must be a Node.js ESM module (`import` syntax, no `require`)
- Must run with `node skill.mjs` from the project root — no build step
- Must not require installing additional packages beyond those already in the host project
- Shebang line required: `#!/usr/bin/env node`
- Top-of-file JSDoc block must document all CLI flags

---

## Adding a new skill

1. Create folder: `<skill-name>/`
2. Write `skill.md` with frontmatter + instructions
3. If a script is needed, write `skill.mjs`
4. Add the skill entry to `README.md` using the install pattern above — nothing else
5. Commit with message: `Add <skill-name> skill`

Do NOT:
- Add prose, marketing copy, or extended documentation to README.md
- Create sub-subdirectories inside a skill folder (use flat structure)
- Add `package.json` or lock files inside skill folders
- Modify any other skill's files when adding a new skill

---

## Updating an existing skill

- Edit `skill.md` and/or `skill.mjs` directly
- If the skill behavior changes significantly, update the `description` frontmatter
- The README entry does NOT change when updating a skill — the curl URL is stable
- Commit with message: `Update <skill-name>: <what changed>`

---

## Skill quality bar

Before merging a skill:

- [ ] `skill.md` has valid YAML frontmatter with `name` and `description`
- [ ] `description` is specific enough to trigger the skill in the right context
- [ ] If `skill.mjs` exists: runs with `node skill.mjs` from project root, has shebang, has JSDoc header
- [ ] If `skill.mjs` exists: `skill.md` has the raw GitHub hyperlink to it
- [ ] Hard constraints in the skill (things the agent must never do) are listed explicitly
- [ ] Invocation modes are documented with example commands
- [ ] README entry follows the install pattern exactly

---

## Current skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| `ai-test-runner` | `/ai-test` | Vitest runner + ultra-senior test builder for `src/lib/ai/` in proto_scribe |
| `e2e-next-test`  | `/e2e-next-test` | Behavior-first Playwright E2E test writer for proto_scribe |
| `tdd`            | `/tdd` | TDD red-green-refactor skill for all layers of proto_scribe and auth-clerk |
