import * as vscode from 'vscode';
import type { ProviderConfig } from './types';
import type { IAIStreamingProvider } from './interfaces';

// ── Concrete implementations (composition root only) ──
import { ConfigService } from './services/ConfigService';
import { TokenResolver } from './services/TokenResolver';
import { GitService } from './services/GitService';
import { OpenAIProvider } from './services/OpenAIProvider';
import { ConventionalCommitPromptBuilder } from './services/PromptBuilder';
import { ResponseParser } from './services/ResponseParser';
import { VSCodeNotifier } from './services/Notifier';
import { GenerateCommitCommand } from './commands/generateCommit';
import { GitMiscChatParticipant } from './commands/chatParticipant';

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

  // Factory: creates a fresh IAIStreamingProvider per invocation (config may change between calls).
  // IAIStreamingProvider extends IAIProvider, so it is also usable wherever IAIProvider is expected.
  const aiProviderFactory = (config: ProviderConfig): IAIStreamingProvider =>
    new OpenAIProvider(config, tokenResolver);

  // Assemble commit-message command with all dependencies injected
  const generateCommit = new GenerateCommitCommand(
    configService,
    gitService,
    aiProviderFactory,
    promptBuilder,
    responseParser,
    notifier,
  );

  // Assemble chat participant with all dependencies injected
  const chatParticipant = new GitMiscChatParticipant(configService, aiProviderFactory);
  const participant = vscode.chat.createChatParticipant('gitmisc.assistant', chatParticipant.handler);
  participant.iconPath = new vscode.ThemeIcon('sparkle');

  context.subscriptions.push(configService);
  context.subscriptions.push(participant);

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
