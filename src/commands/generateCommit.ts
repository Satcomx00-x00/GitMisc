import * as vscode from 'vscode';
import type { AIProviderFactory, IConfigService, IGitService, INotifier, IPromptBuilder, IResponseParser } from '../interfaces';

/**
 * DIP: Depends entirely on abstractions — no concrete service imports.
 * SRP: Orchestrates the generate-commit workflow only.
 */
export class GenerateCommitCommand {
  constructor(
    private readonly configService: IConfigService,
    private readonly gitService: IGitService,
    private readonly aiProviderFactory: AIProviderFactory,
    private readonly promptBuilder: IPromptBuilder,
    private readonly responseParser: IResponseParser,
    private readonly notifier: INotifier,
  ) {}

  async execute(): Promise<void> {
    const repo = this.gitService.getRepository();
    if (!repo) {
      this.notifier.warn('GitMisc: No Git repository found.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.SourceControl,
        title: 'Generating commit message…',
      },
      async () => {
        try {
          const context = await this.gitService.getDiff(repo);

          if (!context.diff.trim()) {
            this.notifier.warn('GitMisc: No changes to generate a commit message for.');
            return;
          }

          const config = this.configService.getConfig();
          const { systemMessage, userMessage } = this.promptBuilder.build(config.commit, context);
          const aiProvider = this.aiProviderFactory(config.providers.commit);
          const raw = await aiProvider.generateMessage(systemMessage, userMessage);

          const { subject, body } = this.responseParser.parse(raw);

          // maxMessageLength applies only to the subject line
          const maxLen = config.commit.maxMessageLength;
          const trimmedSubject = maxLen > 0 ? subject.slice(0, maxLen) : subject;

          repo.inputBox.value = body
            ? `${trimmedSubject}\n\n${body}`
            : trimmedSubject;

          if (config.ui.showNotifications) {
            this.notifier.info('GitMisc: Commit message generated.');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.notifier.error(`GitMisc: ${msg}`);
        }
      },
    );
  }
}
