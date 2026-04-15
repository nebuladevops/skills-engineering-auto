#!/usr/bin/env node
/**
 * e2e-next-test/skill.mjs
 * Companion script for the e2e-next-test Claude Code skill.
 *
 * Parses tests/COVERAGE_PLAN.md and outputs the next pending E2E test case
 * so the Claude skill can operate without reading the full plan manually.
 *
 * Usage:
 *   node skill.mjs                    # next pending case (highest priority)
 *   node skill.mjs --case 3.4         # specific case
 *   node skill.mjs --suite 3          # next pending in suite 3
 *   node skill.mjs --list             # list all pending cases
 *   node skill.mjs --list --suite 4   # list pending cases in suite 4
 *
 * Part of: nebuladevops/skills-engineering-auto
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SEPARATOR = '─'.repeat(60);
const PLAN_PATH = join(process.cwd(), 'tests', 'COVERAGE_PLAN.md');

const args = process.argv.slice(2);
const listMode = args.includes('--list');
const caseArg = args.find((_, i) => args[i - 1] === '--case');
const suiteArg = args.find((_, i) => args[i - 1] === '--suite');

// ─── Parse COVERAGE_PLAN.md ───────────────────────────────────────────────────

function parseCoveragePlan(content) {
  const suites = [];
  let currentSuite = null;

  const lines = content.split('\n');

  for (const line of lines) {
    // Suite header: ## SUITE N — Name [Priority]
    const suiteMatch = line.match(/^## SUITE (\d+) — (.+?) `\[(.+?)\]`/);
    if (suiteMatch) {
      currentSuite = {
        number: parseInt(suiteMatch[1]),
        name: suiteMatch[2].trim(),
        priority: suiteMatch[3],
        files: [],
        cases: [],
      };
      suites.push(currentSuite);
      continue;
    }

    // Also match suite headers without backtick priority
    const suiteMatch2 = line.match(/^## SUITE (\d+) — (.+)/);
    if (suiteMatch2 && !currentSuite?.number) {
      currentSuite = {
        number: parseInt(suiteMatch2[1]),
        name: suiteMatch2[2].replace(/`\[.*?\]`/, '').trim(),
        priority: 'P1',
        files: [],
        cases: [],
      };
      suites.push(currentSuite);
      continue;
    }

    // Source files line
    if (currentSuite && line.startsWith('**Archivos objetivo:**')) {
      currentSuite.files = line
        .replace('**Archivos objetivo:**', '')
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);
    }

    // Test case row: | N.M | description | type | priority | status |
    const caseMatch = line.match(/^\|\s*(\d+\.\d+)\s*\|(.+)/);
    if (caseMatch && currentSuite) {
      const cols = caseMatch[0]
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length < 3) continue;

      const id = cols[0];
      const description = cols[1];
      const type = cols[2];
      const priority = cols[3] || '';
      const status = cols[4] || '';

      const isPending =
        !status.includes('✅') &&
        !status.toLowerCase().includes('n/a') &&
        !status.toLowerCase().includes('cubierto');

      currentSuite.cases.push({
        id,
        description,
        type,
        priority: priority || currentSuite.priority,
        status: status || 'Pendiente',
        isPending,
        suite: currentSuite,
      });
    }
  }

  return suites;
}

function priorityWeight(p) {
  if (p.includes('P1')) return 1;
  if (p.includes('P2')) return 2;
  if (p.includes('P3')) return 3;
  return 4;
}

function getAllPending(suites, suiteFilter) {
  const pending = [];
  for (const suite of suites) {
    if (suiteFilter && suite.number !== parseInt(suiteFilter)) continue;
    for (const c of suite.cases) {
      if (c.isPending) pending.push(c);
    }
  }
  return pending.sort((a, b) => {
    const suiteDiff = a.suite.number - b.suite.number;
    if (suiteDiff !== 0) return suiteDiff;
    return priorityWeight(a.priority) - priorityWeight(b.priority);
  });
}

function findCase(suites, caseId) {
  for (const suite of suites) {
    for (const c of suite.cases) {
      if (c.id === caseId) return c;
    }
  }
  return null;
}

// ─── Format output ────────────────────────────────────────────────────────────

function formatCase(c, index) {
  const lines = [
    ``,
    `  Case ${c.id} — ${c.description}`,
    `  Suite:    ${c.suite.number} — ${c.suite.name}`,
    `  Priority: ${c.priority}`,
    `  Type:     ${c.type}`,
    `  Status:   ${c.status}`,
  ];
  if (c.suite.files.length > 0) {
    lines.push(`  Files:    ${c.suite.files.join(', ')}`);
  }
  return lines.join('\n');
}

function printCase(c) {
  console.log(SEPARATOR);
  console.log(`NEXT PENDING CASE`);
  console.log(SEPARATOR);
  console.log(formatCase(c));
  console.log(``);
  console.log(SEPARATOR);
  console.log(`INSTRUCTIONS FOR CLAUDE`);
  console.log(SEPARATOR);
  console.log(`
Present case ${c.id} to the user exactly as described above.
Ask these questions before reading any source code:
  1. What should the user experience in this flow?
  2. What indicates the flow worked correctly?
  3. What should happen if it fails?
  4. Are there edge cases to cover?

Only after receiving answers: read source files, extract real selectors,
check for discrepancies, then write the test with mandatory annotations.
  `);
}

function printList(pending) {
  console.log(SEPARATOR);
  console.log(`PENDING CASES (${pending.length} total)`);
  console.log(SEPARATOR);
  for (const c of pending) {
    const status = c.isPending ? '⬜' : '✅';
    console.log(`  ${status} ${c.id.padEnd(6)} [${c.priority}] ${c.description} — Suite ${c.suite.number}`);
  }
  console.log(``);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!existsSync(PLAN_PATH)) {
  console.error(`Error: tests/COVERAGE_PLAN.md not found.`);
  console.error(`Run this script from the project root directory.`);
  process.exit(1);
}

const content = readFileSync(PLAN_PATH, 'utf8');
const suites = parseCoveragePlan(content);
const pending = getAllPending(suites, suiteArg);

if (listMode) {
  printList(pending);
  process.exit(0);
}

if (caseArg) {
  const found = findCase(suites, caseArg);
  if (!found) {
    console.error(`Case ${caseArg} not found in COVERAGE_PLAN.md`);
    process.exit(1);
  }
  printCase(found);
  process.exit(0);
}

// Default: next pending
if (pending.length === 0) {
  console.log('🎉 All cases in COVERAGE_PLAN.md are implemented!');
  process.exit(0);
}

printCase(pending[0]);
