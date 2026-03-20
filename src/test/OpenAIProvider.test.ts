import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITokenResolver } from '../interfaces';
import { OpenAIProvider } from '../services/OpenAIProvider';
import type { ProviderConfig } from '../types';

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    providerUrl: 'http://localhost:1234/v1',
    model: 'test-model',
    temperature: 0.5,
    maxTokens: 1000,
    ...overrides,
  };
}

function makeResponse(content: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      id: 'test-id',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    }),
    text: async () => `HTTP ${status}`,
  };
}

const passthroughResolver: ITokenResolver = { resolve: (t) => t };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OpenAIProvider', () => {
  it('POSTs to <providerUrl>/chat/completions and returns trimmed content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse('  feat: add thing  ')));
    const provider = new OpenAIProvider(makeConfig(), passthroughResolver);

    const result = await provider.generateMessage('system', 'diff content');

    expect(result).toBe('feat: add thing');
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('test-model');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
  });

  it('strips trailing slashes from providerUrl', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse('feat: test')));
    const provider = new OpenAIProvider(
      makeConfig({ providerUrl: 'http://localhost:1234/v1/' }),
      passthroughResolver,
    );
    await provider.generateMessage('sys', 'usr');
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
  });

  it('adds Authorization: Bearer header when auth type is jwt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse('feat: test')));
    const resolver: ITokenResolver = { resolve: vi.fn(() => 'secret-token') };
    const config = makeConfig({ auth: { type: 'jwt', token: '$MY_TOKEN' } });

    await new OpenAIProvider(config, resolver).generateMessage('sys', 'usr');

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers['Authorization']).toBe('Bearer secret-token');
    expect(resolver.resolve).toHaveBeenCalledWith('$MY_TOKEN');
  });

  it('omits Authorization header when auth type is none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse('feat: test')));
    const config = makeConfig({ auth: { type: 'none', token: '' } });

    await new OpenAIProvider(config, passthroughResolver).generateMessage('sys', 'usr');

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers['Authorization']).toBeUndefined();
  });

  it('throws with status code when provider returns an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' }),
    );
    const provider = new OpenAIProvider(makeConfig(), passthroughResolver);

    await expect(provider.generateMessage('sys', 'usr')).rejects.toThrow(
      'AI provider returned 401',
    );
  });

  it('throws when the choices array is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'x', choices: [] }),
      }),
    );
    const provider = new OpenAIProvider(makeConfig(), passthroughResolver);

    await expect(provider.generateMessage('sys', 'usr')).rejects.toThrow('empty response');
  });

  it('truncates diff content longer than 50 000 characters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse('feat: test'));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIProvider(makeConfig(), passthroughResolver);

    await provider.generateMessage('sys', 'x'.repeat(60_000));

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('[diff truncated]');
    expect(userMsg.content.length).toBeLessThan(60_000);
  });
});
