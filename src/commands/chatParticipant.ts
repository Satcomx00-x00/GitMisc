import * as vscode from 'vscode';
import type { AIStreamingProviderFactory, IConfigService } from '../interfaces';

const CHAT_SYSTEM_PROMPT =
  'You are a helpful coding assistant integrated into VS Code. ' +
  'Help the user with coding questions, code reviews, debugging, and git-related tasks. ' +
  'Be concise and clear in your responses. ' +
  'When showing code, use appropriate markdown code fences with the language identifier.';

/**
 * DIP: Depends entirely on abstractions — no concrete service imports.
 * SRP: Orchestrates the VS Code chat participant workflow only.
 */
export class GitMiscChatParticipant {
  constructor(
    private readonly configService: IConfigService,
    private readonly aiProviderFactory: AIStreamingProviderFactory,
  ) {}

  readonly handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<void> => {
    const config = this.configService.getConfig();
    const provider = this.aiProviderFactory(config.providers.commit);
    const signal = cancellationToSignal(token);

    try {
      for await (const chunk of provider.streamMessage(
        CHAT_SYSTEM_PROMPT,
        request.prompt,
        signal,
      )) {
        response.markdown(chunk);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      response.markdown(`\n\n**GitMisc error:** ${msg}`);
    }
  };
}

function cancellationToSignal(token: vscode.CancellationToken): AbortSignal {
  const controller = new AbortController();
  token.onCancellationRequested(() => controller.abort());
  return controller.signal;
}
