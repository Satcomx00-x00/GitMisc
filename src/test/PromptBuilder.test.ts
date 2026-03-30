import { describe, expect, it } from 'vitest';
import { CopilotCommitPromptBuilder } from '../services/PromptBuilder';
import type { CommitConfig, CommitContext } from '../types';

function makeConfig(overrides: Partial<CommitConfig> = {}): CommitConfig {
  return {
    conventionalCommits: true,
    maxMessageLength: 100,
    customInstructions: '',
    ...overrides,
  };
}

function makeContext(overrides: Partial<CommitContext> = {}): CommitContext {
  return {
    diff: 'diff --git a/file.ts b/file.ts\n+added line',
    files: ['file.ts'],
    repositoryName: 'my-repo',
    branchName: 'main',
    recentCommitMessages: [],
    ...overrides,
  };
}

describe('CopilotCommitPromptBuilder', () => {
  const builder = new CopilotCommitPromptBuilder();

  it('returns a BuiltPrompt with non-empty systemMessage and userMessage', () => {
    const prompt = builder.build(makeConfig(), makeContext());
    expect(prompt.systemMessage.trim()).toBeTruthy();
    expect(prompt.userMessage.trim()).toBeTruthy();
  });

  it('includes step-by-step thinking instructions in the system message', () => {
    const { systemMessage } = builder.build(makeConfig(), makeContext());
    expect(systemMessage).toContain('step-by-step');
    expect(systemMessage).toContain('CODE CHANGES');
  });

  it('includes conventional commits format instruction in system message when enabled', () => {
    const { systemMessage } = builder.build(makeConfig({ conventionalCommits: true }), makeContext());
    expect(systemMessage).toContain('Conventional Commits format');
    expect(systemMessage).toContain('feat, fix, docs');
  });

  it('omits conventional commits format instruction in system message when disabled', () => {
    const { systemMessage } = builder.build(makeConfig({ conventionalCommits: false }), makeContext());
    expect(systemMessage).not.toContain('Conventional Commits format');
  });

  it('includes maxMessageLength value in the system message', () => {
    const { systemMessage } = builder.build(makeConfig({ maxMessageLength: 72 }), makeContext());
    expect(systemMessage).toContain('72');
  });

  it('includes repository name and branch name in the user message', () => {
    const { userMessage } = builder.build(
      makeConfig(),
      makeContext({ repositoryName: 'my-repo', branchName: 'feature-branch' }),
    );
    expect(userMessage).toContain('my-repo');
    expect(userMessage).toContain('feature-branch');
  });

  it('includes recent commits in the user message when provided', () => {
    const { userMessage } = builder.build(
      makeConfig(),
      makeContext({ recentCommitMessages: ['feat: add login', 'fix: resolve bug'] }),
    );
    expect(userMessage).toContain('feat: add login');
    expect(userMessage).toContain('fix: resolve bug');
    expect(userMessage).toContain('RECENT COMMITS');
  });

  it('omits the recent commits section when none are provided', () => {
    const { userMessage } = builder.build(makeConfig(), makeContext({ recentCommitMessages: [] }));
    expect(userMessage).not.toContain('# RECENT COMMITS');
  });

  it('includes changed file names in the user message', () => {
    const { userMessage } = builder.build(
      makeConfig(),
      makeContext({ files: ['src/app.ts', 'src/utils.ts'] }),
    );
    expect(userMessage).toContain('src/app.ts');
    expect(userMessage).toContain('src/utils.ts');
  });

  it('includes the diff content in the user message', () => {
    const diff = '+added line\n-removed line';
    const { userMessage } = builder.build(makeConfig(), makeContext({ diff }));
    expect(userMessage).toContain(diff);
  });

  it('includes custom instructions section when provided', () => {
    const { userMessage } = builder.build(
      makeConfig({ customInstructions: 'Use emoji in commit message' }),
      makeContext(),
    );
    expect(userMessage).toContain('Use emoji in commit message');
    expect(userMessage).toContain('CUSTOM INSTRUCTIONS');
  });

  it('omits custom instructions section when empty', () => {
    const { userMessage } = builder.build(makeConfig({ customInstructions: '' }), makeContext());
    expect(userMessage).not.toContain('CUSTOM INSTRUCTIONS');
  });

  it('omits custom instructions section when whitespace-only', () => {
    const { userMessage } = builder.build(makeConfig({ customInstructions: '   ' }), makeContext());
    expect(userMessage).not.toContain('CUSTOM INSTRUCTIONS');
  });

  it('includes a ```text code block reminder in the user message', () => {
    const { userMessage } = builder.build(makeConfig(), makeContext());
    expect(userMessage).toContain('```text');
  });
});
