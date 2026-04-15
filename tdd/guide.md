# TDD Guide — proto_scribe (Scribe)

Reference document for the `/tdd` skill. Contains all project-specific conventions, mock patterns, and examples. Referred to by `skill.md` — you should read the relevant layer section before writing tests.

---

## 1. Project Test Conventions

**Test runner:** Vitest 4.1.2
**Test glob:** `src/**/*.test.ts` (`.test.ts` only — no `.test.tsx` currently)
**Default environment:** `node` (React layers need `// @vitest-environment jsdom` per-file)
**Setup file:** `src/test/setup.ts` — stubs all API keys globally
**Scripts:**
```bash
pnpm test               # vitest run (all)
pnpm test:watch         # watch mode
pnpm test:coverage      # vitest run --coverage
pnpm test:ai            # vitest run src/lib/ai/ (AI layer only)
npx vitest run <path>   # run specific file or directory
```

**Auto-configured in vitest.config.ts:**
- `restoreMocks: true` — mocks restored between files
- `clearMocks: true` — mock call history cleared between tests
- `unstubEnvs: true` — env var stubs reset between tests
- `passWithNoTests: true` — suite passes even with no matching files

**Globally stubbed in `src/test/setup.ts` (no need to stub in individual tests):**
```typescript
OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY,
PINECONE_API_KEY, PINECONE_INDEX, ENCRYPTION_KEY,
DEEPGRAM_API_KEY, DEPLOYMENT_ENV, LANGSMITH_TRACING
```

**Test file placement:** Co-located with source file.
`src/dal/logged/abbreviations.ts` → `src/dal/logged/abbreviations.test.ts`

---

## 2. AAA Pattern Standard

Every test must have a clearly separated Arrange-Act-Assert structure.

```typescript
it('should return paginated bookmarks when user is authenticated', async () => {
  // Arrange
  const mockBookmarks = [
    { id: '1', messageId: 'msg-1', excerpt: 'Text', userId: 'user-1', createdAt: new Date() },
  ];
  mockPrisma.bookmark.findMany.mockResolvedValue(mockBookmarks);
  mockPrisma.bookmark.count.mockResolvedValue(1);
  mockAuth.mockResolvedValue({ user: { id: 'user-1', username: 'test' } });

  // Act
  const dal = new LoggedBookmarksDal();
  const result = await dal.getUserBookmarks({ page: 1, limit: 10 });

  // Assert
  expect(result.success).toBe(true);
  expect(result.data?.items).toHaveLength(1);
  expect(result.data?.items[0].excerpt).toBe('Text');
});
```

**Anti-patterns:**
- Mixing assertions into the arrange phase
- Multiple act calls in one test
- Assertions without arrange setup (brittle, relies on prior test state)
- Vague assertions like `expect(result).toBeDefined()`

---

## 3. Test Naming Convention

**Pattern:** `it('should <verb> <outcome> when <condition>')`

**Describe block hierarchy:**
```typescript
describe('functionName()', () => {
  describe('happy path', () => {
    it('should return success with data when input is valid', ...)
  });
  describe('error paths', () => {
    it('should return unauthorized error when session is missing', ...)
    it('should return not found error when record does not exist', ...)
  });
  describe('edge cases', () => {
    it('should return empty array when user has no bookmarks', ...)
  });
});
```

**Good names:**
- `it('should encrypt and decrypt text in a round-trip')`
- `it('should return 401 when auth session is null')`
- `it('should call prisma.create with userId from session when creating bookmark')`

**Bad names:**
- `it('works')` — too vague
- `it('test createBookmark')` — not behavior-focused
- `it('should work correctly')` — meaningless

---

## 4. Mock Patterns by Layer

### 4a. DAL Layer (`src/dal/`)

**Architecture:** All DAL classes extend `BaseDal`. `this.prisma` is the module-level Prisma singleton from `@/lib/prisma`. `this.getCurrentAuthContext()` dynamically imports `@/auth` and calls `auth()`. All methods return `Promise<ServiceResponse<T>>`.

**What to mock:** `@/lib/prisma` (Prisma singleton) + `@/auth` (session function)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoggedBookmarksDal } from './bookmarks';

