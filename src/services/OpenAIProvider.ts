import type { ProviderConfig, ChatCompletionRequest, ChatCompletionResponse } from '../types';
import type { IAIProvider, ITokenResolver } from '../interfaces';

const MAX_DIFF_CHARS = 50_000;
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * OCP: New providers (Anthropic, etc.) can implement IAIProvider without modifying this class.
 * DIP: Depends on ITokenResolver abstraction, not a concrete resolver.
 * SRP: Responsible only for calling an OpenAI-compatible chat/completions endpoint.
 */
export class OpenAIProvider implements IAIProvider {
  constructor(
    private readonly providerConfig: ProviderConfig,
    private readonly tokenResolver: ITokenResolver,
  ) {}

  async generateMessage(systemPrompt: string, userContent: string): Promise<string> {
    const truncated =
      userContent.length > MAX_DIFF_CHARS
        ? userContent.slice(0, MAX_DIFF_CHARS) + '\n\n[diff truncated]'
        : userContent;

    const body: ChatCompletionRequest = {
      model: this.providerConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: truncated },
      ],
      temperature: this.providerConfig.temperature,
      max_tokens: this.providerConfig.maxTokens,
    };

    const url = `${this.providerConfig.providerUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI provider returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI provider returned an empty response.');
    }

    return content.trim();
  }

  // ── Private ──

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.providerConfig.auth?.type === 'jwt') {
      const token = this.tokenResolver.resolve(this.providerConfig.auth.token);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }
}
