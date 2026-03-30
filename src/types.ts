import type * as vscode from 'vscode';

// ── Auth ──

export type AuthType = 'none' | 'jwt';

export interface AuthConfig {
  readonly type: AuthType;
  readonly token: string;
}

// ── Provider ──

export interface ProviderConfig {
  readonly providerUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly auth?: AuthConfig;
}

// ── Commit ──

export interface CommitConfig {
  readonly conventionalCommits: boolean;
  readonly maxMessageLength: number;
  /** Optional user-provided custom instructions appended to the generated prompt. */
  readonly customInstructions: string;
}

// ── UI ──

export interface UIConfig {
  readonly showNotifications: boolean;
  readonly theme: string;
}

// ── Root config ──

export interface Config {
  readonly providers: {
    readonly commit: ProviderConfig;
  };
  readonly commit: CommitConfig;
  readonly ui: UIConfig;
}

// ── Commit context ──

export interface CommitContext {
  /** Combined diff string (staged or unstaged). */
  readonly diff: string;
  /** Base names of changed files. */
  readonly files: readonly string[];
  /** Human-readable repository name (basename of root path). */
  readonly repositoryName: string;
  /** Active branch name, or empty string when unavailable. */
  readonly branchName: string;
  /** Recent commit messages from the repository, for style reference. */
  readonly recentCommitMessages: readonly string[];
}

// ── Built prompt (system + user messages) ──

export interface BuiltPrompt {
  readonly systemMessage: string;
  readonly userMessage: string;
}

// ── Parsed AI response ──

export interface ParsedCommitMessage {
  /** Subject line, commitlint-compliant, ≤ maxMessageLength characters. */
  readonly subject: string;
  /** Optional body (free-form, lines ≤ 72 chars). Empty string when absent. */
  readonly body: string;
}

// ── OpenAI-compatible API ──

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature: number;
  readonly max_tokens: number;
}

export interface ChatCompletionChoice {
  readonly index: number;
  readonly message: ChatMessage;
  readonly finish_reason: string;
}

export interface ChatCompletionResponse {
  readonly id: string;
  readonly choices: readonly ChatCompletionChoice[];
}

// ── Git extension types (vscode.git) ──

export interface GitExtension {
  getAPI(version: 1): GitAPI;
}

export interface GitAPI {
  readonly repositories: readonly Repository[];
}

export interface LogOptions {
  readonly maxEntries?: number;
}

export interface Commit {
  readonly hash: string;
  readonly message: string;
}

export interface Head {
  readonly name?: string;
}

export interface Repository {
  readonly rootUri: vscode.Uri;
  readonly inputBox: InputBox;
  readonly state: RepositoryState;
  diff(cached?: boolean): Promise<string>;
  log(options?: LogOptions): Promise<readonly Commit[]>;
}

export interface InputBox {
  value: string;
}

export interface RepositoryState {
  readonly workingTreeChanges: readonly Change[];
  readonly indexChanges: readonly Change[];
  readonly mergeChanges: readonly Change[];
  readonly HEAD?: Head;
}

export interface Change {
  readonly uri: vscode.Uri;
  readonly originalUri: vscode.Uri;
  renameUri: vscode.Uri | undefined;
}
