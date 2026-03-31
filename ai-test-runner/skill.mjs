#!/usr/bin/env node
/**
 * ai-test-runner/skill.mjs
 * Companion script for the ai-test-runner Claude Code skill.
 *
 * Runs Vitest on src/lib/ai/, parses output, classifies failures,
 * and prints a structured report for Claude to analyze.
 *
 * Usage:
 *   node skill.mjs                          # run full suite
 *   node skill.mjs src/lib/ai/steps/        # scope to subdirectory
 *   node skill.mjs --coverage-only          # coverage report only
 *
 * Part of: nebuladevops/skills-engineering-auto
 */

import { spawn } from 'child_process';

const DEFAULT_SCOPE = 'src/lib/ai/';
const SEPARATOR = '─'.repeat(60);

const args = process.argv.slice(2);
const coverageOnly = args.includes('--coverage-only');
const scopeArg = args.find((a) => !a.startsWith('--'));
const scope = scopeArg || DEFAULT_SCOPE;

// ─── Failure classification ───────────────────────────────────────────────────

const FAILURE_HINTS = {
  'wrong-mock':
    'vi.mock() return shape does not match actual module. Verify mock constructor/method signatures against the real SDK.',
  'schema-mismatch':
    'Zod schema validation failed. Mock return value does not satisfy the expected schema — check required fields and types.',
  'logic-error':
    'Mock is correct, schema is correct — implementation diverges from expected output. Read source and test carefully.',
  'missing-dependency':
    'Module import failed. Check path aliases in vitest.config.ts match tsconfig.json, and that the package is installed.',
  'environment-issue':
    'Environment variable undefined at test runtime. Add vi.stubEnv() in the test or a global setup file.',
};

function classifyFailure(error) {
  const msg = (error || '').toLowerCase();
  if (msg.includes('mock') && (msg.includes('not called') || msg.includes('return') || msg.includes('spy')))
    return 'wrong-mock';
  if (msg.includes('zod') || msg.includes('parseerror') || msg.includes('invalid_type') || msg.includes('schema'))
    return 'schema-mismatch';
  if (msg.includes('cannot find module') || msg.includes('enoent') || msg.includes('module not found'))
    return 'missing-dependency';
  if (
    (msg.includes('undefined') && msg.includes('env')) ||
    msg.includes('api_key') ||
    msg.includes('process.env')
  )
    return 'environment-issue';
  return 'logic-error';
}

// ─── Process runner ───────────────────────────────────────────────────────────

function run(cmd, cmdArgs) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(cmd, cmdArgs, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolve({ output: stdout + stderr, code }));
  });
}

// ─── Vitest output parser ─────────────────────────────────────────────────────

function parseOutput(raw) {
  const lines = raw.split('\n');
  const failures = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const line of lines) {
    const m = line.match(/Tests\s+(?:(\d+)\s+failed[^|]*\|?\s*)?(\d+)\s+passed/);
    if (m) {
      failedCount = m[1] ? parseInt(m[1], 10) : 0;
      passedCount = parseInt(m[2], 10);
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.match(/^\s*(×|✗|✕)\s/) || line.match(/^\s*●\s+[A-Z]/)) {
      const nameMatch = line.match(/(?:×|✗|✕|●)\s+(.+)/);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown test';

      const errorLines = [];
      let file = '';
      let lineNo = 0;

      for (let j = i + 1; j < Math.min(i + 35, lines.length); j++) {
        const l = lines[j];

        if (!file) {
          const fm = l.match(/([^\s]+\.(test|spec)\.(ts|tsx|js)):(\d+)/);
          if (fm) { file = fm[1]; lineNo = parseInt(fm[4], 10); }
        }

        if (
          l.includes('Error:') ||
          l.includes('Expected') ||
          l.includes('Received') ||
          l.includes('AssertionError') ||
          l.includes('TypeError')
        ) {
          errorLines.push(l.trim());
        }

        if (j > i + 3 && l.match(/^\s*(×|✗|✕|✓|√|FAIL|PASS|Tests\s)/)) break;
      }

      const errorText = errorLines.slice(0, 8).join('\n');
      failures.push({ name, file, line: lineNo, error: errorText, type: classifyFailure(errorText) });
    }
    i++;
  }

  return {
    failures,
    passedCount,
    failedCount: failedCount || failures.length,
  };
}

