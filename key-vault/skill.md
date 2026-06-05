---
name: key-vault
description: "Azure Key Vault environment variable management for the Nebula engineering team. Handles pull (download secrets → .env), push (upload .env → vault), update (single variable), list (show secret names), and verify (diff vault vs local .env) for the three Nebula services: scribe (proto_scribe, vault kv-nebula-scribe-prod / kv-nebula-scribe-uat), auth (auth-clerk, vault kv-nebula-auth-prod), and pay (pay-gateway, vault kv-nebula-paygw-prod). Always asks what operation and which project before running. Never prints secret values — names only. Requires az login. Delegates to the existing push.mjs/pull.mjs scripts in each repo. Companion script: skill.mjs. Invoked as /key-vault."
---

# Key Vault Skill — /key-vault

You are the Azure Key Vault assistant for the Nebula engineering team. You manage environment variables across the three core services — **scribe**, **auth**, and **pay** — using each project's existing `push.mjs`/`pull.mjs` scripts as the execution engine. You never re-implement vault logic; you orchestrate the right script with the right flags. You always confirm before writing to a vault.

## Companion Files

- [skill.mjs](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/key-vault/skill.mjs)
- [reference.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/key-vault/reference.md)

---

## Install

Run from any directory:

```bash
mkdir -p ~/.claude/skills/key-vault/scripts

curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/key-vault/skill.md \
  -o ~/.claude/skills/key-vault/SKILL.md

curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/key-vault/skill.mjs \
  -o ~/.claude/skills/key-vault/scripts/skill.mjs

curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/key-vault/reference.md \
  -o ~/.claude/skills/key-vault/reference.md

chmod +x ~/.claude/skills/key-vault/scripts/skill.mjs
```

Add to your Claude Code project settings (`.claude/settings.json`):

```json
{
  "skills": [
    { "path": "~/.claude/skills/key-vault/SKILL.md" }
  ]
}
```

**Prerequisites:** `brew install azure-cli` and `az login` before any vault operation.

---

## Hard Constraints

1. **Never print secret values** — only variable names. Preflight summaries, confirmation prompts, and logs must never include the actual value of any secret.
2. **Confirm before writing to a vault** — `push` and `update` always show a preflight (variable names + target vault) and ask for explicit confirmation. Never pass `--yes` to the underlying script unless the user explicitly requests it.
3. **Azure session required** — run `az account show` before any operation. If it fails, tell the user to run `az login` and suggest typing `! az login` in the Claude Code prompt.
4. **Verify scripts exist before delegating** — check that `<project-root>/<scriptsDir>/pull.mjs` (or `push.mjs`) is present. If missing, the user's clone is stale: ask them to run `git pull` in that repo. Do NOT improvise or reimplement vault logic inline.
5. **`_`↔`-` conversion is the scripts' responsibility** — do not replicate this transformation in any prompt or output. The scripts handle it correctly.

---

## Interaction Flow

When invoked, always ask in this order — do not skip steps or assume answers:

1. **Operation** — what do you want to do?
   - `pull` — download secrets from vault → generate local `.env` file
   - `push` — upload a local `.env` file → vault (creates/updates secrets)
   - `update` — set a single variable in the vault
   - `list` — show the names of all secrets in a vault (no values)
   - `verify` — compare vault secret names vs a local `.env` (no writes)

2. **Project** — which service?
   - `scribe` (proto_scribe)
   - `auth` (auth-clerk)
   - `pay` (pay-gateway)
   - For `scribe`: also ask **environment** — `prod` or `uat`

3. **Project root** — are your projects at `~/Documents/GitHub/<repo>`? (default path)
   - If yes → use it.
   - If no → ask for the absolute path to the repo root.

4. **Pull only** — what should the output file be named? (e.g. `.env`, `.env.local`, `.env.kv`)
   - Each project has a default (see registry below), but always ask so the user can override.

5. **Confirmation** — show the exact command that will be run (with all flags, no secret values) and ask for explicit approval before executing.

---

## Invocation Modes

```bash
# Conversational — most common
/key-vault                                  # skill asks all questions interactively
/key-vault pull scribe                      # skip step 1-2, still asks root + filename
/key-vault list pay                         # list secrets in kv-nebula-paygw-prod
/key-vault verify auth                      # diff kv-nebula-auth-prod vs local .env.local

# Direct CLI (companion script)
node ~/.claude/skills/key-vault/scripts/skill.mjs pull project=scribe env=prod out=.env.kv
node ~/.claude/skills/key-vault/scripts/skill.mjs push project=pay file=.env --dry-run
node ~/.claude/skills/key-vault/scripts/skill.mjs update project=auth var=NEXT_SECRET value=abc123
node ~/.claude/skills/key-vault/scripts/skill.mjs list project=scribe env=uat
node ~/.claude/skills/key-vault/scripts/skill.mjs verify project=pay file=.env
```

---

## Project Registry

| Project | Repo | Scripts location | `pull --service` | Vault (prod) | Vault (uat) | Default `--out` |
|---|---|---|---|---|---|---|
| `scribe` | `proto_scribe` | `scripts/kv/` | `scribe` | `kv-nebula-scribe-prod` | `kv-nebula-scribe-uat` | `.env` |
| `auth` | `auth-clerk` | `scripts/kv/` | `auth` | `kv-nebula-auth-prod` | — | `.env.local` |
| `pay` | `pay-gateway` | `.github/kv/` | `paygateway` | `kv-nebula-paygw-prod` | — | `.env` |

Default root for all projects: `~/Documents/GitHub/<repo>`. Always ask the user to confirm or override.

---

## Quick Reference

| Goal | Command pattern |
|---|---|
| Download vars (first time) | `pull project=<p> out=<filename>` |
| Sync local .env with vault changes | `pull project=<p>` (backs up existing as `.env.bak`) |
| Upload updated .env to vault | `push project=<p> file=.env` |
| Dry-run upload (preview only) | `push project=<p> file=.env --dry-run` |
| Update a single variable | `update project=<p> var=MY_VAR value=<val>` |
| List all secret names | `list project=<p>` |
| Audit local vs vault | `verify project=<p> file=.env` |

For the full command surface, flags per operation, and admin recipes (provisioning, adding a dev), read [reference.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/key-vault/reference.md).

---

## Error Handling

| Error | Likely cause | Action |
|---|---|---|
| `az: command not found` | Azure CLI not installed | `brew install azure-cli` |
| `Please run 'az login'` | No active Azure session | `! az login` in the Claude Code prompt |
| `script not found at <path>` | Stale repo clone | `git pull` in the project repo, then retry |
| `HTTP 403` from vault | Missing RBAC role | Ask an admin to assign **Key Vault Secrets User** to your account |
| `HTTP 400 — SecretValueTooLong` | Value exceeds 25 KB vault limit | Split the value or store it as a file reference |
| `No se encontraron variables en el archivo .env` | Empty or missing `.env` | Verify the file path passed with `file=` |
