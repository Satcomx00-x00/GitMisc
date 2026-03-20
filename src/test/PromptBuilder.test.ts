import { describe, expect, it } from 'vitest';
import { ConventionalCommitPromptBuilder } from '../services/PromptBuilder';
import type { CommitConfig } from '../types';

// Minimal template that exercises all three placeholders
const TEMPLATE = '{{FORMAT}}\nmax={{MAX_LENGTH}}{{FILE_LIST}}';

function makeConfig(overrides: Partial<CommitConfig> = {}): CommitConfig {
  return {
    conventionalCommits: true,
    maxMessageLength: 100,
    systemPrompt: TEMPLATE,
    ...overrides,
  };
}

describe('ConventionalCommitPromptBuilder', () => {
  const builder = new ConventionalCommitPromptBuilder();

  it('inserts conventional commit format instructions when enabled', () => {
    const prompt = builder.build(makeConfig(), []);
    expect(prompt).toContain('Conventional Commits format');
    expect(prompt).toContain('feat, fix, docs');
  });

  it('inserts plain format instructions when conventional commits is disabled', () => {
    const prompt = builder.build(makeConfig({ conventionalCommits: false }), []);
    expect(prompt).toContain('concise commit message');
    expect(prompt).not.toContain('Conventional Commits');
  });

  it('replaces {{MAX_LENGTH}} with the configured value', () => {
    const prompt = builder.build(makeConfig({ maxMessageLength: 72 }), []);
    expect(prompt).toContain('max=72');
  });

  it('replaces {{FILE_LIST}} with a formatted file list when files are provided', () => {
    const prompt = builder.build(makeConfig(), ['index.ts', 'utils.ts']);
    expect(prompt).toContain('Changed files: index.ts, utils.ts');
  });

  it('replaces {{FILE_LIST}} with empty string when no files are provided', () => {
    const prompt = builder.build(makeConfig(), []);
    expect(prompt).not.toContain('Changed files');
    // The trailing placeholder should disappear cleanly
    expect(prompt.endsWith('max=100')).toBe(true);
  });

  it('replaces all occurrences of each placeholder', () => {
    const multiTemplate = '{{MAX_LENGTH}} and again {{MAX_LENGTH}}';
    const prompt = builder.build(makeConfig({ systemPrompt: multiTemplate }), []);
    expect(prompt).toBe('100 and again 100');
  });
});