// ─── Mocks (must be at top, before imports that use them) ────────────────────
const { mockPrisma, mockAuth } = vi.hoisted(() => ({
  mockPrisma: {
    bookmark: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
  },
  mockAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/auth', () => ({ auth: mockAuth }));

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('LoggedBookmarksDal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserBookmarks()', () => {
    describe('happy path', () => {
      it('should return paginated bookmarks when user is authenticated', async () => {
        // Arrange
        const session = { user: { id: 'user-1', username: 'test' } };
        mockAuth.mockResolvedValue(session);
        const bookmarks = [{ id: '1', excerpt: 'Hello', userId: 'user-1', createdAt: new Date() }];
        mockPrisma.bookmark.findMany.mockResolvedValue(bookmarks);
        mockPrisma.bookmark.count.mockResolvedValue(1);

        // Act
        const dal = new LoggedBookmarksDal();
        const result = await dal.getUserBookmarks({ page: 1, limit: 10 });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.items).toHaveLength(1);
        expect(mockPrisma.bookmark.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { userId: 'user-1' } })
        );
      });
    });

    describe('error paths', () => {
      it('should return unauthorized error when session is null', async () => {
        // Arrange
        mockAuth.mockResolvedValue(null);

        // Act
        const dal = new LoggedBookmarksDal();
        const result = await dal.getUserBookmarks({ page: 1, limit: 10 });

        // Assert
        expect(result.success).toBe(false);
        expect(result.code).toBe('UNAUTHORIZED');
        expect(mockPrisma.bookmark.findMany).not.toHaveBeenCalled();
      });
    });
  });
});
```

**Key notes for DAL:**
- Instantiate the class in the test body (`new LoggedBookmarksDal()`) — do NOT import from `@/dal/logged` (that barrel file instantiates singletons at module load time).
- `$transaction` mock: `vi.fn((cb) => cb(mockPrisma))` — passes the mocked client to the callback.
- DAL methods call `this.getCurrentAuthContext()` which does a dynamic `await import('@/auth')`. The `vi.mock('@/auth', ...)` intercepts this dynamic import too.

---

### 4b. API Route Layer (`src/app/api/`)

**Architecture:** Route files export `GET`, `POST`, `PATCH`, `DELETE` handlers. They call `auth()` directly for HTTP-level 401 guard, then call DAL functions from `@/dal/data-access`.

**What to mock:** `@/auth` (HTTP auth guard) + `@/dal/data-access` (DAL barrel)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from './route';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const { mockAuth, mockGetBookmark, mockDeleteBookmark } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetBookmark: vi.fn(),
  mockDeleteBookmark: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mockAuth }));
vi.mock('@/dal/data-access', () => ({
  getBookmarkById: mockGetBookmark,
  deleteBookmark: mockDeleteBookmark,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(method = 'GET', body?: object) {
  return new Request('http://localhost/api/bookmarks/test-id', {
    method,
    ...(body && {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/bookmarks/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRequest('GET');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.status).toBe(401);
  });

  it('should return bookmark when authenticated and found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', username: 'test' } });
    mockGetBookmark.mockResolvedValue({ success: true, data: { id: 'test-id', excerpt: 'Hello' } });

    const req = makeRequest('GET');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-id' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.excerpt).toBe('Hello');
  });
});
```

**Key notes for API routes:**
- Next.js App Router handlers accept `(request, context)` — `context.params` is a `Promise` in Next.js 16+.
- `NextResponse.json()` in test environment uses the native `Response` class — `await res.json()` works normally.
- Both `@/auth` and DAL functions are called from the route, so both need mocking.

---

### 4c. Server Action Layer (`src/actions/`)

**Architecture:** Files start with `'use server'`. Import pre-bound functions from `@/dal/logged`. Actions are thin wrappers — they reshape args and call DAL.

**What to mock:** `@/dal/logged` (pre-bound named exports)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookmarkAction } from './bookmarks';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const { mockCreateBookmark } = vi.hoisted(() => ({
  mockCreateBookmark: vi.fn(),
}));

// Note: mock @/dal/logged (not @/dal/data-access) for server actions
vi.mock('@/dal/logged', () => ({
  createBookmark: mockCreateBookmark,
}));

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('createBookmarkAction()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call createBookmark with correct data and return result', async () => {
    const expected = { success: true, data: { id: 'new-id', excerpt: 'Sample' } };
    mockCreateBookmark.mockResolvedValue(expected);

    const result = await createBookmarkAction('msg-1', 'Sample excerpt');

    expect(mockCreateBookmark).toHaveBeenCalledWith({ messageId: 'msg-1', excerpt: 'Sample excerpt' });
    expect(result).toEqual(expected);
  });

  it('should propagate DAL error when createBookmark fails', async () => {
    mockCreateBookmark.mockResolvedValue({ success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' });

    const result = await createBookmarkAction('msg-1', 'Sample');

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHORIZED');
  });
});
```

**Key notes for Server Actions:**
- `'use server'` directive has zero effect in Vitest — functions are imported and called as regular async functions.
- Auth is NOT checked in actions — it is handled inside the DAL. No need to mock `@/auth` here.
- Import from `@/dal/logged` (named exports), not `@/dal/data-access`.

---

### 4d. Service Layer (`src/services/`)

**Architecture:** Services call external APIs via `fetch` or dedicated clients (SaludTools, Azure Blob, Docling). They require service-specific env vars.

**What to mock:** `global fetch` (or the external client module) + service env vars

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSaludToolsPatient } from './saludtools';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubEnv('SALUD_TOOLS_URL', 'https://api.test.saludtools.com');
vi.stubEnv('SALUD_TOOLS_KEY', 'test-api-key');

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('getSaludToolsPatient()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return patient data when API responds with 200', async () => {
    const patient = { id: 'P-1', name: 'Juan', birthDate: '1980-01-01' };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: patient }),
    });

    const result = await getSaludToolsPatient('P-1');

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Juan');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/patients/P-1'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining('test-api-key') }) })
    );
  });

  it('should return error when API responds with 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ message: 'Not found' }) });

    const result = await getSaludToolsPatient('unknown');

    expect(result.success).toBe(false);
  });
});
```

