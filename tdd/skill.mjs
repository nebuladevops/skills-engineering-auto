#!/usr/bin/env node
/**
 * tdd/skill.mjs
 * Companion script for the /tdd Claude Code skill.
 *
 * Provides static analysis of target files so the TDD skill can operate
 * with full context: layer type, exports, dependencies, mock strategy,
 * and existing test status — without Claude having to guess.
 *
 * Usage (from project root):
 *   node .claude/skills/tdd/skill.mjs --analyze src/dal/logged/bookmarks.ts
 *   node .claude/skills/tdd/skill.mjs --analyze src/app/api/bookmarks/route.ts
 *   node .claude/skills/tdd/skill.mjs --analyze src/lib/encryption/index.ts
 *   node .claude/skills/tdd/skill.mjs --check src/dal/logged/bookmarks.ts
 *   node .claude/skills/tdd/skill.mjs --check src/lib/ai/tools/bullets.ts
 *
 * Flags:
 *   --analyze <path>   Static analysis manifest for TDD context (default mode)
 *   --check <path>     Verify test existence and run vitest on existing tests
 *
 * Part of: nebuladevops/skills-engineering-auto
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname, basename, relative } from 'path';

const SEPARATOR = '─'.repeat(60);
const args = process.argv.slice(2);
const analyzeMode = args.includes('--analyze') || (!args.includes('--check') && args.length > 0 && !args[0].startsWith('--'));
const checkMode = args.includes('--check');

const targetArg =
  args.find((_, i) => args[i - 1] === '--analyze') ||
  args.find((_, i) => args[i - 1] === '--check') ||
  args.find((a) => !a.startsWith('--'));

// ─── Layer Detection ──────────────────────────────────────────────────────────

const LAYER_META = {
  'api-route':      { label: 'API Route',         jsdom: false, delegateToAiTest: false },
  'dal':            { label: 'DAL (Data Access)',  jsdom: false, delegateToAiTest: false },
  'server-action':  { label: 'Server Action',      jsdom: false, delegateToAiTest: false },
  'ai':             { label: 'AI Layer',           jsdom: false, delegateToAiTest: true  },
  'service':        { label: 'Service',            jsdom: false, delegateToAiTest: false },
  'hook':           { label: 'React Hook',         jsdom: true,  delegateToAiTest: false },
  'component':      { label: 'React Component',   jsdom: true,  delegateToAiTest: false },
  'encryption':     { label: 'Encryption Utility', jsdom: false, delegateToAiTest: false },
  'context':        { label: 'Context Provider',   jsdom: true,  delegateToAiTest: false },
  'unknown':        { label: 'Unknown',            jsdom: false, delegateToAiTest: false },
};

function detectLayer(filePath) {
  const p = filePath.replace(/\\/g, '/');
  if (p.includes('src/app/api/'))          return 'api-route';
  if (p.includes('src/dal/'))              return 'dal';
  if (p.includes('src/actions/'))          return 'server-action';
  if (p.includes('src/lib/ai/'))           return 'ai';
  if (p.includes('src/services/'))         return 'service';
  if (p.includes('src/hooks/'))            return 'hook';
  if (p.includes('src/components/'))       return 'component';
  if (p.includes('src/lib/encryption/'))   return 'encryption';
  if (p.includes('src/context/'))          return 'context';
  return 'unknown';
}

// ─── Layer Mock Strategies ────────────────────────────────────────────────────

const MOCK_STRATEGIES = {
  'api-route': {
    mocks: [
      '`@/auth`  →  mock `auth()` for HTTP-level 401 guard',
      '`@/dal/data-access`  →  mock named DAL exports (functions called by the route)',
    ],
    pattern: `const { mockAuth, mockDalFn } = vi.hoisted(() => ({ mockAuth: vi.fn(), mockDalFn: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mockAuth }));
vi.mock('@/dal/data-access', () => ({ dalFunctionName: mockDalFn }));`,
    testNote: 'Test each HTTP method (GET/POST/PATCH/DELETE). Create Request objects: new Request(url, { method, body }). Expect res.status and await res.json().',
    envNote: 'No extra env stubs needed beyond src/test/setup.ts defaults.',
  },
  'dal': {
    mocks: [
      '`@/lib/prisma`  →  mock default export (PrismaClient singleton)',
      '`@/auth`  →  mock `auth()` for session lookup (dynamically imported via BaseDal)',
    ],
    pattern: `const { mockPrisma, mockAuth } = vi.hoisted(() => ({
  mockPrisma: {
    modelName: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  },
  mockAuth: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/auth', () => ({ auth: mockAuth }));`,
    testNote: 'Instantiate the DAL class directly in the test (new LoggedXxxDal()) — do NOT import from @/dal/logged barrel. All methods return Promise<ServiceResponse<T>>.',
    envNote: 'No extra env stubs needed.',
  },
  'server-action': {
    mocks: [
      '`@/dal/logged`  →  mock named pre-bound DAL exports',
    ],
    pattern: `const { mockDalFn } = vi.hoisted(() => ({ mockDalFn: vi.fn() }));
vi.mock('@/dal/logged', () => ({ dalFunctionName: mockDalFn }));`,
    testNote: "'use server' directive is ignored by Vitest. Call the action function directly. Auth is inside DAL — no need to mock @/auth here.",
    envNote: 'No extra env stubs needed.',
  },
  'ai': {
    mocks: ['Delegate to /ai-test --build — comprehensive SDK mock patterns in that skill.'],
    pattern: '// Run: /ai-test --build <path>',
    testNote: 'The ai-test-runner skill handles this layer. Run /ai-test --build src/lib/ai/<path> instead.',
    envNote: 'API keys already stubbed in src/test/setup.ts.',
  },
  'service': {
    mocks: [
      '`global.fetch`  →  vi.stubGlobal("fetch", vi.fn())',
      'Service-specific env vars (per service)',
    ],
    pattern: `const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubEnv('SERVICE_KEY', 'test-key');`,
    testNote: 'Mock fetch to return { ok, status, json: async () => ({...}) }. Test both success (ok: true) and failure (ok: false) responses.',
    envNote: 'Stub service-specific env vars with vi.stubEnv().',
  },
  'hook': {
    mocks: [
      '`next-auth/react`  →  mock `useSession`',
      '`swr`  →  mock default export (useSWR)',
      '`next/navigation`  →  mock `useRouter`, `usePathname`',
    ],
    pattern: `// @vitest-environment jsdom   ← add this at the top of the file
vi.mock('next-auth/react', () => ({
  useSession: vi.fn().mockReturnValue({ data: { user: { id: 'user-1' } }, status: 'authenticated' }),
}));`,
    testNote: 'Requires @testing-library/react. Use renderHook() and waitFor(). Add // @vitest-environment jsdom at top of file.',
    envNote: 'jsdom environment required. Install: pnpm add -D @testing-library/react jsdom',
  },
  'component': {
    mocks: [
      '`next-auth/react`  →  mock session hooks',
      '`next/navigation`  →  mock router hooks',
      'Server actions  →  mock action imports',
    ],
    pattern: `// @vitest-environment jsdom   ← add this at the top of the file
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), back: vi.fn() }),
  usePathname: vi.fn().mockReturnValue('/test'),
}));`,
    testNote: 'Requires @testing-library/react. Use render() and screen queries. Add // @vitest-environment jsdom at top of file.',
    envNote: 'jsdom environment required. Install: pnpm add -D @testing-library/react @testing-library/jest-dom jsdom',
  },
  'encryption': {
    mocks: ['None — pure Node.js crypto functions.'],
    pattern: '// No mocks needed. ENCRYPTION_KEY already stubbed in src/test/setup.ts.',
    testNote: 'Test encrypt/decrypt round-trip. Verify different ciphertext per call (random IV). Test error paths with invalid ciphertext.',
    envNote: 'ENCRYPTION_KEY already stubbed globally.',
  },
  'context': {
    mocks: [
      '`next-auth/react`  →  mock `useSession`',
      '`swr`  →  mock useSWR if used',
      'Server actions  →  mock action imports',
    ],
    pattern: `// @vitest-environment jsdom   ← add this at the top of the file
import { renderHook } from '@testing-library/react';
const wrapper = ({ children }) => <ProviderComponent>{children}</ProviderComponent>;
const { result } = renderHook(() => useContext(), { wrapper });`,
    testNote: 'Requires @testing-library/react. Use renderHook() with wrapper prop containing the provider. Add // @vitest-environment jsdom.',
    envNote: 'jsdom environment required.',
  },
  'unknown': {
    mocks: ['Cannot determine automatically — read the file and identify external dependencies.'],
    pattern: '// Inspect imports and determine mock strategy manually.',
    testNote: 'Layer not detected. Check if this is in a recognized src/ subdirectory.',
    envNote: 'Unknown.',
  },
};

// ─── File Analysis ────────────────────────────────────────────────────────────

const KNOWN_IMPORTS_TO_WATCH = [
  '@/lib/prisma', '@/auth', '@/dal/data-access', '@/dal/logged', '@/dal/unlogged',
  '@/lib/encryption', '@/lib/ai/', 'next/server', 'next/navigation', 'next/cache',
  'next-auth/react', 'swr', '@azure/', '@anthropic-ai/', 'openai', '@google/',
  '@langchain/', 'langchain', 'fetch',
];

function collectTsFiles(target) {
  if (!existsSync(target)) return [];
  const stat = statSync(target);
  if (stat.isFile()) {
    return target.replace(/\\/g, '/').match(/\.(ts|tsx)$/) && !target.includes('.d.ts') ? [target] : [];
  }
  const files = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory() && !['node_modules', '.next', '__generated__'].includes(entry.name)) {
      files.push(...collectTsFiles(join(target, entry.name)));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
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
  const normalizedPath = filePath.replace(/\\/g, '/');

  // ── Exports ──────────────────────────────────────────────────────────────
  const exports = [];
  let inClass = false;
  let currentClassName = null;

  for (const line of lines) {
    // Class declaration
    const classMatch = line.match(/^export\s+class\s+(\w+)/);
    if (classMatch) {
      inClass = true;
      currentClassName = classMatch[1];
      exports.push({ name: currentClassName, kind: 'class', isAsync: false });
      continue;
    }

    // Class methods (indented async methods)
    if (inClass) {
      const methodMatch = line.match(/^\s+(async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/);
      if (methodMatch && !['constructor', 'if', 'for', 'while', 'switch'].includes(methodMatch[2])) {
        const isAsync = !!methodMatch[1];
        exports.push({ name: `${currentClassName}.${methodMatch[2]}()`, kind: 'method', isAsync });
      }
      if (line.match(/^}/)) inClass = false;
      continue;
    }

    // Top-level function/const exports
    const fnMatch = line.match(/^export\s+(async\s+)?function\s+(\w+)/);
    const constMatch = line.match(/^export\s+const\s+(\w+)\s*=/);
    if (fnMatch) exports.push({ name: fnMatch[2] + '()', kind: 'function', isAsync: !!fnMatch[1] });
    if (constMatch) exports.push({ name: constMatch[1], kind: 'const', isAsync: false });
  }

  // ── Imports ───────────────────────────────────────────────────────────────
  const importPaths = [];
  for (const line of lines) {
    const m = line.match(/from\s+['"]([^'"]+)['"]/);
    if (m) importPaths.push(m[1]);
  }

  const knownDeps = importPaths.filter((p) =>
    KNOWN_IMPORTS_TO_WATCH.some((k) => p.startsWith(k) || p.includes(k))
  );
  const internalDeps = importPaths.filter((p) => p.startsWith('.') || p.startsWith('@/'));

  // ── Zod ───────────────────────────────────────────────────────────────────
  const usesZod = src.includes('z.object') || src.includes('.parse(') || src.includes('.safeParse(');
  const zodSchemas = [];
  for (const line of lines) {
    const m = line.match(/(?:const|let)\s+(\w+(?:[Ss]chema|[Ss]hape))\s*=/);
    if (m) zodSchemas.push(m[1]);
  }

  // ── Env vars ──────────────────────────────────────────────────────────────
  const envVars = [];
  const envMatches = src.matchAll(/process\.env\.([A-Z_]+)/g);
  for (const m of envMatches) {
    if (!envVars.includes(m[1])) envVars.push(m[1]);
  }

  // ── Test file ─────────────────────────────────────────────────────────────
  const dir = dirname(filePath);
  const base = basename(filePath).replace(/\.(ts|tsx)$/, '');
  const testPath = join(dir, `${base}.test.ts`);

  return {
    file: normalizedPath,
    layer: detectLayer(normalizedPath),
    loc: lines.length,
    exports,
    knownDeps,
    internalDeps: internalDeps.filter((d) => !d.startsWith('@/')).slice(0, 6),
    usesZod,
    zodSchemas,
    envVars,
    hasTests: existsSync(testPath),
    testPath: testPath.replace(/\\/g, '/'),
  };
}

// ─── Analysis Report ──────────────────────────────────────────────────────────

function buildAnalysisReport(analysis) {
  const { layer } = analysis;
  const meta = LAYER_META[layer];
  const strategy = MOCK_STRATEGIES[layer];
  const out = [];

  out.push('');
  out.push('╔══════════════════════════════════════════════════════════╗');
  out.push('║              TDD SKILL — ANALYSIS MANIFEST               ║');
  out.push('╚══════════════════════════════════════════════════════════╝');
  out.push('');
  out.push(`TARGET:    ${analysis.file}`);
  out.push(`LAYER:     ${meta.label}`);
  out.push(`LOC:       ${analysis.loc} lines`);
  if (meta.jsdom) {
    out.push('JSDOM:     ⚠  Required — add // @vitest-environment jsdom at top of test file');
    out.push('           ⚠  Prerequisite: pnpm add -D @testing-library/react jsdom');
  }
  if (meta.delegateToAiTest) {
    out.push('DELEGATE:  ⚑  AI layer detected — use /ai-test --build <path> for this file');
  }
  out.push('');

  // Exports
  if (analysis.exports.length > 0) {
    out.push('EXPORTS:');
    for (const e of analysis.exports) {
      const flag = e.isAsync ? ' [async]' : '';
      const kind = e.kind === 'class' ? ' [class]' : e.kind === 'method' ? ' [method]' : '';
      out.push(`  - ${e.name}${flag}${kind}`);
    }
    out.push('');
  } else {
    out.push('EXPORTS:   (none detected — file may use default export or re-exports)');
    out.push('');
  }

  // Dependencies to mock
  out.push('DEPENDENCIES TO MOCK:');
  for (const dep of strategy.mocks) {
    out.push(`  • ${dep}`);
  }
  out.push('');

  // Detected known imports
  if (analysis.knownDeps.length > 0) {
    out.push('DETECTED IMPORTS (cross-referenced):');
    for (const d of analysis.knownDeps) out.push(`  - ${d}`);
    out.push('');
  }

  // Internal deps
  if (analysis.internalDeps.length > 0) {
    out.push('INTERNAL DEPS (may need to read for types):');
    for (const d of analysis.internalDeps) out.push(`  - ${d}`);
    out.push('');
  }

  // Zod
  if (analysis.usesZod) {
    out.push(`ZOD SCHEMAS: ${analysis.zodSchemas.length > 0 ? analysis.zodSchemas.join(', ') : 'yes (inline)'}`);
    out.push('  → Write: one test with valid data, one with invalid data per schema');
    out.push('');
  }

  // Env vars
  const alreadyStubbed = ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY','PINECONE_API_KEY',
    'PINECONE_INDEX','ENCRYPTION_KEY','DEEPGRAM_API_KEY','DEPLOYMENT_ENV','LANGSMITH_TRACING'];
  const needsStub = analysis.envVars.filter((v) => !alreadyStubbed.includes(v));
  if (needsStub.length > 0) {
    out.push('ENV VARS (need vi.stubEnv() in test):');
    for (const v of needsStub) out.push(`  - ${v}`);
    out.push('');
  }

  // Test status
  out.push('TEST STATUS:');
  if (analysis.hasTests) {
    out.push(`  ✓  Test file exists: ${analysis.testPath}`);
    out.push('     Run: node .claude/skills/tdd/skill.mjs --check ' + analysis.file);
  } else {
    out.push(`  ✗  No test file found`);
    out.push(`     Write to: ${analysis.testPath}`);
  }
  out.push('');

  // Mock pattern
  out.push('MOCK PATTERN (from guide.md):');
  out.push(SEPARATOR);
  strategy.pattern.split('\n').forEach((l) => out.push(l));
  out.push(SEPARATOR);
  out.push('');

  // Test notes
  out.push('TESTING NOTES:');
  out.push(`  ${strategy.testNote}`);
  out.push(`  Env: ${strategy.envNote}`);
  out.push('');

  // TDD entry point
  out.push(SEPARATOR);
  out.push('TDD ENTRY POINT FOR CLAUDE:');
  out.push(SEPARATOR);

  if (meta.delegateToAiTest) {
    out.push('');
    out.push('This file is in src/lib/ai/ — delegate to the ai-test-runner skill:');
    out.push(`  /ai-test --build ${analysis.file}`);
    out.push('');
  } else {
    const functionList = analysis.exports
      .filter((e) => e.kind !== 'class')
      .map((e) => e.name)
      .slice(0, 3)
      .join(', ');

    out.push('');
    out.push('In FEATURE mode — ask the user BEFORE reading source code:');
    if (functionList) {
      out.push(`  "What should ${functionList} do when called with valid input?"`);
    } else {
      out.push('  "What should this module do? Describe inputs, outputs, and error cases."');
    }
    out.push('');
    out.push('In REFACTOR mode — read source now, write characterization tests.');
    out.push('In BUGFIX mode — ask user to describe the bug (input/expected/actual), then reproduce.');
    out.push('');
  }

  out.push('skill: tdd | nebuladevops/skills-engineering-auto');
  out.push('');

  return out.join('\n');
}

// ─── Check Mode ───────────────────────────────────────────────────────────────

function run(cmd, cmdArgs) {
  return new Promise((resolve) => {
    let output = '';
    const proc = spawn(cmd, cmdArgs, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    proc.stdout.on('data', (d) => (output += d.toString()));
    proc.stderr.on('data', (d) => (output += d.toString()));
    proc.on('close', (code) => resolve({ output, code }));
  });
}

async function runCheckMode(targetPath) {
  const analysis = analyzeFile(targetPath);
  if (!analysis) {
    console.error(`Error: Could not read file: ${targetPath}`);
    process.exit(1);
  }

  const out = [];
  out.push('');
  out.push('╔══════════════════════════════════════════════════════════╗');
  out.push('║              TDD SKILL — CHECK REPORT                    ║');
  out.push('╚══════════════════════════════════════════════════════════╝');
  out.push('');
  out.push(`SOURCE:  ${analysis.file}`);
  out.push(`LAYER:   ${LAYER_META[analysis.layer].label}`);
  out.push(`TEST:    ${analysis.hasTests ? '✓ ' + analysis.testPath : '✗ NOT FOUND — ' + analysis.testPath}`);
  out.push('');

  if (!analysis.hasTests) {
    out.push('No test file found. Use /tdd feature <path> to create one.');
    console.log(out.join('\n'));
    return;
  }

  out.push('Running tests...');
  console.log(out.join('\n'));

  const { output, code } = await run('npx', ['vitest', 'run', '--reporter=verbose', analysis.testPath]);
  console.log(output);

  const passMatch = output.match(/(\d+)\s+passed/);
  const failMatch = output.match(/(\d+)\s+failed/);
  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;

  console.log(SEPARATOR);
  console.log(`RESULT: ${passed} passed | ${failed} failed | exit code ${code}`);
  if (code !== 0) {
    console.log('Tests failing — use /tdd refactor <path> or review test output above.');
  }
  console.log('');
  console.log('skill: tdd | nebuladevops/skills-engineering-auto');

  process.exit(code);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!targetArg) {
  console.error('Usage:');
  console.error('  node skill.mjs --analyze <path>   Analyze file for TDD context');
  console.error('  node skill.mjs --check <path>     Verify test exists and run it');
  console.error('');
  console.error('Examples:');
  console.error('  node .claude/skills/tdd/skill.mjs --analyze src/dal/logged/bookmarks.ts');
  console.error('  node .claude/skills/tdd/skill.mjs --check src/lib/encryption/index.ts');
  process.exit(1);
}

if (!existsSync(targetArg)) {
  console.error(`Error: Path not found: ${targetArg}`);
  console.error('Run this script from the project root directory.');
  process.exit(1);
}

if (checkMode) {
  const files = collectTsFiles(targetArg);
  if (files.length === 0) {
    console.error(`No TypeScript source files found at: ${targetArg}`);
    process.exit(1);
  }
  // Check mode: use the first file or the exact file
  runCheckMode(files[0]);
} else {
  // Analyze mode (default)
  const files = collectTsFiles(targetArg);
  if (files.length === 0) {
    console.error(`No TypeScript source files found at: ${targetArg}`);
    process.exit(1);
  }

  // For a single file, produce one manifest. For a directory, summarize all.
  const stat = statSync(targetArg);
  if (stat.isFile()) {
    const analysis = analyzeFile(targetArg);
    if (!analysis) {
      console.error(`Error: Could not analyze: ${targetArg}`);
      process.exit(1);
    }
    console.log(buildAnalysisReport(analysis));
  } else {
    // Directory: show summary + first untested file
    const analyses = files.map(analyzeFile).filter(Boolean);
    const untested = analyses.filter((a) => !a.hasTests);
    const tested = analyses.filter((a) => a.hasTests);

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║           TDD SKILL — DIRECTORY SUMMARY                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Directory: ${targetArg}`);
    console.log(`Files:     ${analyses.length} total  |  ${tested.length} tested ✓  |  ${untested.length} untested ✗`);
    console.log('');

    if (untested.length > 0) {
      console.log('UNTESTED FILES (priority order):');
      untested
        .sort((a, b) => b.exports.length - a.exports.length)
        .forEach((a) => console.log(`  ✗  ${a.file}  [${a.exports.length} exports, ${a.loc} lines]`));
      console.log('');
      console.log('Run --analyze on a specific file to get the full TDD manifest:');
      console.log(`  node .claude/skills/tdd/skill.mjs --analyze ${untested[0].file}`);
    } else {
      console.log('All files in this directory have test files. ✓');
      console.log('Run --check on a specific file to verify tests are passing:');
      console.log(`  node .claude/skills/tdd/skill.mjs --check ${tested[0].file}`);
    }
    console.log('');
    console.log('skill: tdd | nebuladevops/skills-engineering-auto');
    console.log('');
  }
}
