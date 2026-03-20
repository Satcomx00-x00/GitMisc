import type * as vscode from 'vscode';
import type { Config, CommitConfig, DiffResult, ParsedCommitMessage, ProviderConfig, Repository } from './types';

// ── S: Single Responsibility — each interface owns one concern ──
// ── I: Interface Segregation — clients depend only on what they use ──
// ── D: Dependency Inversion — modules depend on these abstractions ──

/** Reads and watches workspace configuration. */
export interface IConfigService extends vscode.Disposable {
  getConfig(): Config;
  openOrCreateConfig(): Promise<void>;
}

/** Resolves authentication tokens from various sources. */
export interface ITokenResolver {
  resolve(token: string): string;
}

/** Provides access to Git repositories and diffs. */
export interface IGitService {
  isAvailable(): boolean;
  getRepository(): Repository | undefined;
  getDiff(repo: Repository): Promise<DiffResult>;
}

/** Generates a completion from an AI provider. (O: swap implementations without modifying callers) */
export interface IAIProvider {
  generateMessage(systemPrompt: string, userContent: string): Promise<string>;
}

/** Factory — creates a configured IAIProvider from runtime config. */
export type AIProviderFactory = (config: ProviderConfig) => IAIProvider;

/** Builds the system prompt sent to the AI. (O: extend with new prompt strategies) */
export interface IPromptBuilder {
  build(commitConfig: CommitConfig, files: readonly string[]): string;
}

/** Parses the raw AI response into a structured commit message. */
export interface IResponseParser {
  parse(raw: string): ParsedCommitMessage;
}

/** Shows messages to the user. */
export interface INotifier {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
