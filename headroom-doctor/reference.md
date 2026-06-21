# headroom-doctor — Reference

Deep reference for the `/headroom-doctor` skill: the failures it fixes, how it finds the
venv, exactly what it patches, and how to reuse the "patch a parameter inside an installed
library" technique for other packages.

---

## The two failures

At launch the Headroom wrapper (`headroom wrap claude`) prints diagnostics. Two are caused
by values hard-coded inside the installed `headroom` package:

```
Warning: memory sync failed: Command '[...python, -m, headroom.memory.sync, ...]'
  timed out after 30 seconds
...
Failed to install codebase-memory-mcp from
  https://github.com/DeusData/codebase-memory-mcp/releases/download/v0.6.0/
  codebase-memory-mcp-darwin-arm64.tar.gz: HTTP Error 404: Not Found
Code graph: download failed — skipping
```

### 1. Memory sync timeout

`headroom/cli/wrap.py` runs the memory sync as a subprocess **before** starting the proxy:

```python
# Memory sync BEFORE proxy startup — sync headroom DB ↔ Claude's files
sync_result = subprocess.run(
    [venv_python, "-m", "headroom.memory.sync", "--db", ..., "--force"],
    capture_output=True,
    text=True,
    timeout=30,          # ← too short
)
```

The sync loads a sentence-embedding model and runs inference over the memory store; on a
cold cache this routinely exceeds 30s, so it raises `TimeoutExpired` and the session starts
with stale memory. Raising the timeout to **120s** lets it complete. The sync itself is
correct — only the budget is wrong.

> `wrap.py` has multiple `timeout=` kwargs (proxy health check, version probe, process
> teardown). The doctor anchors on the line containing `headroom.memory.sync` and only
> rewrites the first `timeout=` within the following ~40 lines, leaving the others alone.

### 2. codebase-memory-mcp 404

`headroom/graph/installer.py` pins the code-graph binary release:

```python
CBM_VERSION = "v0.6.0"                       # ← release was deleted upstream
CBM_REPO    = "DeusData/codebase-memory-mcp"
GITHUB_RELEASE_URL = f"https://github.com/{CBM_REPO}/releases/download"
```

When `v0.6.0` is removed from GitHub, the constructed asset URL 404s and the code-graph MCP
server is skipped. Bumping `CBM_VERSION` to the latest release (e.g. `v0.8.1`) and re-running
`installer.ensure_cbm()` downloads the binary to `~/.local/bin/codebase-memory-mcp`.

`ensure_cbm()` already does OS/arch detection (`darwin-arm64`, `darwin-amd64`, `linux-*`) and
the actual download — the doctor never reimplements that. It only corrects the version pin
and calls the function.

---

## Venv discovery

The doctor finds the installed package without hardcoding a username:

1. `--venv` override, if given.
2. Known pipx locations: `~/.local/pipx/venvs/headroom-ai`, `…/headroom`,
   `~/Library/Application Support/pipx/venvs/headroom-ai`.
3. `pipx environment --value PIPX_LOCAL_VENVS` joined with `headroom-ai`/`headroom`.

The first candidate with a `bin/python` wins. The package itself is then located by globbing
`<venv>/lib/python*/site-packages/headroom`, so it is Python-version agnostic (3.11, 3.13, …).

---

## Verification contract

`verify` exits non-zero unless **all** hold:

- memory-sync `timeout` ≥ 60s
- `CBM_VERSION` pin is present (non-empty)
- `~/.local/bin/codebase-memory-mcp` exists
- …and is executable

Use it in scripts: `headroom_doctor.py verify && echo OK`.

---

## The reusable technique — patching a parameter inside an installed library

The core move generalizes to **any** stale constant or wrong default living in a venv's
`site-packages`. The pattern:

1. **Locate the package**, not a guessed path:
   `glob("<venv>/lib/python*/site-packages/<pkg>")`.
2. **Find the parameter precisely.** A module constant (`NAME = <literal>`) is safe to rewrite
   by anchored regex. A kwarg like `timeout=30` is *not* unique — anchor on a nearby unique
   string (a function name, an invoked module) and only edit within a small window after it.
3. **Be idempotent and monotonic.** Read the current value; skip if already correct; for
   numeric budgets only ever raise, never lower.
4. **Delegate real work to the library.** Don't reimplement downloads/platform logic — fix
   the input and call the library's own entry point (`ensure_cbm()`).
5. **Announce impermanence.** Anything under `pipx/venvs/...` is reverted by
   `pipx upgrade`/reinstall. Tell the user, and push the fix upstream when possible.

The generic `set-const` subcommand exposes step 2 for the constant case:

```bash
# rewrite any module-level constant in the headroom package (path relative to the package)
headroom_doctor.py set-const graph/installer.py CBM_VERSION '"v0.8.1"'

# or an absolute path into any other venv
headroom_doctor.py set-const /abs/path/to/site-packages/foo/config.py MAX_RETRIES 5
```

`set-const` rewrites exactly one top-level `NAME = <literal>` assignment via the regex
`^(NAME\s*=\s*).+?$` (first match, multiline), leaving everything else byte-for-byte intact.
Pass string literals quoted (`'"v0.8.1"'`) and numbers bare (`120`). Use `--dry-run` to preview.

---

## Quick reference

| Goal | Command |
|---|---|
| See current state | `headroom_doctor.py diagnose` |
| Machine-readable state | `headroom_doctor.py diagnose --json` |
| Fix everything | `headroom_doctor.py fix` |
| Preview the fix | `headroom_doctor.py fix --dry-run` |
| Longer sync budget | `headroom_doctor.py fix --sync-timeout 180` |
| Pin an exact release | `headroom_doctor.py fix --cbm-version v0.8.1` |
| Just (re)install the binary | `headroom_doctor.py install-cbm` |
| Assert health (CI) | `headroom_doctor.py verify` |
| Patch an arbitrary constant | `headroom_doctor.py set-const FILE NAME VALUE` |

---

## After a `pipx upgrade headroom-ai`

The venv is rebuilt and the patches vanish. Re-run:

```bash
python3 ~/.claude/skills/headroom-doctor/scripts/headroom_doctor.py fix
```

If the upstream package still ships `CBM_VERSION = "v0.6.0"` and `timeout=30`, report it to
the Headroom maintainers (a forward-looking version resolution + a longer sync budget) so the
fix survives upgrades and every teammate benefits.
