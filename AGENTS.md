# GitMisc — Agent Coding Instructions

> These instructions apply to every agent (AI or human) contributing to this repository.
> They are **non-negotiable defaults** — get explicit approval before deviating from any rule here.

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [Repository Layout](#2-repository-layout)
3. [Toolchain & Scripts](#3-toolchain--scripts)
4. [TypeScript Conventions](#4-typescript-conventions)
5. [SOLID Principles](#5-solid-principles)
6. [Async & Concurrency](#6-async--concurrency)
7. [Error Handling](#7-error-handling)
8. [Testing Standards](#8-testing-standards)
9. [Performance Guidelines](#9-performance-guidelines)
10. [Security Rules](#10-security-rules)
11. [Module & File Conventions](#11-module--file-conventions)
12. [Commit Conventions](#12-commit-conventions)
13. [Code-Quality Gates](#13-code-quality-gates)
14. [Adding a New Feature — Checklist](#14-adding-a-new-feature--checklist)

---

## 1. Project Context

**GitMisc** is a VS Code extension that generates AI-powered commit messages.

| Concern | Implementation |
|---|---|
| Trigger | `gitmisc.generateCommitMessage` command (SCM title bar button) |
| Diff source | VS Code built-in Git extension — staged first, then unstaged |
| AI backend | Any OpenAI-compatible API (OpenAI, Ollama, LM Studio, …) |
| Output | Written directly to `repo.inputBox.value` |
| Config source | `config.json` at workspace root, file-watched at runtime |
| Bundle | Single `out/extension.js` via **esbuild** — zero runtime npm deps |

The extension is intentionally **zero-dependency at runtime**. Never add a package that ends up in the production bundle.

---

## 2. Repository Layout

```
src/
  extension.ts          ← Composition root only — wires every concrete class
  interfaces.ts         ← All abstractions (IConfigService, IGitService, …)
  types.ts              ← All TypeScript types (readonly, no mutation)

  commands/
    generateCommit.ts   ← Orchestration; depends on interfaces, never concrete classes

  services/
    ConfigService.ts    ← SRP: config loading + file watching
    GitService.ts       ← SRP: git API access
    OpenAIProvider.ts   ← SRP: HTTP request to AI endpoint
    PromptBuilder.ts    ← SRP: prompt template rendering
    ResponseParser.ts   ← SRP: parse raw AI string → ParsedCommitMessage
    TokenResolver.ts    ← SRP: env-var / plain token resolution
    Notifier.ts         ← SRP: VS Code notification surface

  test/
    __mocks__/vscode.ts ← Hand-written VS Code test double
    *.test.ts           ← One test file per service/command
```

**Rules:**
- `extension.ts` is the **only** file that `import`s concrete service classes.
- Every other module imports only from `interfaces.ts` or `types.ts`.
- No circular imports — `types.ts` and `interfaces.ts` never import from `services/` or `commands/`.

---

## 3. Toolchain & Scripts

| Script | Purpose |
|---|---|
| `bun run compile` | Type-check + esbuild (dev, unminified) |
| `bun run watch` | esbuild in watch mode |
| `bun run package` | Production bundle (minified, tree-shaken) |
| `bun run lint` | `tsc --noEmit` — hard type-check, zero errors expected |
| `bun run test` | Vitest in `node` environment |
| `bun run commitlint` | Validate HEAD commit message |

> **Use Bun**: always use `bun run` instead of `npm run`. See `.github/skills/use-bun/SKILL.md`.

---

## 4. TypeScript Conventions

### 4.1 Strictness — Non-Negotiable

`tsconfig.json` enables `"strict": true`. **All** of the following are active:

- `strictNullChecks` — every nullable type must be explicitly handled
- `noImplicitAny` — all values must be typed
- `strictFunctionTypes` — function signatures are checked covariantly
- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`

Never suppress these with `// @ts-ignore` or `// @ts-expect-error` except as a last resort and with an explanation comment.

### 4.2 Type Declarations

```ts
// ✅ Good — import type avoids runtime cost
import type { Config, DiffResult } from '../types';
import type { IConfigService } from '../interfaces';

// ❌ Bad — value import for type-only usage
import { Config } from '../types';
```

```ts
// ✅ Good — explicit return types on all public API
async function fetchCompletion(req: ChatCompletionRequest): Promise<string> { … }

// ❌ Bad — inferred return on exported function
export async function fetchCompletion(req: ChatCompletionRequest) { … }
```

### 4.3 `unknown` over `any`

```ts
// ✅ Good — narrow before use
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
}

// ❌ Bad — loses all type safety
} catch (err: any) {
  this.notifier.error(err.message);
}
```

### 4.4 Readonly by Default

All data structures that flow through the system are **immutable**:

```ts
// ✅ Good — all types in types.ts use readonly
interface DiffResult {
  readonly diff: string;
  readonly files: readonly string[];
}

// ✅ Good — readonly arrays in function signatures
function build(config: CommitConfig, files: readonly string[]): string
```

Use `Readonly<T>`, `ReadonlyArray<T>`, and `as const` whenever mutability is unneeded.

### 4.5 Discriminated Unions & Narrowing

Prefer discriminated unions over optional fields for branching logic:

```ts
// ✅ Good
type AuthConfig =
  | { readonly type: 'none' }
  | { readonly type: 'jwt'; readonly token: string };

// When consuming:
if (auth.type === 'jwt') {
  headers['Authorization'] = `Bearer ${resolver.resolve(auth.token)}`;
}

// ❌ Bad — optional fields obscure intent
interface AuthConfig {
  type: string;
  token?: string;
}
```

### 4.6 Utility Types

Use built-in utility types instead of manual type constructions:

| Need | Use |
|---|---|
| Partial clone of interface | `Partial<T>` |
| All-required version | `Required<T>` |
| Read-only version | `Readonly<T>` |
| A subset of keys | `Pick<T, 'a' \| 'b'>` |
| Without certain keys | `Omit<T, 'a'>` |
| From union to object | `Record<K, V>` |
| Return type extraction | `ReturnType<typeof fn>` |
| Awaited promise type | `Awaited<Promise<T>>` |

### 4.7 No Implicit `boolean` Coercions on Objects

```ts
// ✅ Good
if (diff.length > 0) { … }
if (repo !== undefined) { … }

// ❌ Bad
if (diff) { … }
if (repo) { … }
```

Exception: built-in string presence check `if (!str.trim())` is fine.

### 4.8 Enums → Union Types

Never use TypeScript `enum`. Use string literal unions or `const` + `typeof` patterns:

```ts
// ✅ Good
export type AuthType = 'none' | 'jwt';

// ❌ Bad
enum AuthType { none = 'none', jwt = 'jwt' }
```

### 4.9 Branded / Opaque Types

Use branded types for string values that must not be interchanged:

```ts
type CommitSubject = string & { readonly _brand: 'CommitSubject' };
type BearerToken   = string & { readonly _brand: 'BearerToken' };

// Prevents accidentally passing a raw token where a subject is expected
```

Apply branding at domain boundaries (e.g., output of `ResponseParser`, output of `TokenResolver`).

### 4.10 Satisfies Operator

Use `satisfies` to validate literal objects against an interface without widening the type:

```ts
const DEFAULT_CONFIG = {
  commit: { conventionalCommits: true, maxMessageLength: 72, systemPrompt: '' },
  ui:     { showNotifications: true, theme: 'default' },
} satisfies Partial<Config>;
```

---

## 5. SOLID Principles

This codebase is the **reference implementation** of SOLID in a VS Code extension. Every PR must preserve or improve compliance.

### 5.1 Single Responsibility (SRP)

One class, one reason to change.

| Class | Its single responsibility |
|---|---|
| `ConfigService` | Load + watch `config.json` |
| `GitService` | Acquire git API + get diff |
| `OpenAIProvider` | Construct + send HTTP request |
| `PromptBuilder` | Render prompt template |
| `ResponseParser` | Parse AI response string |
| `TokenResolver` | Resolve env-var or plain token |
| `Notifier` | Surface messages to the user |
| `GenerateCommitCommand` | **Orchestrate** — wire services, manage flow |

If a class starts doing two things, **extract** the second responsibility into a new class.

### 5.2 Open / Closed (OCP)

Extend via new implementations; never modify stable interfaces.

```ts
// ✅ Adding a new provider: implement IAIProvider, register in extension.ts
export class AnthropicProvider implements IAIProvider {
  async generateMessage(systemPrompt: string, userContent: string): Promise<string> { … }
}

// ❌ Bad — patching OpenAIProvider with Anthropic-specific branching
```

### 5.3 Liskov Substitution (LSP)

Any concrete class must be fully substitutable for its interface. Test doubles in `__mocks__/` must satisfy the same contract — use `vi.fn()` returning the exact expected shape, never weaken postconditions.

### 5.4 Interface Segregation (ISP)

Keep interfaces small and focused. A consumer that only needs `getConfig()` should not be forced to depend on `openOrCreateConfig()`.

When adding a method to an existing interface, ask: **can every current consumer implement it?** If not, create a new, narrower interface and compose via intersection or a second constructor parameter.

### 5.5 Dependency Inversion (DIP)

High-level modules (`GenerateCommitCommand`) depend on abstractions (`IAIProvider`, `IGitService`, …), never on concrete classes.

```ts
// ✅ Good — constructor injection of interfaces
constructor(
  private readonly gitService: IGitService,
  private readonly aiProviderFactory: AIProviderFactory,
  …
) {}

// ❌ Bad — direct instantiation inside a business class
constructor() {
  this.gitService = new GitService();
}
```

`extension.ts` is the **sole** exception — it is the composition root.

---

## 6. Async & Concurrency

### 6.1 Always `await` Promises

No floating promises. Every `Promise` must be `await`-ed, `.then()`'d, or explicitly returned.

```ts
// ✅ Good
await vscode.workspace.openTextDocument(uri);

// ❌ Bad — fire-and-forget loses errors
vscode.workspace.openTextDocument(uri);
```

### 6.2 AbortSignal & Timeouts

All outbound network calls **must** carry a timeout via `AbortSignal.timeout(ms)`:

```ts
const response = await fetch(url, {
  method: 'POST',
  signal: AbortSignal.timeout(120_000), // 120 s
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

Never use bare `fetch` without a signal in production code.

### 6.3 Structured Concurrency with `Promise.all`

Fan out independent async operations together; never serialize what can run in parallel:

```ts
// ✅ Good — both fetches start simultaneously
const [staged, unstaged] = await Promise.all([
  repo.diff(true),
  repo.diff(false),
]);

// ❌ Bad — unstaged waits unnecessarily for staged
const staged   = await repo.diff(true);
const unstaged = await repo.diff(false);
```

Use `Promise.allSettled` when partial failure is acceptable and all results are needed regardless.

### 6.4 Lazy Initialization

Services that acquire external resources (e.g., `GitService` acquiring the VS Code git API) must initialize **lazily** on first use, not in the constructor. Constructors must never be `async`.

```ts
// ✅ Good
private getGitAPI(): GitAPI | undefined {
  if (this._api === undefined) {
    const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
    this._api = ext?.isActive ? ext.api : undefined;
  }
  return this._api;
}
```

### 6.5 No Shared Mutable State Across Invocations

Services are typically singletons wired by `extension.ts`. They **must not** store mutable state that is shared across concurrent invocations. Keep per-invocation state local to the method, or use a factory pattern for stateful operations.

### 6.6 Cancellation Propagation

When VS Code provides a `CancellationToken`, convert it to an `AbortSignal` and thread it through every async call:

```ts
function cancellationToSignal(token: vscode.CancellationToken): AbortSignal {
  const controller = new AbortController();
  token.onCancellationRequested(() => controller.abort());
  return controller.signal;
}
```

---

## 7. Error Handling

### 7.1 Narrow at the Boundary

Catch blocks always narrow `unknown` before accessing properties:

```ts
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  this.notifier.error(`GitMisc: ${msg}`);
}
```

### 7.2 Propagate, Don't Swallow

Only catch errors at **orchestration boundaries** (`GenerateCommitCommand.execute`). Service methods should let errors propagate so the caller can decide how to handle them.

```ts
// ✅ Good — OpenAIProvider throws; GenerateCommitCommand catches and notifies the user
async generateMessage(…): Promise<string> {
  if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
  …
}

// ❌ Bad — silently swallowing inside a service
async generateMessage(…): Promise<string> {
  try { … } catch { return ''; }
}
```

### 7.3 HTTP Status Codes

Always assert `response.ok` before parsing the body:

```ts
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
const data = (await response.json()) as ChatCompletionResponse;
```

### 7.4 Typed Error Classes

For domain errors that callers may need to distinguish, extend `Error`:

```ts
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
```

---

## 8. Testing Standards

### 8.1 Framework

**Vitest** v4, `node` environment. The VS Code host is replaced by `src/test/__mocks__/vscode.ts`.

### 8.2 File Naming & Co-location

| Source | Test |
|---|---|
| `src/services/ResponseParser.ts` | `src/test/ResponseParser.test.ts` |
| `src/commands/generateCommit.ts` | `src/test/GenerateCommitCommand.test.ts` |

One test file per source file. No exceptions.

### 8.3 Mock Pattern — Interfaces, Not Implementations

Always create mocks **against the interface shape**, not by importing the concrete class:

```ts
// ✅ Good
const mockParser: IResponseParser = {
  parse: vi.fn().mockReturnValue({ subject: 'feat: add x', body: '' }),
};

// ❌ Bad — test is coupled to concrete class internals
const parser = new ResponseParser();
vi.spyOn(parser, 'parse').mockReturnValue(…);
```

### 8.4 Isolation Rules

- `beforeEach(() => vi.clearAllMocks())` — always reset mocks between tests
- Use `vi.stubGlobal('fetch', vi.fn())` for HTTP tests in `OpenAIProvider`
- Never call real network, file system, or VS Code APIs in unit tests
- `vscode.window.withProgress` mock must invoke the callback synchronously

### 8.5 Test Structure — AAA

Every test follows **Arrange / Act / Assert** with blank lines separating sections:

```ts
it('truncates diff to 50 000 characters', async () => {
  // Arrange
  const longDiff = 'x'.repeat(60_000);
  fetchMock.mockResolvedValueOnce(okResponse('feat: big diff'));

  // Act
  await provider.generateMessage('sys', longDiff);

  // Assert
  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  expect(body.messages[1].content).toHaveLength(50_000);
});
```

### 8.6 Coverage Expectations

| Metric | Minimum |
|---|---|
| Statements | 90 % |
| Branches | 85 % |
| Functions | 95 % |

Run `bun run test --coverage` before every PR. Do not merge if thresholds drop.

### 8.7 Test Naming — Behaviour, Not Implementation

```ts
// ✅ Good — describes observable behaviour
it('returns empty string when the environment variable is not set')
it('trims trailing blank lines from the parsed body')
it('falls back to the raw string as subject when the template is not followed')

// ❌ Bad — describes internal implementation
it('calls parse method')
it('works correctly')
```

### 8.8 Property-Based Testing for Parsers

For `ResponseParser` and `PromptBuilder`, complement example-based tests with property-based tests using `@fast-check/vitest` when edge-case coverage is hard to enumerate manually:

```ts
import { fc, test } from '@fast-check/vitest';

test.prop([fc.string()])('parse never throws on arbitrary input', (raw) => {
  expect(() => parser.parse(raw)).not.toThrow();
});
```

---

## 9. Performance Guidelines

### 9.1 Diff Truncation

`OpenAIProvider` enforces a hard 50 000-character cap before sending to the API. **Do not remove this guard.** Any new provider must implement the same or a configurable cap.

```ts
const MAX_DIFF_CHARS = 50_000;
const safeDiff = userContent.length > MAX_DIFF_CHARS
  ? userContent.slice(0, MAX_DIFF_CHARS)
  : userContent;
```

Define `MAX_DIFF_CHARS` as a named constant. Never use magic numbers.

### 9.2 No Synchronous I/O in the Extension Host

The VS Code extension host is single-threaded and shared with the UI. **Never** use `fs.readFileSync`, `child_process.execSync`, or any blocking I/O. Use async APIs or VS Code's workspace fs abstraction.

### 9.3 Disposable Registration

Every watcher, event handler, or subscription **must** be registered in `context.subscriptions` or disposed in a `dispose()` method. Unregistered disposables are memory leaks.

```ts
// ✅ Good
const watcher = vscode.workspace.createFileSystemWatcher(pattern);
context.subscriptions.push(watcher);

// ❌ Bad — watcher is never cleaned up
vscode.workspace.createFileSystemWatcher(pattern);
```

### 9.4 Cache Config Reads

`configService.getConfig()` returns a cached object. When a method calls it multiple times, cache the result in a local `const`:

```ts
const config = this.configService.getConfig();
// use config.commit, config.ui, config.providers — do not call getConfig() again in this scope
```

### 9.5 Tree-Shaking Friendly Imports

Import only specific named exports. Barrel-style namespace imports block esbuild's tree-shaker:

```ts
// ✅ Good
import { createReadStream } from 'node:fs';

// ❌ Bad
import * as fs from 'node:fs';
```

---

## 10. Security Rules

### 10.1 Token Handling

- Tokens are **never** logged, emitted via output channels, or included in user-facing error messages.
- `TokenResolver.resolve()` is the **only** place that reads `process.env`. No other file may access `process.env` directly.
- When `auth.type === 'none'`, no `Authorization` header is sent.

### 10.2 No Hardcoded Secrets

`config.json` in the repository contains only `localhost`/example values. Never commit real API keys or tokens. User-specific `config.json` files with real credentials must be `.gitignore`'d.

### 10.3 Untrusted Input Sanitization

Diff content from git and AI response strings are **untrusted**. They:

- Must **never** be interpolated into shell commands or `exec()` calls.
- Must **never** be passed to `eval()` or `new Function()`.
- Must **never** be written to the file system as executable code.
- Must be treated as opaque plain-text strings only.

### 10.4 HTTP Security

- Use `https://` in all non-localhost production configurations.
- Never disable TLS certificate validation.
- Assert `response.ok` before parsing the body to avoid processing malformed error payloads.
- Do not follow redirects blindly — validate the final URL origin before parsing.

### 10.5 Prompt Injection Awareness

`ResponseParser` extracts only the `SUBJECT` and `BODY` fields and trims the result. **Do not** execute, interpolate into code, or interpret AI responses beyond this structured extraction. Treat every AI output as potentially adversarial text.

---

## 11. Module & File Conventions

### 11.1 Import Order

1. Node.js built-ins (`node:fs`, `node:path`)
2. External packages (`vscode`)
3. Internal `types.ts` and `interfaces.ts`
4. Internal service / command imports
5. Relative imports within the same directory

Separate each group with a blank line.

### 11.2 `import type` for Type-Only Imports

Use `import type` whenever the import is used only as a TypeScript type annotation — it emits zero JS and avoids circular-dependency issues at runtime:

```ts
import type { Config, DiffResult } from '../types';
import * as vscode from 'vscode'; // value import — needed at runtime
```

### 11.3 No Default Exports

Every module uses **named exports** only. Default exports make refactoring harder and impede tree-shaking:

```ts
// ✅ Good
export class ResponseParser implements IResponseParser { … }

// ❌ Bad
export default class ResponseParser { … }
```

### 11.4 No Barrel (`index.ts`) Files

Do not create `index.ts` re-exports. Import directly from the source file. Barrels hide dependency graphs and slow the TypeScript language server.

### 11.5 Constants Over Magic Numbers/Strings

Every non-trivial literal must be named:

```ts
// ✅ Good
const MAX_DIFF_CHARS   = 50_000;
const REQUEST_TIMEOUT  = 120_000;
const COMMIT_ENDPOINT  = '/chat/completions';

// ❌ Bad
const safeDiff = diff.slice(0, 50000);
```

---

## 12. Commit Conventions

This repository uses **Conventional Commits** enforced by `commitlint`.

### 12.1 Format

```
<type>(<scope>): <subject>

[optional body — max 72 chars per line]

[optional footer]
```

### 12.2 Allowed Types

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring, no behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `build` | Build system / dependency changes |
| `ci` | CI/CD pipeline changes |
| `chore` | Housekeeping (config, tooling, scripts) |
| `style` | Formatting, no logic change |
| `revert` | Reverting a previous commit |

### 12.3 Subject Rules (enforced by commitlint)

- **`lower-case`** — no capital first letter
- **Max 100 characters** for the header line
- **No period** at the end of the subject
- **Imperative mood** — "add feature", not "added" or "adds"

### 12.4 Scope Examples

```
feat(openai-provider): add retry on 429 status
fix(response-parser): trim trailing newlines in body
test(token-resolver): cover unset env var case
perf(git-service): parallelize staged and unstaged diff fetches
```

---

## 13. Code-Quality Gates

Every change **must** pass all gates. Agents must not propose PRs that break any gate.

| Gate | Command | Requirement |
|---|---|---|
| Type check | `bun run lint` | Zero `tsc` errors, zero implicit `any` |
| Tests | `bun run test` | All tests green |
| Coverage | `bun run test --coverage` | Meets thresholds in §8.6 |
| Build | `bun run compile` | Produces `out/extension.js` without errors |
| Commit lint | `bun run commitlint` | HEAD commit follows §12 |

Run all gates locally with:

```sh
bun run lint && bun run test && bun run compile
```

CI enforces `commitlint` on every PR and push to `main` via `.github/workflows/commitlint.yml`.

---

## 14. Adding a New Feature — Checklist

Use this checklist for every non-trivial change:

- [ ] **Interface first**: define or extend an interface in `interfaces.ts` before writing any implementation
- [ ] **Types first**: add new data shapes to `types.ts` with `readonly` fields
- [ ] **Implement the service**: one class, one file, one responsibility
- [ ] **Wire in `extension.ts`**: `new ConcreteClass(…)` only here, nowhere else
- [ ] **Write tests (TDD preferred)**: mock the interface; cover happy path + at least 2 edge cases per branch
- [ ] **No magic numbers**: extract all literals to named constants
- [ ] **No `any`**: all new code passes `tsc --noEmit` with zero errors
- [ ] **All Promises awaited**: zero floating promises
- [ ] **AbortSignal on every fetch**: no bare `fetch(url, { body })` without a timeout signal
- [ ] **Disposables registered**: all new watchers/subscriptions added to `context.subscriptions`
- [ ] **Gates pass**: `bun run lint && bun run test && bun run compile`
- [ ] **Commit message valid**: follows Conventional Commits spec (§12)

---

*Last updated: 2026-03-20 — aligned to GitMisc v0.1.0 architecture.*
