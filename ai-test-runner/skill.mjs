#!/usr/bin/env node
/**
 * ai-test-runner/skill.mjs
 * Companion script for the ai-test-runner Claude Code skill.
 *
 * Runner mode (default):
 *   node skill.mjs                          # run full suite
 *   node skill.mjs src/lib/ai/steps/        # scope to subdirectory
 *   node skill.mjs --coverage-only          # coverage report only
 *
 * Builder mode:
 *   node skill.mjs --build <file|dir>       # static analysis manifest for test generation
 *
 * Part of: nebuladevops/skills-engineering-auto
 */

import { spawn } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname, basename, dirname } from 'path';

const DEFAULT_SCOPE = 'src/lib/ai/';
const SEPARATOR = '─'.repeat(60);

const args = process.argv.slice(2);
const coverageOnly = args.includes('--coverage-only');
const buildMode = args.includes('--build');
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

// ─── Build mode — static analysis ────────────────────────────────────────────

const SDK_PATTERNS = [
  { pkg: 'openai',               mock: "vi.mock('openai', () => ({ default: class OpenAI { chat = { completions: { create: vi.fn() } } } }))" },
  { pkg: '@anthropic-ai/sdk',    mock: "vi.mock('@anthropic-ai/sdk', () => ({ default: class Anthropic { messages = { create: vi.fn() } } }))" },
  { pkg: '@google/generative-ai',mock: "vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: class { getGenerativeModel = vi.fn().mockReturnValue({ generateContent: vi.fn() }) } }))" },
  { pkg: '@langchain/anthropic', mock: "vi.mock('@langchain/anthropic', () => ({ ChatAnthropic: class { withStructuredOutput = vi.fn().mockReturnThis(); invoke = vi.fn() } }))" },
  { pkg: '@langchain/openai',    mock: "vi.mock('@langchain/openai', () => ({ ChatOpenAI: class { withStructuredOutput = vi.fn().mockReturnThis(); invoke = vi.fn() } }))" },
  { pkg: 'langchain',            mock: "vi.mock('langchain', () => ({ ChatPromptTemplate: { fromMessages: vi.fn().mockReturnValue({ pipe: vi.fn().mockReturnThis(), invoke: vi.fn() }) } }))" },
  { pkg: 'pinecone',             mock: "vi.mock('@/lib/ai/pinecone', () => ({ searchSimilarDocuments: vi.fn().mockResolvedValue([]) }))" },
];

const ENV_VARS = [
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY',
  'PINECONE_API_KEY', 'PINECONE_INDEX', 'CLAUDE_MODEL', 'OPENAI_MODEL',
];

function collectTsFiles(target) {
  if (!existsSync(target)) return [];
  const stat = statSync(target);
  if (stat.isFile()) return target.endsWith('.ts') && !target.endsWith('.d.ts') ? [target] : [];

  const files = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory() && !['node_modules', '.next', '__generated__'].includes(entry.name)) {
      files.push(...collectTsFiles(join(target, entry.name)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      files.push(join(target, entry.name));
    }
  }
  return files;
}

