import * as vscode from 'vscode';
import type { ProviderConfig } from './types';
import type { IAIProvider } from './interfaces';

// ── Concrete implementations (composition root only) ──
import { ConfigService } from './services/ConfigService';
import { TokenResolver } from './services/TokenResolver';
import { GitService } from './services/GitService';
import { OpenAIProvider } from './services/OpenAIProvider';
import { ConventionalCommitPromptBuilder } from './services/PromptBuilder';
import { ResponseParser } from './services/ResponseParser';
import { VSCodeNotifier } from './services/Notifier';
import { GenerateCommitCommand } from './commands/generateCommit';

/**
 * Composition root — the only place that knows about concrete classes.
 * All other modules depend exclusively on interfaces (DIP).
 */
export function activate(context: vscode.ExtensionContext): void {
  // Wire services
  const configService = new ConfigService();
  const tokenResolver = new TokenResolver();
  const gitService = new GitService();
  const promptBuilder = new ConventionalCommitPromptBuilder();
  const responseParser = new ResponseParser();
  const notifier = new VSCodeNotifier();

  // Factory: creates a fresh IAIProvider per invocation (config may change between calls)
  const aiProviderFactory = (config: ProviderConfig): IAIProvider =>
    new OpenAIProvider(config, tokenResolver);

  // Assemble command with all dependencies injected
  const generateCommit = new GenerateCommitCommand(
    configService,
    gitService,
    aiProviderFactory,
    promptBuilder,
    responseParser,
    notifier,
  );

  context.subscriptions.push(configService);

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmisc.generateCommitMessage', async () => {
      if (!gitService.isAvailable()) {
        notifier.error('GitMisc: Git extension is not available.');
        return;
      }
      await generateCommit.execute();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmisc.openConfig', () =>
      configService.openOrCreateConfig(),
    ),
  );
}

export function deactivate(): void {
  // nothing to clean up — Disposables handle teardown
}