---

### 4e. Encryption Layer (`src/lib/encryption/`)

**Architecture:** Pure `crypto` functions. Reads `ENCRYPTION_KEY` env var (already stubbed in `src/test/setup.ts`). No external dependencies to mock.

```typescript
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/encryption';

describe('encrypt() / decrypt()', () => {
  describe('round-trip', () => {
    it('should decrypt back to original plaintext after encrypting', () => {
      const plaintext = 'Patient: Juan García | Diagnóstico: Hipertensión';
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('should produce different ciphertext on each call due to random IV', () => {
      const text = 'same input';
      const c1 = encrypt(text);
      const c2 = encrypt(text);
      expect(c1).not.toBe(c2);
      // Both still decrypt correctly
      expect(decrypt(c1)).toBe(text);
      expect(decrypt(c2)).toBe(text);
    });
  });

  describe('error paths', () => {
    it('should throw when given invalid base64 ciphertext', () => {
      expect(() => decrypt('not-valid-base64!!')).toThrow();
    });
  });
});
```

**Note:** `ENCRYPTION_KEY` is already stubbed in `src/test/setup.ts` as a valid base64-encoded 32-byte key. No per-test stub needed.

---

### 4f. Hook Layer (`src/hooks/`) — requires jsdom

**Prerequisites:**
```bash
pnpm add -D @testing-library/react @testing-library/jest-dom jsdom
```

**Per-file directive required:**
```typescript
// @vitest-environment jsdom
```

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBookmarks } from './useBookmarks';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn().mockReturnValue({
    data: { user: { id: 'user-1', username: 'test' } },
    status: 'authenticated',
  }),
}));

vi.mock('swr', () => ({
  default: vi.fn().mockReturnValue({
    data: [{ id: '1', excerpt: 'Hello' }],
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

describe('useBookmarks()', () => {
  it('should return bookmarks list when authenticated', async () => {
    const { result } = renderHook(() => useBookmarks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bookmarks).toHaveLength(1);
    expect(result.current.bookmarks[0].excerpt).toBe('Hello');
  });
});
```

---

### 4g. Component Layer (`src/components/`) — requires jsdom

**Prerequisites:** Same as Hook layer.

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarkButton } from './BookmarkButton';

vi.mock('@/actions/bookmarks', () => ({
  createBookmarkAction: vi.fn().mockResolvedValue({ success: true, data: { id: 'new-id' } }),
}));

describe('BookmarkButton', () => {
  it('should render a button with accessible label', () => {
    render(<BookmarkButton messageId="msg-1" excerpt="Text" />);
    expect(screen.getByRole('button', { name: /bookmark/i })).toBeInTheDocument();
  });

  it('should call createBookmarkAction when clicked', async () => {
    render(<BookmarkButton messageId="msg-1" excerpt="Text" />);
    fireEvent.click(screen.getByRole('button', { name: /bookmark/i }));
    // Verify action was called
    const { createBookmarkAction } = await import('@/actions/bookmarks');
    expect(createBookmarkAction).toHaveBeenCalledWith('msg-1', 'Text');
  });
});
```

---

### 4h. Context Provider Layer (`src/context/`) — requires jsdom

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { UserProvider, useUserContext } from './user-context';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn().mockReturnValue({
    data: { user: { id: 'user-1', username: 'doctest', name: 'Dr. Test' } },
    status: 'authenticated',
  }),
}));

describe('useUserContext()', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserProvider>{children}</UserProvider>
  );

  it('should provide user data from session when authenticated', () => {
    const { result } = renderHook(() => useUserContext(), { wrapper });
    expect(result.current.user?.username).toBe('doctest');
  });
});
```

---

### 4i. AI Layer (`src/lib/ai/`)

For the AI layer, delegate to the existing `/ai-test --build <path>` skill. It has comprehensive SDK mock patterns for OpenAI, Anthropic, Gemini, LangChain, and Pinecone. The TDD skill handles all other layers directly.

SDK mock patterns are documented in `.claude/skills/ai-test-runner/SKILL.md`.

---

## 5. Coverage Targets by Layer

| Layer | Functions | Branches | Lines | Notes |
|-------|-----------|----------|-------|-------|
| AI (`src/lib/ai/`) | 80% | 70% | 80% | Existing vitest.config.ts thresholds |
| DAL (`src/dal/`) | 80% | 70% | 80% | Match AI standards |
| API Routes (`src/app/api/`) | 90% | 75% | 85% | Every HTTP method must be tested |
| Server Actions (`src/actions/`) | 85% | 70% | 80% | Auth + DAL error paths |
| Services (`src/services/`) | 75% | 65% | 75% | External APIs harder to cover |
| Encryption (`src/lib/encryption/`) | 95% | 90% | 95% | Security-critical code |
| Hooks (`src/hooks/`) | 70% | 60% | 70% | React lifecycle complexity |
| Components (`src/components/`) | 60% | 50% | 60% | Interaction-focused |
| Context (`src/context/`) | 70% | 60% | 70% | Provider + consumer patterns |

---

## 6. Common Prisma Mock Shapes

Build the Prisma mock only with the methods your test actually uses. Here is a reference for common models:

```typescript
// Minimal ChatRoom mock
const mockChatRoom = {
  chatRoom: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((cb) => cb(mockPrisma)),
};