function analyzeFile(filePath) {
  let src;
  try { src = readFileSync(filePath, 'utf8'); } catch { return null; }

  const lines = src.split('\n');

  // Exports
  const exports = [];
  for (const line of lines) {
    const m = line.match(/^export\s+(async\s+)?function\s+(\w+)|^export\s+const\s+(\w+)\s*=/);
    if (m) {
      const name = m[2] || m[3];
      const isAsync = !!m[1] || line.includes('async') || line.includes('Promise');
      const isStreaming = src.includes(`AsyncGenerator`) && src.includes(name);
      exports.push({ name, isAsync, isStreaming });
    }
  }

  // Imports
  const sdkImports = [];
  for (const { pkg } of SDK_PATTERNS) {
    if (src.includes(`'${pkg}'`) || src.includes(`"${pkg}"`)) {
      sdkImports.push(pkg);
    }
  }

  // Env vars referenced
  const envRefs = ENV_VARS.filter((v) => src.includes(v));

  // Zod usage
  const usesZod = src.includes('z.object') || src.includes('.parse(') || src.includes('.safeParse(');
  const zodSchemas = [];
  for (const line of lines) {
    const m = line.match(/(?:const|let)\s+(\w+Schema|\w+Shape)\s*=/);
    if (m) zodSchemas.push(m[1]);
  }

  // Internal deps (src/lib/ai/* imports)
  const internalDeps = [];
  for (const line of lines) {
    const m = line.match(/from\s+['"](@\/lib\/ai\/[^'"]+|\.\/[^'"]+)['"]/);
    if (m) internalDeps.push(m[1]);
  }

  // Existing test file
  const dir = dirname(filePath);
  const base = basename(filePath, '.ts');
  const testPath = join(dir, `${base}.test.ts`);
  const hasTests = existsSync(testPath);

  return {
    file: filePath,
    exports,
    sdkImports,
    envRefs,
    usesZod,
    zodSchemas,
    internalDeps,
    hasTests,
    testPath,
    loc: lines.length,
  };
}

function buildManifest(target) {
  const files = collectTsFiles(target);
  if (files.length === 0) {
    return `[ai-test-runner --build] No TypeScript source files found at: ${target}\n`;
  }

  const analyses = files.map(analyzeFile).filter(Boolean);
  const out = [];

  out.push('');
  out.push('╔══════════════════════════════════════════════════════════╗');
  out.push('║         AI LAYER TEST BUILDER — BUILD MANIFEST           ║');
  out.push('╚══════════════════════════════════════════════════════════╝');
  out.push('');
  out.push(`Target:  ${target}`);
  out.push(`Files:   ${analyses.length} source files found`);
  out.push(`Tested:  ${analyses.filter((a) => a.hasTests).length} already have test files`);
  out.push(`Untested: ${analyses.filter((a) => !a.hasTests).length} need tests written`);
  out.push('');

  // Priority queue — untested files first, then by export count descending
  const prioritized = [...analyses].sort((a, b) => {
    if (a.hasTests !== b.hasTests) return a.hasTests ? 1 : -1;
    return b.exports.length - a.exports.length;
  });

  for (const a of prioritized) {
    out.push(SEPARATOR);
    out.push(`FILE: ${a.file}  [${a.loc} lines]  ${a.hasTests ? '✓ test exists' : '✗ NO TESTS'}`);
    out.push('');

    if (a.exports.length > 0) {
      out.push('EXPORTS:');
      for (const e of a.exports) {
        const flags = [e.isAsync ? 'async' : 'sync', e.isStreaming ? 'streaming' : null].filter(Boolean).join(', ');
        out.push(`  - ${e.name}()  [${flags}]`);
      }
      out.push('');
    }

    if (a.sdkImports.length > 0) {
      out.push('SDK DEPENDENCIES (must mock):');
      for (const pkg of a.sdkImports) {
        const pattern = SDK_PATTERNS.find((p) => p.pkg === pkg);
        out.push(`  - ${pkg}`);
        if (pattern) out.push(`    mock: ${pattern.mock}`);
      }
      out.push('');
    }

    if (a.envRefs.length > 0) {
      out.push('ENV VARS (must vi.stubEnv):');
      a.envRefs.forEach((v) => out.push(`  - ${v}`));
      out.push('');
    }

    if (a.usesZod) {
      out.push(`ZOD SCHEMAS: ${a.zodSchemas.length > 0 ? a.zodSchemas.join(', ') : 'yes (inline)'}`);
      out.push('  → Write: valid input test + invalid input test (wrong type) for each schema');
      out.push('');
    }

    if (a.internalDeps.length > 0) {
      out.push('INTERNAL DEPS (read these too):');
      a.internalDeps.slice(0, 5).forEach((d) => out.push(`  - ${d}`));
      out.push('');
    }

    if (!a.hasTests) {
      out.push(`WRITE TO: ${a.testPath}`);
      out.push('');
    }
  }

  out.push(SEPARATOR);
  out.push('');
  out.push('NEXT STEPS FOR CLAUDE:');
  out.push('1. Read each source file listed above (full content)');
  out.push('2. Read src/lib/ai/types.ts for shared types');
  out.push('3. For each untested file, produce the test plan (Phase 3) before writing');
  out.push('4. Write tests following the ultra-senior quality bar in the skill');
  out.push('5. Run /ai-test <file> after each test file to verify it passes');
  out.push('');
  out.push('skill: ai-test-runner --build | nebuladevops/skills-engineering-auto');
  out.push('');

  return out.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    // ── Build mode ──────────────────────────────────────────────────────────
    if (buildMode) {
      const target = scopeArg || DEFAULT_SCOPE;
      console.log(buildManifest(target));
      return;
    }

    // ── Runner mode ─────────────────────────────────────────────────────────
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
