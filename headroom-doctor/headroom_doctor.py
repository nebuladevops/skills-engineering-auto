#!/usr/bin/env python3
"""headroom-doctor — diagnose and repair the Headroom wrapper stack.

Companion script for the /headroom-doctor Claude Code skill.

It fixes the two failures Headroom prints at launch:

  Warning: memory sync failed: ... timed out after 30 seconds
  Failed to install codebase-memory-mcp from .../v0.6.0/...: HTTP Error 404

…by patching parameters *inside the installed Python library* (the pipx venv
site-packages) — a stale version pin and a too-short subprocess timeout — and
then re-running Headroom's own installer to fetch the code-graph binary.

Stdlib only. No third-party dependencies. Python 3.9+.

Subcommands
-----------
  diagnose                 Report state. No writes.
  fix                      Apply all repairs (version pin + sync timeout + install binary).
  set-const FILE NAME VAL  Generic: rewrite a `NAME = "..."`/`NAME = N` module constant.
  install-cbm              Re-run Headroom's installer to fetch codebase-memory-mcp.
  verify                   Post-fix assertions; non-zero exit if anything is still wrong.

Common flags
------------
  --venv PATH              Override venv autodiscovery.
  --cbm-version vX.Y.Z     Pin a specific codebase-memory-mcp release (default: latest from GitHub).
  --sync-timeout N         Seconds for the memory-sync subprocess (default: 120).
  --dry-run                Show what would change; write nothing.
  --json                   Machine-readable output.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

CBM_REPO = "DeusData/codebase-memory-mcp"
DEFAULT_SYNC_TIMEOUT = 120
# Pinned fallback used only when the GitHub API is unreachable (offline / rate-limited).
KNOWN_GOOD_CBM_VERSION = "v0.8.1"

# Candidate roots for the Headroom pipx venv, most-specific first.
_VENV_CANDIDATES = [
    "~/.local/pipx/venvs/headroom-ai",
    "~/.local/pipx/venvs/headroom",
    "~/Library/Application Support/pipx/venvs/headroom-ai",
]


# ───────────────────────────── discovery ──────────────────────────────


def discover_venv(override: str | None) -> Path:
    """Locate the Headroom pipx venv root. Raises if nothing usable is found."""
    cands = [override] if override else []
    cands += [os.path.expanduser(p) for p in _VENV_CANDIDATES]
    # Also ask pipx directly, if available.
    pipx = _pipx_venv()
    if pipx:
        cands.append(pipx)
    for c in cands:
        if not c:
            continue
        root = Path(c).expanduser()
        if (root / "bin" / "python").exists():
            return root
    raise SystemExit(
        "ERROR: could not find the Headroom venv.\n"
        "  Looked in: " + ", ".join(c for c in cands if c) + "\n"
        "  Pass it explicitly:  --venv /path/to/pipx/venvs/headroom-ai"
    )


def _pipx_venv() -> str | None:
    try:
        out = subprocess.run(
            ["pipx", "environment", "--value", "PIPX_LOCAL_VENVS"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if out.returncode == 0 and out.stdout.strip():
            for name in ("headroom-ai", "headroom"):
                p = Path(out.stdout.strip()) / name
                if (p / "bin" / "python").exists():
                    return str(p)
    except (FileNotFoundError, subprocess.SubprocessError):
        pass
    return None


def headroom_pkg(venv: Path) -> Path:
    """Return the installed `headroom` package directory inside the venv."""
    hits = glob.glob(str(venv / "lib" / "python*" / "site-packages" / "headroom"))
    if not hits:
        raise SystemExit(f"ERROR: no 'headroom' package under {venv}/lib/python*/site-packages")
    return Path(hits[0])


def venv_python(venv: Path) -> Path:
    return venv / "bin" / "python"


# ───────────────────────────── github ─────────────────────────────────


def latest_cbm_version(explicit: str | None) -> tuple[str, str]:
    """Return (version, source). Honors an explicit pin; else queries GitHub; else falls back."""
    if explicit:
        return explicit, "explicit"
    url = f"https://api.github.com/repos/{CBM_REPO}/releases/latest"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "headroom-doctor"})
        with urllib.request.urlopen(req, timeout=15) as r:
            tag = json.loads(r.read()).get("tag_name")
            if tag:
                return tag, "github-latest"
    except Exception as e:  # network, rate-limit, parse — all non-fatal
        sys.stderr.write(f"  (GitHub lookup failed: {e}; using known-good {KNOWN_GOOD_CBM_VERSION})\n")
    return KNOWN_GOOD_CBM_VERSION, "fallback"


# ─────────────────────────── patch helpers ────────────────────────────


def read_const(path: Path, name: str) -> str | None:
    m = re.search(rf'^{re.escape(name)}\s*=\s*(.+?)\s*$', path.read_text(), re.M)
    return m.group(1) if m else None


def set_const(path: Path, name: str, value: str, dry: bool) -> tuple[bool, str]:
    """Rewrite a top-level `NAME = <literal>` assignment. Returns (changed, message)."""
    text = path.read_text()
    pat = re.compile(rf'^({re.escape(name)}\s*=\s*).+?$', re.M)
    if not pat.search(text):
        return False, f"constant {name!r} not found in {path}"
    new = pat.sub(rf'\g<1>{value}', text, count=1)
    if new == text:
        return False, f"{name} already = {value} (no change)"
    if not dry:
        path.write_text(new)
    return True, f"{'[dry-run] would set' if dry else 'set'} {name} = {value} in {path.name}"


def patch_sync_timeout(wrap_path: Path, seconds: int, dry: bool) -> tuple[bool, str]:
    """Bump the `timeout=N` of the memory-sync subprocess block specifically.

    wrap.py contains several `timeout=` kwargs; we target only the one that
    follows the `headroom.memory.sync` invocation so unrelated timeouts are
    left untouched.
    """
    lines = wrap_path.read_text().splitlines(keepends=True)
    anchor = next((i for i, ln in enumerate(lines) if "headroom.memory.sync" in ln), None)
    if anchor is None:
        return False, "memory-sync block not found in wrap.py"
    rx = re.compile(r'^(\s*)timeout=(\d+)(,?)\s*$')
    for i in range(anchor, min(anchor + 40, len(lines))):
        m = rx.match(lines[i])
        if m:
            cur = int(m.group(2))
            if cur >= seconds:
                return False, f"sync timeout already {cur}s (>= {seconds}s); no change"
            if not dry:
                lines[i] = f"{m.group(1)}timeout={seconds}{m.group(3)}\n"
                wrap_path.write_text("".join(lines))
            return True, f"{'[dry-run] would raise' if dry else 'raised'} sync timeout {cur}s → {seconds}s"
    return False, "no `timeout=` kwarg found within the memory-sync block"


# ──────────────────────────── operations ──────────────────────────────


def op_install_cbm(venv: Path) -> tuple[bool, str]:
    py = venv_python(venv)
    code = "from headroom.graph import installer; print(installer.ensure_cbm())"
    r = subprocess.run([str(py), "-c", code], capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        return False, f"ensure_cbm failed:\n{(r.stderr or r.stdout).strip()[-800:]}"
    return True, f"codebase-memory-mcp installed → {r.stdout.strip().splitlines()[-1]}"


def cbm_binary() -> Path:
    return Path(os.path.expanduser("~/.local/bin/codebase-memory-mcp"))


def gather_state(venv: Path) -> dict:
    pkg = headroom_pkg(venv)
    installer = pkg / "graph" / "installer.py"
    wrap = pkg / "cli" / "wrap.py"
    binp = cbm_binary()
    sync_tmo = None
    if wrap.exists():
        lines = wrap.read_text().splitlines()
        anchor = next((i for i, ln in enumerate(lines) if "headroom.memory.sync" in ln), None)
        if anchor is not None:
            for ln in lines[anchor:anchor + 40]:
                m = re.match(r'\s*timeout=(\d+),?\s*', ln)
                if m:
                    sync_tmo = int(m.group(1))
                    break
    return {
        "venv": str(venv),
        "headroom_pkg": str(pkg),
        "installer_exists": installer.exists(),
        "wrap_exists": wrap.exists(),
        "cbm_version_pin": read_const(installer, "CBM_VERSION") if installer.exists() else None,
        "sync_timeout": sync_tmo,
        "cbm_binary": str(binp),
        "cbm_binary_exists": binp.exists(),
        "cbm_binary_executable": binp.exists() and os.access(binp, os.X_OK),
        "_installer": installer,
        "_wrap": wrap,
    }


# ──────────────────────────────── cli ─────────────────────────────────


def _emit(obj: dict, as_json: bool):
    if as_json:
        print(json.dumps({k: v for k, v in obj.items() if not k.startswith("_")}, indent=2))


def cmd_diagnose(a):
    venv = discover_venv(a.venv)
    s = gather_state(venv)
    if a.json:
        _emit(s, True)
        return 0
    print(f"venv            : {s['venv']}")
    print(f"CBM_VERSION pin : {s['cbm_version_pin']}")
    print(f"sync timeout    : {s['sync_timeout']}s")
    print(f"code-graph bin  : {'present' if s['cbm_binary_exists'] else 'MISSING'} ({s['cbm_binary']})")
    issues = []
    if s["sync_timeout"] is not None and s["sync_timeout"] < 60:
        issues.append(f"sync timeout {s['sync_timeout']}s is too low → 'memory sync timed out'. Run: fix")
    if not s["cbm_binary_exists"]:
        issues.append("code-graph binary missing → install-cbm (also bump CBM_VERSION if the pin 404s)")
    print("\n" + ("\n".join(f"  ⚠  {i}" for i in issues) if issues else "  ✓ no problems detected"))
    return 0


def cmd_fix(a):
    venv = discover_venv(a.venv)
    s = gather_state(venv)
    if not (s["installer_exists"] and s["wrap_exists"]):
        raise SystemExit("ERROR: installer.py / wrap.py not found in site-packages; venv layout unexpected.")
    version, src = latest_cbm_version(a.cbm_version)
    print(f"Target codebase-memory-mcp version: {version} ({src})")

    ch1, m1 = set_const(s["_installer"], "CBM_VERSION", f'"{version}"', a.dry_run)
    print(f"  {'✓' if ch1 else '·'} {m1}")
    ch2, m2 = patch_sync_timeout(s["_wrap"], a.sync_timeout, a.dry_run)
    print(f"  {'✓' if ch2 else '·'} {m2}")

    if a.dry_run:
        print("  [dry-run] skipping binary install")
        return 0
    ok, m3 = op_install_cbm(venv)
    print(f"  {'✓' if ok else '✗'} {m3}")
    print("\nDone. Changes live on next Headroom launch. NOTE: a `pipx upgrade headroom-ai`"
          "\nwill overwrite these venv patches — re-run `/headroom-doctor fix` after upgrades.")
    return 0 if ok else 1


def cmd_set_const(a):
    venv = discover_venv(a.venv)
    target = Path(a.file)
    if not target.is_absolute():
        target = headroom_pkg(venv) / a.file
    if not target.exists():
        raise SystemExit(f"ERROR: file not found: {target}")
    changed, msg = set_const(target, a.name, a.value, a.dry_run)
    print(f"{'✓' if changed else '·'} {msg}")
    return 0


def cmd_install_cbm(a):
    venv = discover_venv(a.venv)
    ok, msg = op_install_cbm(venv)
    print(f"{'✓' if ok else '✗'} {msg}")
    return 0 if ok else 1


def cmd_verify(a):
    venv = discover_venv(a.venv)
    s = gather_state(venv)
    checks = [
        ("sync timeout >= 60s", s["sync_timeout"] is not None and s["sync_timeout"] >= 60),
        ("CBM_VERSION pin present", bool(s["cbm_version_pin"])),
        ("code-graph binary present", s["cbm_binary_exists"]),
        ("code-graph binary executable", s["cbm_binary_executable"]),
    ]
    for name, ok in checks:
        print(f"  {'✓' if ok else '✗'} {name}")
    return 0 if all(ok for _, ok in checks) else 1


def build_parser():
    p = argparse.ArgumentParser(prog="headroom_doctor", description="Diagnose & repair the Headroom wrapper stack.")
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--venv", help="Override Headroom venv autodiscovery.")
    common.add_argument("--json", action="store_true", help="Machine-readable output where supported.")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("diagnose", parents=[common], help="Report state; no writes.").set_defaults(func=cmd_diagnose)

    f = sub.add_parser("fix", parents=[common], help="Apply all repairs.")
    f.add_argument("--cbm-version", help="Pin a specific release (default: latest from GitHub).")
    f.add_argument("--sync-timeout", type=int, default=DEFAULT_SYNC_TIMEOUT)
    f.add_argument("--dry-run", action="store_true")
    f.set_defaults(func=cmd_fix)

    sc = sub.add_parser("set-const", parents=[common], help="Generic: rewrite a module-level constant.")
    sc.add_argument("file", help="Absolute path, or path relative to the headroom package.")
    sc.add_argument("name")
    sc.add_argument("value", help='New literal, e.g. \'"v0.8.1"\' or 120.')
    sc.add_argument("--dry-run", action="store_true")
    sc.set_defaults(func=cmd_set_const)

    sub.add_parser("install-cbm", parents=[common], help="Re-run Headroom's code-graph installer.").set_defaults(func=cmd_install_cbm)
    sub.add_parser("verify", parents=[common], help="Post-fix assertions (exit!=0 on failure).").set_defaults(func=cmd_verify)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