// Minimal User mock
const mockUser = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

// ServiceResponse shape (what DAL methods return)
const successResponse = { success: true, data: { /* your data */ } };
const errorResponse = { success: false, error: 'Not found', code: 'NOT_FOUND' };
const unauthorizedResponse = { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
```

---

## 7. Anti-Patterns to Avoid

**Testing implementation details:**
```typescript
// BAD — tests internal state
expect(mockPrisma.bookmark.findMany).toHaveBeenCalledTimes(1);

// GOOD — tests output contract
expect(result.data?.items).toHaveLength(1);
// (verifying the mock was called is acceptable as a secondary assertion, not the primary one)
```

**Using `any` to silence type errors:**
```typescript
// BAD
const mockFn = vi.fn() as any;

// GOOD
const mockFn = vi.fn<[string], Promise<ServiceResponse<Bookmark>>>();
```

**Shared mutable state between tests:**
```typescript
// BAD — test 2 is contaminated by test 1
let dal: LoggedBookmarksDal;
beforeAll(() => { dal = new LoggedBookmarksDal(); });

// GOOD — fresh instance per test
it('should ...', async () => {
  const dal = new LoggedBookmarksDal();
  // ...
});
```

**Asserting only on mock calls (not output):**
```typescript
// BAD — doesn't verify what the caller receives
expect(mockGetBookmark).toHaveBeenCalled();

// GOOD — verifies the actual return value
expect(result.success).toBe(true);
expect(result.data?.id).toBe('bookmark-1');
```

**Order-dependent tests:**
```typescript
// BAD — test B only works if test A ran first
it('should create bookmark', ...) // sets up global state
it('should delete previously created bookmark', ...) // depends on above

// GOOD — each test sets up its own state in Arrange phase
```

---

## 8. vi.hoisted() — Required Pattern for Class Mocks

When mocking a class that is imported at module load time (like `@/lib/prisma`), use `vi.hoisted()` to create the mock references before the module graph resolves:

```typescript
// Correct order — vi.hoisted() runs before imports
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    bookmark: { create: mockCreate },
  },
}));

import { LoggedBookmarksDal } from './bookmarks'; // now safely uses the mock
```

**Why:** Without `vi.hoisted()`, the `mockCreate` reference would be `undefined` at the time `vi.mock()` executes because JavaScript hoists `vi.mock()` calls but not regular variable declarations.

---

## 9. Zod Schema Tests

For any function that calls `.parse()` or `.safeParse()`, write both valid and invalid data tests:

```typescript
describe('zod validation', () => {
  it('should accept valid input shape', () => {
    const result = createBookmarkSchema.safeParse({ messageId: 'msg-1', excerpt: 'Text' });
    expect(result.success).toBe(true);
  });

  it('should reject input with missing required field', () => {
    const result = createBookmarkSchema.safeParse({ messageId: 'msg-1' }); // missing excerpt
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('excerpt');
    }
  });

  it('should reject input with wrong type on id field', () => {
    const result = createBookmarkSchema.safeParse({ messageId: 123, excerpt: 'Text' }); // number, not string
    expect(result.success).toBe(false);
  });
});
```
