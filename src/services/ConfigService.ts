import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { Config } from '../types';
import type { IConfigService } from '../interfaces';

const DEFAULT_CONFIG: Config = {
  providers: {
    commit: {
      providerUrl: 'http://localhost:1234/v1',
      model: 'gemma3:4b',
      temperature: 0.5,
      maxTokens: 50000,
    },
  },
  commit: {
    conventionalCommits: true,
    maxMessageLength: 100,
    systemPrompt: [
      'You are a commit message generator following the Conventional Commits specification and commitlint rules.',
      'Analyze the git diff and respond using EXACTLY this template — no other text before or after:',
      '',
      'SUBJECT: <type>(<scope>): <short imperative description>',
      'BODY: <optional multi-line description explaining WHY, or leave empty>',
      '',
      'Rules for SUBJECT:',
      '- {{FORMAT}}',
      '- Maximum {{MAX_LENGTH}} characters total',
      '- Lowercase, imperative mood (e.g. "add", "fix", not "added", "fixes")',
      '- No trailing period',
      '',
      'Rules for BODY:',
      '- Optional: explain the motivation or additional context',
      '- Each line must be ≤ 72 characters',
      '- Leave empty if the subject is self-explanatory',
      '{{FILE_LIST}}',
    ].join('\n'),
  },
  ui: {
    showNotifications: true,
    theme: 'dark',
  },
};

/**
 * SRP: Responsible only for loading, caching, watching, and exposing config.
 * Implements Disposable so the file watcher is cleaned up.
 */
export class ConfigService implements IConfigService {
  private config: Config = DEFAULT_CONFIG;
  private readonly watcher: vscode.FileSystemWatcher;

  constructor() {
    this.reload();
    this.watcher = vscode.workspace.createFileSystemWatcher('**/config.json');
    this.watcher.onDidChange(() => this.reload());
    this.watcher.onDidCreate(() => this.reload());
    this.watcher.onDidDelete(() => {
      this.config = DEFAULT_CONFIG;
    });
  }

  dispose(): void {
    this.watcher.dispose();
  }

  getConfig(): Config {
    return this.config;
  }

  async openOrCreateConfig(): Promise<void> {
    const configPath = this.getConfigPath();
    if (!configPath) {
      vscode.window.showWarningMessage('GitMisc: No workspace folder open.');
      return;
    }

    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    }

    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
  }

  // ── Private ──

  private reload(): void {
    const configPath = this.getConfigPath();
    if (configPath && fs.existsSync(configPath)) {
      this.config = this.loadFromFile(configPath);
    }
  }

  private getConfigPath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    return path.join(folders[0].uri.fsPath, 'config.json');
  }

  private loadFromFile(filePath: string): Config {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<Config>;
      return ConfigService.merge(DEFAULT_CONFIG, parsed);
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  private static merge(defaults: Config, overrides: Partial<Config>): Config {
    return {
      providers: {
        commit: {
          ...defaults.providers.commit,
          ...overrides.providers?.commit,
          auth: overrides.providers?.commit?.auth
            ? {
                type: overrides.providers.commit.auth.type ?? 'none',
                token: overrides.providers.commit.auth.token ?? '',
              }
            : defaults.providers.commit.auth,
        },
      },
      commit: {
        ...defaults.commit,
        ...overrides.commit,
      },
      ui: {
        ...defaults.ui,
        ...overrides.ui,
      },
    };
  }
}
