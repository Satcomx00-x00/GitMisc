import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitMiscChatParticipant } from '../commands/chatParticipant';
import type { AIStreamingProviderFactory, IConfigService, IAIStreamingProvider } from '../interfaces';
import type { Config } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeConfig(): Config {
  return {
    providers: {
      commit: { providerUrl: 'http://localhost:1234/v1', model: 'test-model', temperature: 0.5, maxTokens: 1000 },
    },
    commit: { conventionalCommits: true, maxMessageLength: 100, systemPrompt: '' },
    ui: { showNotifications: true, theme: 'dark' },
  };
}

function makeCancellationToken(cancelled = false) {
  return {
    isCancellationRequested: cancelled,
    onCancellationRequested: vi.fn(() => ({ dispose: vi.fn() })),
  };
}

function makeChatRequest(prompt: string) {
  return { prompt };
}

function makeChatContext() {
  return { history: [] };
}

function makeChatResponseStream() {
  return {
    markdown: vi.fn(),
    progress: vi.fn(),
    button: vi.fn(),
    anchor: vi.fn(),
    reference: vi.fn(),
    filetree: vi.fn(),
    push: vi.fn(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function* makeChunksIterable(chunks: readonly string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function buildDeps(overrides: {
  chunks?: readonly string[];
  streamError?: Error;
}): {
  configService: IConfigService;
  aiProviderFactory: AIStreamingProviderFactory;
  provider: IAIStreamingProvider;
} {
  const provider: IAIStreamingProvider = {
    generateMessage: vi.fn(),
    streamMessage: vi.fn().mockImplementation(
      overrides.streamError
        ? async function* () {
            throw overrides.streamError;
          }
        : () => makeChunksIterable(overrides.chunks ?? ['Hello', ', World!']),
    ),
  };

  const configService: IConfigService = {
    getConfig: vi.fn(() => makeConfig()),
    openOrCreateConfig: vi.fn(),
    dispose: vi.fn(),
  };

  const aiProviderFactory: AIStreamingProviderFactory = vi.fn(() => provider);

  return { configService, aiProviderFactory, provider };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GitMiscChatParticipant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams each chunk from the AI provider to the response stream', async () => {
    const { configService, aiProviderFactory } = buildDeps({ chunks: ['Hello', ', World!'] });
    const participant = new GitMiscChatParticipant(configService, aiProviderFactory);
    const response = makeChatResponseStream();
    const token = makeCancellationToken();

    await participant.handler(
      makeChatRequest('What is TypeScript?') as never,
      makeChatContext() as never,
      response as never,
      token as never,
    );

    expect(response.markdown).toHaveBeenCalledTimes(2);
    expect(response.markdown).toHaveBeenNthCalledWith(1, 'Hello');
    expect(response.markdown).toHaveBeenNthCalledWith(2, ', World!');
  });

  it('creates a provider from the commit provider config', async () => {
    const { configService, aiProviderFactory, provider } = buildDeps({ chunks: ['ok'] });
    const participant = new GitMiscChatParticipant(configService, aiProviderFactory);
    const response = makeChatResponseStream();
    const token = makeCancellationToken();

    await participant.handler(
      makeChatRequest('hello') as never,
      makeChatContext() as never,
      response as never,
      token as never,
    );

    const config = makeConfig();
    expect(aiProviderFactory).toHaveBeenCalledWith(config.providers.commit);
    expect(provider.streamMessage).toHaveBeenCalledWith(
      expect.any(String),
      'hello',
      expect.any(AbortSignal),
    );
  });

  it('passes the user prompt to streamMessage', async () => {
    const { configService, aiProviderFactory, provider } = buildDeps({ chunks: [] });
    const participant = new GitMiscChatParticipant(configService, aiProviderFactory);
    const response = makeChatResponseStream();
    const token = makeCancellationToken();

    await participant.handler(
      makeChatRequest('Explain async/await') as never,
      makeChatContext() as never,
      response as never,
      token as never,
    );

    expect(provider.streamMessage).toHaveBeenCalledWith(
      expect.any(String),
      'Explain async/await',
      expect.any(AbortSignal),
    );
  });

  it('writes an error message to the stream when streamMessage throws', async () => {
    const { configService, aiProviderFactory } = buildDeps({
      streamError: new Error('Connection refused'),
    });
    const participant = new GitMiscChatParticipant(configService, aiProviderFactory);
    const response = makeChatResponseStream();
    const token = makeCancellationToken();

    await participant.handler(
      makeChatRequest('hello') as never,
      makeChatContext() as never,
      response as never,
      token as never,
    );

    expect(response.markdown).toHaveBeenCalledWith(
      expect.stringContaining('Connection refused'),
    );
  });

  it('writes an error message when a non-Error is thrown', async () => {
    const provider: IAIStreamingProvider = {
      generateMessage: vi.fn(),
      streamMessage: vi.fn().mockImplementation(async function* () {
        throw 'something bad';
      }),
    };
    const configService: IConfigService = {
      getConfig: vi.fn(() => makeConfig()),
      openOrCreateConfig: vi.fn(),
      dispose: vi.fn(),
    };
    const participant = new GitMiscChatParticipant(configService, vi.fn(() => provider));
    const response = makeChatResponseStream();

    await participant.handler(
      makeChatRequest('hello') as never,
      makeChatContext() as never,
      response as never,
      makeCancellationToken() as never,
    );

    expect(response.markdown).toHaveBeenCalledWith(expect.stringContaining('something bad'));
  });

  it('converts the CancellationToken to an AbortSignal', async () => {
    const { configService, aiProviderFactory, provider } = buildDeps({ chunks: [] });
    const participant = new GitMiscChatParticipant(configService, aiProviderFactory);
    const response = makeChatResponseStream();
    const token = makeCancellationToken();

    await participant.handler(
      makeChatRequest('hi') as never,
      makeChatContext() as never,
      response as never,
      token as never,
    );

    expect(token.onCancellationRequested).toHaveBeenCalled();
    const [, , signal] = (provider.streamMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      AbortSignal,
    ];
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});
