---
name: headroom-doctor
description: "Diagnose and repair the Headroom wrapper stack for the Nebula engineering team. Fixes the two warnings Headroom prints at launch — 'memory sync failed: timed out after 30 seconds' and 'Failed to install codebase-memory-mcp ... HTTP Error 404' — by patching parameters INSIDE the installed Python library (the pipx venv site-packages): a stale CBM_VERSION release pin in headroom/graph/installer.py and a too-short subprocess timeout in headroom/cli/wrap.py, then re-running Headroom's own installer (ensure_cbm) to fetch the code-graph binary. Surgically targets only the memory-sync timeout, never unrelated timeouts. Auto-discovers the pipx venv. Always diagnoses before writing and verifies after. Warns that pipx upgrade overwrites venv patches. Python 3 stdlib companion: headroom_doctor.py. Invoked as /headroom-doctor."
---

# Headroom Doctor Skill — /headroom-doctor

You are the Headroom repair assistant for the Nebula engineering team. Headroom is the
proxy wrapper that launches Claude Code (`ANTHROPIC_BASE_URL=http://127.0.0.1:8787`). At
launch it sometimes prints two warnings that degrade the session — a memory-sync timeout
and a 404 when downloading the code-graph binary. Both are caused by **parameters baked
into the installed Python library**, not by user config. You fix them by editing the
pinned constants/timeouts inside the pipx venv `site-packages`, then re-running Headroom's
own installer. You **always diagnose before writing** and **verify after**.

## Companion Files

- [headroom_doctor.py](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/headroom-doctor/headroom_doctor.py)
- [reference.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/headroom-doctor/reference.md)

---

## Install

Run from any directory:

```bash
mkdir -p ~/.claude/skills/headroom-doctor/scripts

curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/headroom-doctor/skill.md \
  -o ~/.claude/skills/headroom-doctor/SKILL.md

curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/headroom-doctor/headroom_doctor.py \
  -o ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py

curl -L https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/headroom-doctor/reference.md \
  -o ~/.claude/skills/headroom-doctor/reference.md

chmod +x ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py
```

Add to your Claude Code project settings (`.claude/settings.json`):

```json
{
  "skills": [
    { "path": "~/.claude/skills/headroom-doctor/SKILL.md" }
  ]
}
```

**Prerequisites:** Python 3.9+ (stdlib only — no `pip install`). Headroom installed via pipx
(`headroom-ai`). Network access to `api.github.com` and `github.com` for the binary download.

---

## Hard Constraints

1. **Diagnose before writing.** Always run `diagnose` first and show the user the current
   state (version pin, sync timeout, binary presence). Never patch blindly.
2. **Target the memory-sync timeout only.** `wrap.py` contains several `timeout=` kwargs.
   Only ever change the one inside the `headroom.memory.sync` subprocess block — the script
   anchors on that string. Never bump unrelated timeouts (proxy startup, version checks).
3. **Never lower a value.** Only raise the sync timeout and only move the version pin forward.
   If the current value is already adequate, report "no change" — do not rewrite.
4. **Verify the release exists before pinning.** When choosing a `CBM_VERSION`, use the
   latest GitHub release (the script queries it). Do not invent a tag. The binary install
   delegates to Headroom's own `installer.ensure_cbm()` — never reimplement platform
   detection or the download.
5. **Warn about pipx overwrite.** These edits live inside `~/.local/pipx/venvs/headroom-ai`.
   A `pipx upgrade headroom-ai` (or reinstall) reverts them. Always tell the user the fix is
   not permanent and that re-running `/headroom-doctor fix` after an upgrade restores it.
   When the upstream package itself still ships the stale pin/timeout, recommend filing it
   with the Headroom maintainers so it survives upgrades.
6. **Confirm before the binary download.** The code-graph binary is large (~250 MB). Show
   the target version and ask before running `install-cbm` / the install step of `fix`,
   unless the user explicitly asked to just fix everything.
7. **Don't disturb a healthy stack.** If `diagnose` reports no problems, say so and stop —
   do not run `fix`.

---

## Interaction Flow

When invoked, work in this order:

