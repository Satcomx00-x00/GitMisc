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
  readonly systemPrompt: string;
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

// ── Diff result ──

export interface DiffResult {
  readonly diff: string;
  readonly files: readonly string[];
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

export interface Repository {
  readonly rootUri: vscode.Uri;
  readonly inputBox: InputBox;
  readonly state: RepositoryState;
  diff(cached?: boolean): Promise<string>;
}

export interface InputBox {
  value: string;
}

export interface RepositoryState {
  readonly workingTreeChanges: readonly Change[];
  readonly indexChanges: readonly Change[];
  readonly mergeChanges: readonly Change[];
}

export interface Change {
  readonly uri: vscode.Uri;
  readonly originalUri: vscode.Uri;
  renameUri: vscode.Uri | undefined;
}
