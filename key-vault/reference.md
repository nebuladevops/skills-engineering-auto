# Key Vault Skill — Reference

Companion reference for `skill.md`. Full command surface, per-project details, workflow recipes, and admin operations.

---

## Project Registry

| Project | Repo | Scripts dir | `pull --service` | Vault (prod) | Vault (uat) | Default output |
|---|---|---|---|---|---|---|
| `scribe` | `proto_scribe` | `scripts/kv/` | `scribe` / `scribe-uat` | `kv-nebula-scribe-prod` | `kv-nebula-scribe-uat` | `.env` |
| `auth`   | `auth-clerk`   | `scripts/kv/` | `auth` | `kv-nebula-auth-prod` | — | `.env.local` |
| `pay`    | `pay-gateway`  | `.github/kv/` | `paygateway` | `kv-nebula-paygw-prod` | — | `.env` |

Default repo root: `~/Documents/GitHub/<repo>`. Override with `root=<path>`.

---

## Secret Name Convention

Azure Key Vault does not allow underscores in secret names. The scripts handle the conversion transparently:

| `.env` key | Key Vault secret name |
|---|---|
| `DATABASE_URL` | `DATABASE-URL` |
| `NEXT_PUBLIC_CLERK_KEY` | `NEXT-PUBLIC-CLERK-KEY` |
| `WOMPI_PRIVATE_KEY` | `WOMPI-PRIVATE-KEY` |

`push.mjs` converts `_` → `-` on upload. `pull.mjs` converts `-` → `_` on download.

---

## Operations

### `pull` — Download secrets → local `.env`

Downloads all secrets from a vault and writes them as `KEY=VALUE` pairs.

```bash
node skill.mjs pull project=scribe
node skill.mjs pull project=scribe env=uat out=.env.uat
node skill.mjs pull project=auth out=.env.local
node skill.mjs pull project=pay out=.env.kv --force
```

| Argument | Default | Description |
|---|---|---|
| `project=` | required | `scribe`, `auth`, or `pay` |
| `env=` | `prod` | `prod` or `uat` (uat only for scribe) |
| `out=` | per-project default | Output file path |
| `root=` | `~/Documents/GitHub/<repo>` | Override repo root |
| `--force` | — | Overwrite existing file without backup |

**What happens:**
1. Lists all secrets in the vault.
2. Backs up an existing output file as `<file>.bak` (unless `--force`).
3. Downloads each secret value and writes `KEY=value` (with quoting if needed).
4. Output file is created with permissions `600`.

---

### `push` — Upload local `.env` → vault

Uploads each variable in a `.env` file as an individual secret. Idempotent — re-running creates a new secret version without deleting history.

```bash
node skill.mjs push project=scribe file=.env
node skill.mjs push project=pay file=.env.prod --dry-run
node skill.mjs push project=auth file=.env.local --yes
```

| Argument | Default | Description |
|---|---|---|
| `project=` | required | `scribe`, `auth`, or `pay` |
| `env=` | `prod` | `prod` or `uat` |
| `file=` | `./.env` | Source `.env` file |
| `root=` | `~/Documents/GitHub/<repo>` | Override repo root |
| `--dry-run` | — | Preview what would be uploaded, no writes |
| `--yes` | — | Skip interactive confirmation (CI use) |

**What happens:**
1. Parses the `.env` file (skips comments and empty values).
2. Shows preflight: variable names and target vault (never values).
3. Warns about likely placeholder values (`localhost`, `your_*`, etc.).
4. Asks for confirmation (skipped with `--yes`).
5. Uploads each variable via `az keyvault secret set`.

---

### `update` — Set a single variable

Updates or creates a single secret in the vault. Asks for confirmation before writing.

```bash
node skill.mjs update project=scribe var=STRIPE_KEY value=sk_live_abc123
node skill.mjs update project=auth var=CLERK_SECRET env=prod value=sk_live_xyz
```

| Argument | Default | Description |
|---|---|---|
| `project=` | required | Target project |
| `var=` | required | Variable name (use `_` as in the `.env` file) |
| `value=` | required | New value |
| `env=` | `prod` | `prod` or `uat` |

The skill converts `VAR_NAME` → `VAR-NAME` before calling `az keyvault secret set`. The value is never echoed in logs.

---

### `list` — Show secret names

Lists the names of all active secrets in a vault. Never prints values.

```bash
node skill.mjs list project=scribe
node skill.mjs list project=scribe env=uat
node skill.mjs list project=pay
```

Output: one secret name per line (as stored in Key Vault, with `-`).

---

### `verify` — Diff vault vs local file

Compares the set of secret names in the vault against the keys in a local `.env` file. No writes.

```bash
node skill.mjs verify project=scribe file=.env
node skill.mjs verify project=auth file=.env.local
node skill.mjs verify project=pay file=.env
```

Reports:
- Keys in vault but not in local file (you should pull)
- Keys in local file but not in vault (you may need to push)
- ✓ if they match exactly

---

### `provision` — Create vault + assign RBAC (admin only)

Creates the Key Vault resource in Azure and assigns roles. Run once per vault by an admin.

```bash
node skill.mjs provision project=scribe devs=dev1@nebula.med,dev2@nebula.med
node skill.mjs provision project=pay devs=dev@nebula.med rg=rg-nebula-pay-gateway loc=eastus2
```

| Argument | Default | Description |
|---|---|---|
| `project=` | required | Target project (uses prod vault name) |
| `devs=` | required | Comma-separated emails → `Key Vault Secrets User` role |
| `rg=` | per-project default | Azure resource group |
| `loc=` | per-project default | Azure region |

---

## Common Workflows

### First-time: get the `.env` for a project

```bash
az login
node skill.mjs pull project=scribe out=.env
```

### Sync local `.env` after vault changes

```bash
node skill.mjs pull project=scribe
# existing .env is backed up as .env.bak
```

### Push a fully updated `.env` to vault

```bash
node skill.mjs push project=pay file=.env --dry-run   # review first
node skill.mjs push project=pay file=.env              # confirm and upload
```

### Rotate a single secret

```bash
node skill.mjs update project=auth var=CLERK_SECRET_KEY value=sk_live_new_value
```

### Audit: is my local `.env` in sync with the vault?

```bash
node skill.mjs verify project=scribe file=.env
```

### Download scribe UAT variables

```bash
node skill.mjs pull project=scribe env=uat out=.env.uat
```

### Add a new developer's read access to a vault (admin)

```bash
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee new-dev@nebula.med \
  --scope $(az keyvault show --name kv-nebula-scribe-prod --query id -o tsv)
```

---

## Prerequisites

- **Azure CLI**: `brew install azure-cli`
- **Active session**: `az login` (or `! az login` in Claude Code)
- **RBAC role**: `Key Vault Secrets User` (read) or `Key Vault Secrets Officer` (read+write)
- **Node.js**: v18+ (for the underlying `push.mjs`/`pull.mjs` scripts)
- **Updated repo clones**: the scripts must exist at the expected path in each repo.
  If the skill reports "script not found", run `git pull` in that project's directory.

---

## References

- Azure Key Vault secrets: https://learn.microsoft.com/azure/key-vault/secrets/
- `az keyvault` CLI reference: https://learn.microsoft.com/cli/azure/keyvault/secret
- Skill source: https://github.com/nebuladevops/skills-engineering-auto/tree/main/key-vault
