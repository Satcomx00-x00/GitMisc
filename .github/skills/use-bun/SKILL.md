---
name: use-bun
description: 'Use Bun instead of npm (or yarn/pnpm) as the JavaScript package manager and runtime. Use when: installing packages, running scripts, initializing projects, running tests, or any task where npm/yarn/pnpm would normally be used. Replaces npm install, npm run, npx, npm init, npm test. Covers bun add, bun run, bunx, bun init, bun test, lockfile (bun.lockb), and package.json scripts.'
argument-hint: 'Describe the task (e.g. "install deps", "run dev server", "add express")'
---

# Use Bun Instead of npm

Always prefer `bun` over `npm`, `yarn`, or `pnpm` for all package management and script execution tasks.

## Command Mapping

| npm / yarn / pnpm | Bun equivalent |
|---|---|
| `npm install` | `bun install` |
| `npm install <pkg>` | `bun add <pkg>` |
| `npm install -D <pkg>` | `bun add -d <pkg>` |
| `npm uninstall <pkg>` | `bun remove <pkg>` |
| `npm run <script>` | `bun run <script>` (or `bun <script>` for top-level scripts) |
| `npm test` | `bun test` |
| `npx <cmd>` | `bunx <cmd>` |
| `npm init` / `npm create` | `bun init` / `bunx create-<template>` |
| `npm ci` | `bun install --frozen-lockfile` |
| `npm update` | `bun update` |
| `npm publish` | `bun publish` |
| `node script.js` | `bun run script.js` (or `bun script.js`) |

## Procedure

### 1. Check / Install Bun
```bash
bun --version
# If not installed:
curl -fsSL https://bun.sh/install | bash
```

### 2. Initialize a New Project
```bash
bun init          # interactive (creates package.json, index.ts, tsconfig.json)
bun init -y       # skip prompts
```

### 3. Install Dependencies
```bash
bun install                    # install all deps from package.json
bun add express                # add a runtime dependency
bun add -d typescript          # add a dev dependency
bun add -g typescript          # add globally
bun remove lodash              # remove a package
```

### 4. Run Scripts
```bash
bun run dev       # run the "dev" script from package.json
bun run build     # run the "build" script
bun test          # run tests (built-in Jest-compatible test runner)
```

### 5. Execute One-off Packages
```bash
bunx create-next-app my-app
bunx eslint .
```

### 6. Lockfile
Bun uses `bun.lockb` (binary) instead of `package-lock.json` / `yarn.lock`. Commit it to source control.

To regenerate:
```bash
bun install --no-save   # install without modifying package.json
```

## Key Rules

- **Never suggest `npm`, `yarn`, or `pnpm`** — always use the Bun equivalent.
- **Do not generate `package-lock.json`** — Bun uses `bun.lockb`.
- **Use `bun test`** for running tests; it supports Jest-compatible syntax natively.
- **Use `bunx`** instead of `npx` to run package executables without installing.
- **`bun run` supports TypeScript directly** — no `ts-node` needed.
- When writing scripts in `package.json`, they can be run with `bun <script-name>` (shorthand) or `bun run <script-name>`.

## Example: Full Project Bootstrap

```bash
bun init -y
bun add express
bun add -d @types/express typescript
bun run build
bun test
```
