import { afterEach, describe, expect, it } from 'vitest';
import { TokenResolver } from '../services/TokenResolver';

describe('TokenResolver', () => {
  const resolver = new TokenResolver();

  afterEach(() => {
    delete process.env['GITMISC_TEST_TOKEN'];
  });

  it('returns empty string for empty input', () => {
    expect(resolver.resolve('')).toBe('');
  });

  it('returns the token as-is for plain string tokens', () => {
    expect(resolver.resolve('my-secret-jwt-abc123')).toBe('my-secret-jwt-abc123');
  });

  it('resolves $ENV_VAR syntax from process.env', () => {
    process.env['GITMISC_TEST_TOKEN'] = 'resolved-value';
    expect(resolver.resolve('$GITMISC_TEST_TOKEN')).toBe('resolved-value');
  });

  it('returns empty string when $ENV_VAR is not set', () => {
    delete process.env['GITMISC_UNSET_VAR'];
    expect(resolver.resolve('$GITMISC_UNSET_VAR')).toBe('');
  });
});
