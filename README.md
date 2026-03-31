# skills-engineering-auto

Distributable Claude Code skills for the Nebula engineering team. Each skill is a folder containing a `skill.md` (Claude Code skill definition) and optional companion scripts.

## Installation

```bash
# Install any skill in one command:
SKILL=ai-test-runner
SKILL_DIR="$HOME/.claude/skills/$SKILL"
mkdir -p "$SKILL_DIR"
curl -fsSL "https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/$SKILL/skill.md" \
  -o "$SKILL_DIR/SKILL.md"
curl -fsSL "https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/$SKILL/skill.mjs" \
  -o "$SKILL_DIR/skill.mjs"
```

## Skills

### ai-test-runner

**Trigger:** `/ai-test` | **Project:** proto_scribe

AI layer test runner sub-agent. Runs Vitest unit tests scoped to `src/lib/ai/`, classifies each failure by root cause, proposes fix diffs (never auto-applies), and reports untested public functions.

```bash
# Install
SKILL_DIR="$HOME/.claude/skills/ai-test-runner"
mkdir -p "$SKILL_DIR"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/ai-test-runner/skill.md \
  -o "$SKILL_DIR/SKILL.md"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/ai-test-runner/skill.mjs \
  -o "$SKILL_DIR/skill.mjs"
```

**Usage:**
```bash
/ai-test                          # Full suite + report
/ai-test src/lib/ai/steps/        # Scope to subdirectory
/ai-test --fix                    # Propose fixes interactively
/ai-test --coverage-only          # Coverage report only
echo "/ai-test" | claude -p       # Headless / CI mode
```

**Failure types classified:** `wrong-mock` | `schema-mismatch` | `logic-error` | `missing-dependency` | `environment-issue`

---

## Skill Structure

```
skill-name/
├── skill.md    # Claude Code skill definition (YAML frontmatter + instructions)
└── skill.mjs   # Node.js ESM companion script (optional)
```

## Contributing

Add a new skill by creating a folder with `skill.md` + optionally `skill.mjs`, then open a PR.