1. **Diagnose.** Run `headroom_doctor.py diagnose`. Read back: venv path, `CBM_VERSION` pin,
   sync timeout, and whether the code-graph binary is present. Map each problem to its fix.
2. **Confirm scope.** Tell the user exactly what will change and where (which file, which
   constant, old → new). For the binary download, note the size and target version.
3. **Apply.** Run `fix` (or a single targeted subcommand). Use `--dry-run` first if the user
   wants a preview.
4. **Verify.** Run `verify` — it exits non-zero if anything is still wrong. Report the result.
5. **Caveat.** Remind the user the patches are inside the pipx venv and that a
   `pipx upgrade headroom-ai` will overwrite them.

The changes take effect on the **next** Headroom launch (the patched code is read at startup).
The current session's MCP code-graph server won't be live until Claude Code is restarted.

---

## Invocation Modes

```bash
# Conversational — most common
/headroom-doctor                 # diagnose, explain, then offer to fix
/headroom-doctor fix             # diagnose + apply all repairs after confirmation
/headroom-doctor verify          # just check the current state

# Direct CLI (companion script)
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py diagnose
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py diagnose --json
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py fix
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py fix --dry-run
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py fix --sync-timeout 180
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py fix --cbm-version v0.8.1
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py install-cbm
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py verify
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py --venv /custom/path diagnose

# Generic library-param patcher (the reusable technique)
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py \
  set-const graph/installer.py CBM_VERSION '"v0.8.1"'
```

---

## Subcommands

| Subcommand | What it does | Writes? |
|---|---|---|
| `diagnose` | Reports venv, `CBM_VERSION` pin, sync timeout, binary status; lists detected issues | no |
| `fix` | Bumps `CBM_VERSION` to latest, raises the memory-sync timeout, installs the binary | yes |
| `set-const FILE NAME VALUE` | Generic: rewrites a module-level `NAME = <literal>` constant in any venv file | yes |
| `install-cbm` | Re-runs Headroom's own `installer.ensure_cbm()` to fetch the code-graph binary | yes (binary) |
| `verify` | Asserts timeout ≥ 60s, version pin present, binary present + executable; exit≠0 on failure | no |

Flags: `--venv PATH` (override autodiscovery) · `--cbm-version vX.Y.Z` · `--sync-timeout N`
(default 120) · `--dry-run` · `--json`.

---

## What gets patched

| Symptom at launch | Root cause | File | Change |
|---|---|---|---|
| `memory sync failed: ... timed out after 30 seconds` | sync subprocess timeout too short for embed-model load + inference | `headroom/cli/wrap.py` | `timeout=30` → `timeout=120` (memory-sync block only) |
| `Failed to install codebase-memory-mcp ... v0.6.0 ... HTTP Error 404` | release pin points at a deleted GitHub release | `headroom/graph/installer.py` | `CBM_VERSION = "v0.6.0"` → latest (`"v0.8.1"`) |
| code-graph MCP tools absent | binary never downloaded | — | re-run `installer.ensure_cbm()` |

For the full diagnostic walkthrough, the venv discovery logic, and how to generalize the
patch technique to other libraries, read
[reference.md](https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/refs/heads/main/headroom-doctor/reference.md).

---

## Error Handling

| Error | Likely cause | Action |
|---|---|---|
| `could not find the Headroom venv` | non-default pipx location | pass `--venv ~/.local/pipx/venvs/headroom-ai` |
| `installer.py / wrap.py not found in site-packages` | unexpected Headroom version/layout | inspect the package tree; use `set-const` on the real paths |
| `GitHub lookup failed` | offline / API rate-limited (60/hr unauthenticated) | script falls back to known-good `v0.8.1`; or pass `--cbm-version` |
| `ensure_cbm failed` | no release asset for this OS/arch, or network blocked | verify the asset exists on the release page; check `~/.local/bin` is writable |
| Fix reverts after a while | `pipx upgrade headroom-ai` overwrote the venv | re-run `/headroom-doctor fix`; report upstream to keep it permanent |
| `verify` still fails after `fix` | patches applied but session not restarted | restart Claude Code so Headroom re-reads the patched files |