function parseCoverage(raw) {
  const files = {};

  for (const line of raw.split('\n')) {
    const m = line.match(/\|\s+([^\|]+\.tsx?)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (m) {
      files[m[1].trim()] = {
        statements: parseFloat(m[2]),
        branches: parseFloat(m[3]),
        functions: parseFloat(m[4]),
        lines: parseFloat(m[5]),
      };
    }
  }

  const om = raw.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
  const overall = om
    ? { statements: parseFloat(om[1]), branches: parseFloat(om[2]), functions: parseFloat(om[3]), lines: parseFloat(om[4]) }
    : null;

  return { files, overall };
}

// ─── Report builder ───────────────────────────────────────────────────────────

function buildReport({ failures, passedCount, failedCount, coverage, scope, rawOutput }) {
  const out = [];

  out.push('');
  out.push('╔══════════════════════════════════════════════════════════╗');
  out.push('║        AI LAYER TEST RUNNER — STRUCTURED REPORT          ║');
  out.push('╚══════════════════════════════════════════════════════════╝');
  out.push('');

  // SUMMARY
  out.push('## SUMMARY');
  out.push(SEPARATOR);
  out.push(`Scope:    ${scope}`);
  out.push(`Total:    ${passedCount + failedCount} tests  |  ${passedCount} passed ✓  |  ${failedCount} failed ✗`);
  if (coverage?.overall) {
    const c = coverage.overall;
    out.push(`Coverage: stmts ${c.statements}%  |  branches ${c.branches}%  |  fns ${c.functions}%  |  lines ${c.lines}%`);
  } else {
    out.push('Coverage: run with --coverage-only flag to see metrics');
  }
  out.push('');

  // FAILURES
  out.push('## FAILURES');
  out.push(SEPARATOR);

  if (failures.length === 0) {
    out.push('None — all tests passed ✓');
  } else {
    failures.forEach((f, idx) => {
      out.push('');
      out.push(`[${idx + 1}] ${f.name}`);
      out.push(`    Type:  ${f.type}`);
      if (f.file) out.push(`    File:  ${f.file}:${f.line}`);
      if (f.error) {
        out.push('    Error:');
        f.error.split('\n').forEach((l) => out.push(`      ${l}`));
      }
      out.push(`    Hint:  ${FAILURE_HINTS[f.type]}`);
      out.push('    Fix:   → Claude reads source + test file and proposes a targeted diff (never auto-applied)');
    });
  }
  out.push('');

  // UNTESTED
  out.push('## UNTESTED');
  out.push(SEPARATOR);

  if (coverage?.files && Object.keys(coverage.files).length > 0) {
    const low = Object.entries(coverage.files)
      .filter(([, c]) => c.functions < 60)
      .sort(([, a], [, b]) => a.functions - b.functions);

    if (low.length > 0) {
      out.push('Files with function coverage < 60%:');
      low.forEach(([file, c]) => out.push(`  - ${file}  (${c.functions}% fn coverage)`));
    } else {
      out.push('All files have ≥ 60% function coverage.');
    }
  } else {
    out.push('Re-run with --coverage-only to detect untested paths.');
  }
  out.push('');

  // RECOMMENDATIONS
  out.push('## RECOMMENDATIONS');
  out.push(SEPARATOR);

  const typeCounts = {};
  failures.forEach((f) => (typeCounts[f.type] = (typeCounts[f.type] || 0) + 1));

  if (Object.keys(typeCounts).length === 0) {
    out.push('- All tests passing. Expand coverage for error paths and edge cases in src/lib/ai/.');
  } else {
    if (typeCounts['wrong-mock'])
      out.push(`- [${typeCounts['wrong-mock']} wrong-mock] Update vi.mock() factories — match constructor shape to actual SDK class.`);
    if (typeCounts['schema-mismatch'])
      out.push(`- [${typeCounts['schema-mismatch']} schema-mismatch] Fix mock return values to satisfy Zod schema constraints.`);
    if (typeCounts['environment-issue'])
      out.push(`- [${typeCounts['environment-issue']} environment-issue] Add vi.stubEnv() for LLM API keys in beforeEach or setup file.`);
    if (typeCounts['missing-dependency'])
      out.push(`- [${typeCounts['missing-dependency']} missing-dependency] Verify vitest.config.ts path aliases match tsconfig.json.`);
    if (typeCounts['logic-error'])
      out.push(`- [${typeCounts['logic-error']} logic-error] Review implementation vs test expectations — read source file carefully.`);
  }

  out.push('');
  out.push(SEPARATOR);
  out.push('skill: ai-test-runner | nebuladevops/skills-engineering-auto');
  out.push('');

  if (failures.length > 0) {
    out.push('## RAW VITEST OUTPUT');
    out.push('(Claude uses this section to read source files and propose fix diffs)');
    out.push(SEPARATOR);
    out.push(rawOutput);
  }

  return out.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    if (coverageOnly) {
      process.stderr.write(`Collecting coverage for ${scope}...\n`);
      const { output } = await run('npx', ['vitest', 'run', '--coverage', '--reporter=verbose', scope]);
      const coverage = parseCoverage(output);
      const parsed = parseOutput(output);
      console.log(buildReport({ ...parsed, coverage, scope, rawOutput: output }));
      return;
    }

    process.stderr.write(`Running vitest for ${scope}...\n`);
    const { output: testOut, code } = await run('npx', ['vitest', 'run', '--reporter=verbose', scope]);
    const parsed = parseOutput(testOut);

    let coverage = null;
    if (code === 0) {
      process.stderr.write('Tests passed — collecting coverage...\n');
      const { output: covOut } = await run('npx', ['vitest', 'run', '--coverage', '--reporter=verbose', scope]);
      coverage = parseCoverage(covOut);
    }

    console.log(buildReport({ ...parsed, coverage, scope, rawOutput: testOut }));
    process.exit(code);
  } catch (err) {
    process.stderr.write(`[ai-test-runner] Error: ${err.message}\n`);
    process.exit(1);
  }
})();
