# GitMisc

AI-powered commit message generation for VS Code's Source Control panel.

## Features

- **One-click commit messages** — Press the ✨ button in the Source Control title bar to generate a commit message from your current diff
- **AI chat assistant** — Use `@gitmisc` in the VS Code Chat panel to ask coding and git questions, powered by your own AI provider
- **OpenAI-compatible** — Works with LM Studio, Ollama, OpenAI, or any OpenAI API-compatible provider
- **Streaming responses** — Chat replies stream token-by-token for a responsive experience
- **Conventional Commits** — Generates messages in `type(scope): description` format by default
- **JWT authentication** — Supports Bearer token auth for AI gateways
- **Workspace config** — Configure via a `config.json` file in your workspace root

## Setup

1. Install the extension
2. Ensure you have an OpenAI-compatible API running (e.g., [LM Studio](https://lmstudio.ai/) on `localhost:1234`)
3. Open the Command Palette → **GitMisc: Open Config** to review/edit your configuration

## Configuration

Create or edit `config.json` in your workspace root:

```json
{
  "providers": {
    "commit": {
      "providerUrl": "http://localhost:1234/v1",
      "model": "gemma3:4b",
      "temperature": 0.5,
      "maxTokens": 50000,
      "auth": {
        "type": "none",
        "token": ""
      }
    }
  },
  "commit": {
    "conventionalCommits": true,
    "maxMessageLength": 100
  },
  "ui": {
    "showNotifications": true,
    "theme": "dark"
  }
}
```

### Provider Settings

| Field | Description | Default |
|---|---|---|
| `providerUrl` | Base URL of the OpenAI-compatible API | `http://localhost:1234/v1` |
| `model` | Model name to use | `gemma3:4b` |
| `temperature` | Sampling temperature (0–2) | `0.5` |
| `maxTokens` | Max tokens for the response | `50000` |
| `auth.type` | `"none"` or `"jwt"` | `"none"` |
| `auth.token` | JWT token string, or `$ENV_VAR` to read from environment | `""` |

### Commit Settings

| Field | Description | Default |
|---|---|---|
| `conventionalCommits` | Use Conventional Commits format | `true` |
| `maxMessageLength` | Max characters for the generated message | `100` |

## Usage

1. Make changes in your Git repository
2. (Optionally) stage changes — the extension prefers staged diffs, falls back to unstaged
3. Click the ✨ sparkle icon in the Source Control title bar
4. The generated commit message appears in the commit input box

## Commands

| Command | Description |
|---|---|
| **GitMisc: Generate Commit Message** | Generate a commit message from the current diff |
| **GitMisc: Open Config** | Open or create the `config.json` configuration file |

## Chat Participant

Type `@gitmisc` in the VS Code Chat panel to talk to your configured AI provider directly:

```
@gitmisc Why does my async function not return the expected value?
@gitmisc Review this diff for potential bugs
@gitmisc Explain the difference between rebase and merge
```

The chat participant uses the same provider configuration as the commit-message feature (`providers.commit` in `config.json`) and streams responses token-by-token.

## Development

```bash
npm install
npm run compile    # Build the extension
npm run watch      # Build in watch mode
npm run lint       # Type-check with tsc
```

Press **F5** to launch the Extension Development Host for testing.

## License

MIT
```mermaid
flowchart TD
    Dev["👨‍💻 Developer"] -->|"git commit -m 'feat: ...' \ngit push origin main"| Main["📌 push to main"]

    Main --> CL["commitlint.yml\n▶ on push to main / PR"]
    Main --> RL["cliff.yml (Release)\n▶ on push to main"]

    subgraph Commitlint ["🔍 Commitlint CI"]
        CL --> CL1["checkout (fetch-depth: 0)"]
        CL1 --> CL2["wagoid/commitlint-github-action\nvalidates commits against\ncommitlint.config.mjs"]
        CL2 -->|"✖ error"| CL_FAIL["❌ CI fails"]
        CL2 -->|"✔ clean"| CL_OK["✅ CI passes"]
    end

    subgraph Release ["🚀 Release Pipeline (cliff.yml)"]
        direction TB

        subgraph J1 ["Job 1 — Test"]
            T1["checkout"] --> T2["setup Bun"]
            T2 --> T3["bun install --frozen-lockfile"]
            T3 --> T4["bun run lint\ntsc --noEmit"]
            T4 --> T5["bun run test\nvitest run"]
        end

        subgraph J2 ["Job 2 — Tag  (needs: test)"]
            G1["checkout (fetch-depth: 0)"] --> G2["mathieudutour/github-tag-action\nreads conventional commits\nsince last tag"]
            G2 -->|"feat → minor\nfix → patch\nBREAKING → major"| G3["🏷️ push tag  vX.Y.Z"]
            G2 -->|"chore/ci/docs only\n(default_bump: false)"| G4["⏭️ skip — no tag created"]
        end

        subgraph J3 ["Job 3 — Build  (needs: tag, if new_tag != '')"]
            B1["checkout @ new tag"] --> B2["setup Bun"]
            B2 --> B3["bun install --frozen-lockfile"]
            B3 --> B4["bun run vsce:package\nbunx @vscode/vsce package\n--no-dependencies"]
            B4 --> B5["📦 gitmisc-X.Y.Z.vsix"]
            B5 --> B6["upload-artifact  vsix"]
        end

        subgraph J4 ["Job 4 — Release  (needs: tag + build)"]
            R1["checkout @ new tag\n(fetch-depth: 0)"] --> R2["download-artifact  vsix"]
            R2 --> R3["orhun/git-cliff-action\ncliff.toml --latest\n→ CHANGELOG.md"]
            R3 --> R4["softprops/action-gh-release\nbody = cliff output\nfiles: *.vsix + CHANGELOG.md"]
            R4 --> R5["🎉 GitHub Release published\n.vsix + CHANGELOG attached"]
        end

        J1 -->|"✔ tests green"| J2
        J1 -->|"✖ tests fail"| STOP["🛑 pipeline stops"]
        J2 -->|"new tag pushed"| J3
        J3 -->|".vsix artifact ready"| J4
    end

    RL --> J1
```