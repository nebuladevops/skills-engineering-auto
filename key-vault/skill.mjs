#!/usr/bin/env node
/**
 * Key Vault Skill — wrapper script for Nebula Azure Key Vault operations.
 *
 * Delegates to the push.mjs / pull.mjs / provision.mjs scripts already present
 * in each project repo. Never reimplements vault logic.
 *
 * Usage (CLI):
 *   node skill.mjs <operation> [key=value ...] [flags]
 *
 * Operations:
 *   pull     Download secrets from vault → local .env file
 *   push     Upload local .env file → vault
 *   update   Set a single variable in the vault
 *   list     Print secret names (no values) from a vault
 *   verify   Diff vault secret names vs a local .env (no writes)
 *   provision  (admin) Create vault + assign RBAC roles
 *
 * Key=value arguments:
 *   project=<scribe|auth|pay>   Target project (required)
 *   env=<prod|uat>              Environment (default: prod; uat only for scribe)
 *   out=<path>                  Output file for pull (default: per-project default)
 *   file=<path>                 Input .env file for push/verify (default: ./.env)
 *   root=<path>                 Override project repo root (default: ~/Documents/GitHub/<repo>)
 *   var=<NAME>                  Variable name for update operation
 *   value=<val>                 Variable value for update operation
 *
 * Flags:
 *   --dry-run    Preview what would be uploaded without writing to vault
 *   --force      Overwrite existing output file without making a backup (pull)
 *   --verify     Diff mode only — no writes (alias for verify operation in pull context)
 *   --yes        Skip interactive confirmation (use in non-interactive scripts)
 *
 * Auth:
 *   Requires an active Azure CLI session: az login
 *   The script checks for a session before delegating to any vault operation.
 *
 * Examples:
 *   node skill.mjs pull project=scribe out=.env.kv
 *   node skill.mjs push project=pay file=.env.prod --dry-run
 *   node skill.mjs update project=auth var=CLERK_SECRET_KEY value=sk_live_xxx
 *   node skill.mjs list project=scribe env=uat
 *   node skill.mjs verify project=pay file=.env
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Project registry ─────────────────────────────────────────────────────────

const PROJECTS = {
  scribe: {
    repo: 'proto_scribe',
    scriptsDir: 'scripts/kv',
    pullService: 'scribe',
    pullServiceUat: 'scribe-uat',
    defaultOut: '.env',
    vaults: { prod: 'kv-nebula-scribe-prod', uat: 'kv-nebula-scribe-uat' },
  },
  auth: {
    repo: 'auth-clerk',
    scriptsDir: 'scripts/kv',
    pullService: 'auth',
    pullServiceUat: null,
    defaultOut: '.env.local',
    vaults: { prod: 'kv-nebula-auth-prod' },
  },
  pay: {
    repo: 'pay-gateway',
    scriptsDir: '.github/kv',
    pullService: 'paygateway',
    pullServiceUat: null,
    defaultOut: '.env',
    vaults: { prod: 'kv-nebula-paygw-prod' },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function expandHome(p) {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return resolve(p);
}

function defaultRoot(project) {
  return join(homedir(), 'Documents', 'GitHub', PROJECTS[project].repo);
}

function resolveRoot(project, rootOverride) {
  return rootOverride ? expandHome(rootOverride) : defaultRoot(project);
}

function scriptPath(root, project, name) {
  return join(root, PROJECTS[project].scriptsDir, name);
}

function assertScriptsExist(root, project, ...names) {
  for (const name of names) {
    const p = scriptPath(root, project, name);
    if (!existsSync(p)) {
      err(
        `Script not found: ${p}\n` +
        `Your local clone may be outdated. Run: git pull  (inside ${root})`
      );
    }
  }
}

function checkAzSession() {
  try {
    execFileSync('az', ['account', 'show', '-o', 'none'], { stdio: 'pipe' });
  } catch {
    err(
      'No active Azure session detected.\n' +
      'Run: az login\n' +
      'In Claude Code you can type: ! az login'
    );
  }
}

function err(msg) {
  console.error(`[key-vault] ERROR: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

// ── Arg parser ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const positional = [];
  const kv = {};
  const flags = new Set();

  for (const token of argv) {
    if (token.startsWith('--')) {
      flags.add(token);
    } else if (token.includes('=')) {
      const eqIdx = token.indexOf('=');
      const key = token.slice(0, eqIdx);
      const val = token.slice(eqIdx + 1);
      let parsed;
      try { parsed = JSON.parse(val); } catch { parsed = val; }
      kv[key] = parsed;
    } else {
      positional.push(token);
    }
  }

  return { op: positional[0], kv, flags };
}

// ── Operation handlers ───────────────────────────────────────────────────────

function opPull({ project, env, out, root, force, verify }) {
  const cfg = PROJECTS[project];
  const isUat = env === 'uat';

  if (isUat && !cfg.pullServiceUat) {
    err(`Project "${project}" does not have a UAT environment.`);
  }

  const service = isUat ? cfg.pullServiceUat : cfg.pullService;
  const vault = cfg.vaults[isUat ? 'uat' : 'prod'];
  const outFile = out || cfg.defaultOut;
  const script = scriptPath(root, project, 'pull.mjs');

  assertScriptsExist(root, project, 'pull.mjs');
  checkAzSession();

  const args = ['node', script, '--service', service, '--out', outFile];
  if (force) args.push('--force');
  if (verify) args.push('--verify');

  console.log(`[key-vault] pull — vault: ${vault} → ${outFile}`);
  run(args[0], args.slice(1), { cwd: root });
}

function opPush({ project, env, file, root, dryRun, yes }) {
  const cfg = PROJECTS[project];
  const isUat = env === 'uat';
  const vault = cfg.vaults[isUat ? 'uat' : 'prod'];
  const envFile = file || './.env';
  const script = scriptPath(root, project, 'push.mjs');

  assertScriptsExist(root, project, 'push.mjs');
  checkAzSession();

  const args = ['node', script, '--vault', vault, '--env-file', envFile];
  if (dryRun) args.push('--dry-run');
  if (yes) args.push('--yes');

  console.log(`[key-vault] push — ${envFile} → vault: ${vault}`);
  run(args[0], args.slice(1), { cwd: root });
}

function opUpdate({ project, env, varName, varValue }) {
  if (!varName) err('var=<NAME> is required for the update operation.');
  if (varValue === undefined) err('value=<val> is required for the update operation.');

  const cfg = PROJECTS[project];
  const isUat = env === 'uat';
  const vault = cfg.vaults[isUat ? 'uat' : 'prod'];
  const secretName = varName.replaceAll('_', '-');

  checkAzSession();

  console.log(`[key-vault] update — ${varName} (→ ${secretName}) in vault: ${vault}`);
  run('az', [
    'keyvault', 'secret', 'set',
    '--vault-name', vault,
    '--name', secretName,
    '--value', String(varValue),
    '-o', 'none',
  ]);
  console.log(`[key-vault] ✓ ${secretName} updated.`);
}

function opList({ project, env }) {
  const cfg = PROJECTS[project];
  const isUat = env === 'uat';
  const vault = cfg.vaults[isUat ? 'uat' : 'prod'];

  checkAzSession();

  console.log(`[key-vault] list — vault: ${vault}\n`);
  run('az', [
    'keyvault', 'secret', 'list',
    '--vault-name', vault,
    '--query', '[].name',
    '-o', 'tsv',
  ]);
}

function opVerify({ project, env, file, root }) {
  const cfg = PROJECTS[project];
  const isUat = env === 'uat';
  const service = isUat ? cfg.pullServiceUat : cfg.pullService;
  const vault = cfg.vaults[isUat ? 'uat' : 'prod'];
  const envFile = file || cfg.defaultOut;
  const script = scriptPath(root, project, 'pull.mjs');

  assertScriptsExist(root, project, 'pull.mjs');
  checkAzSession();

  console.log(`[key-vault] verify — vault: ${vault} vs ${envFile}`);
  run('node', [script, '--service', service, '--out', envFile, '--verify'], { cwd: root });
}

function opProvision({ project, root, devs, rg, loc }) {
  const cfg = PROJECTS[project];
  const vault = cfg.vaults.prod;
  const script = scriptPath(root, project, 'provision.mjs');

  assertScriptsExist(root, project, 'provision.mjs');
  checkAzSession();

  const args = ['node', script, '--vault', vault];
  if (devs) args.push('--devs', devs);
  if (rg) args.push('--rg', rg);
  if (loc) args.push('--loc', loc);

  console.log(`[key-vault] provision — vault: ${vault}`);
  run(args[0], args.slice(1), { cwd: root });
}

// ── Main ─────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(getDocHeader());
  console.log('Available operations: pull, push, update, list, verify, provision');
  console.log('Available projects:   scribe, auth, pay');
}

function getDocHeader() {
  try {
    const src = fileURLToPath(import.meta.url);
    const text = readFileSync(src, 'utf8');
    const m = text.match(/^\/\*\*([\s\S]*?)\*\//);
    return m ? m[0] : '';
  } catch { return ''; }
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help') {
    printHelp();
    process.exit(0);
  }

  const { op, kv, flags } = parseArgs(argv);

  if (!op) {
    printHelp();
    process.exit(1);
  }

  const project = kv.project;
  if (!project) err('project=<scribe|auth|pay> is required.');
  if (!PROJECTS[project]) err(`Unknown project "${project}". Valid: ${Object.keys(PROJECTS).join(', ')}`);

  const env = kv.env || 'prod';
  const root = resolveRoot(project, kv.root);
  const dryRun = flags.has('--dry-run');
  const force = flags.has('--force');
  const verify = flags.has('--verify');
  const yes = flags.has('--yes');

  const dispatch = {
    pull:      () => opPull({ project, env, out: kv.out, root, force, verify }),
    push:      () => opPush({ project, env, file: kv.file, root, dryRun, yes }),
    update:    () => opUpdate({ project, env, varName: kv.var, varValue: kv.value }),
    list:      () => opList({ project, env }),
    verify:    () => opVerify({ project, env, file: kv.file, root }),
    provision: () => opProvision({ project, root, devs: kv.devs, rg: kv.rg, loc: kv.loc }),
  };

  if (!dispatch[op]) {
    console.error(`[key-vault] Unknown operation: "${op}"`);
    console.error(`Available: ${Object.keys(dispatch).join(', ')}`);
    process.exit(1);
  }

  dispatch[op]();
}

main();
