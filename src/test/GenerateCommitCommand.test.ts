import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateCommitCommand } from '../commands/generateCommit';
import type {
    AIProviderFactory,
    IAIProvider,
    IConfigService,
    IGitService,
    INotifier,
    IPromptBuilder,
    IResponseParser,
} from '../interfaces';
import type { BuiltPrompt, CommitContext, Config, Repository } from '../types';

// ── Shared fixtures ──────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<Config['commit']> = {}): Config {
  return {
    providers: { commit: { providerUrl: '', model: '', temperature: 0.5, maxTokens: 1000 } },
    commit: { conventionalCommits: true, maxMessageLength: 100, customInstructions: '', ...overrides },
    ui: { showNotifications: true, theme: 'dark' },
  };
}

function makeRepo(initialValue = ''): Repository {
  return {
    rootUri: { fsPath: '/workspace', scheme: 'file' } as unknown as Repository['rootUri'],
    inputBox: { value: initialValue },
    state: { workingTreeChanges: [], indexChanges: [], mergeChanges: [], HEAD: { name: 'main' } },
    diff: vi.fn().mockResolvedValue(''),
    log: vi.fn().mockResolvedValue([]),
  };
}

function makeContext(overrides: Partial<CommitContext> = {}): CommitContext {
  return {
    diff: 'diff content',
    files: ['file.ts'],
    repositoryName: 'workspace',
    branchName: 'main',
    recentCommitMessages: [],
    ...overrides,
  };
}

// ── Helpers to build mocks ───────────────────────────────────────────────────

function buildDeps(overrides: {
  repo?: Repository | undefined;
  context?: CommitContext;
  rawAI?: string;
  config?: Partial<Config['commit']>;
  showNotifications?: boolean;
}): {
  configService: IConfigService;
  gitService: IGitService;
  aiProviderFactory: AIProviderFactory;
  promptBuilder: IPromptBuilder;
  responseParser: IResponseParser;
  notifier: INotifier;
  repo: Repository | undefined;
} {
  const repo = overrides.repo !== undefined ? overrides.repo : makeRepo();
  const config = makeConfig({
    ...overrides.config,
  });
  if (overrides.showNotifications !== undefined) {
    (config.ui as { showNotifications: boolean }).showNotifications = overrides.showNotifications;
  }

  const configService: IConfigService = {
    getConfig: vi.fn(() => config),
    openOrCreateConfig: vi.fn(),
    dispose: vi.fn(),
  };

  const gitService: IGitService = {
    isAvailable: vi.fn(() => true),
    getRepository: vi.fn(() => repo),
    getDiff: vi.fn(async () => overrides.context ?? makeContext()),
  };

  const mockProvider: IAIProvider = {
    generateMessage: vi.fn(async () => overrides.rawAI ?? '```text\nfeat: test\n```'),
  };
  const aiProviderFactory: AIProviderFactory = vi.fn(() => mockProvider);

  const builtPrompt: BuiltPrompt = { systemMessage: 'system', userMessage: 'user' };
  const promptBuilder: IPromptBuilder = {
    build: vi.fn(() => builtPrompt),
  };

  const responseParser: IResponseParser = {
    parse: vi.fn((raw: string) => {
      // Extract content from ```text block if present, otherwise use raw
      const match = /```text\s*([\s\S]+?)\s*```/.exec(raw);
      const message = (match?.[1] ?? raw).trim();
      const lines = message.split('\n');
      const subject = lines[0]?.trim() || message.trim();
      let bodyStart = 1;
      if (lines[1]?.trim() === '') {
        bodyStart = 2;
      }
      const bodyLines = lines.slice(bodyStart);
      while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1]?.trim() === '') {
        bodyLines.pop();
      }
      return { subject, body: bodyLines.join('\n') };
    }),
  };

  const notifier: INotifier = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return { configService, gitService, aiProviderFactory, promptBuilder, responseParser, notifier, repo };
}

function makeCommand(deps: ReturnType<typeof buildDeps>): GenerateCommitCommand {
  return new GenerateCommitCommand(
    deps.configService,
    deps.gitService,
    deps.aiProviderFactory,
    deps.promptBuilder,
    deps.responseParser,
    deps.notifier,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GenerateCommitCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('warns the user when no repository is found', async () => {
    const deps = buildDeps({ repo: undefined });
    (deps.gitService.getRepository as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    await makeCommand(deps).execute();

    expect(deps.notifier.warn).toHaveBeenCalledWith(expect.stringContaining('No Git repository'));
    expect(deps.aiProviderFactory).not.toHaveBeenCalled();
  });

  it('warns the user when the diff is empty', async () => {
    const deps = buildDeps({ context: makeContext({ diff: '   ' }) });
    await makeCommand(deps).execute();

    expect(deps.notifier.warn).toHaveBeenCalledWith(expect.stringContaining('No changes'));
    expect(deps.aiProviderFactory).not.toHaveBeenCalled();
  });

  it('sets inputBox.value to subject only when body is empty', async () => {
    const repo = makeRepo();
    const deps = buildDeps({ repo, rawAI: '```text\nfeat(scope): add feature\n```' });

    await makeCommand(deps).execute();

    expect(repo.inputBox.value).toBe('feat(scope): add feature');
  });

  it('sets inputBox.value to subject + blank line + body when body is present', async () => {
    const repo = makeRepo();
    const deps = buildDeps({
      repo,
      rawAI: '```text\nfix(auth): handle expiry\n\nToken was not refreshed before expiry.\n```',
    });

    await makeCommand(deps).execute();

    expect(repo.inputBox.value).toBe(
      'fix(auth): handle expiry\n\nToken was not refreshed before expiry.',
    );
  });

  it('truncates subject to maxMessageLength', async () => {
    const repo = makeRepo();
    const deps = buildDeps({
      repo,
      rawAI: '```text\nfeat: ' + 'a'.repeat(200) + '\n```',
      config: { maxMessageLength: 20 },
    });

    await makeCommand(deps).execute();

    expect(repo.inputBox.value.length).toBeLessThanOrEqual(20);
  });

  it('shows an info notification on success when showNotifications is true', async () => {
    const deps = buildDeps({ showNotifications: true });
    await makeCommand(deps).execute();

    expect(deps.notifier.info).toHaveBeenCalledWith(expect.stringContaining('generated'));
  });

  it('does not show info notification when showNotifications is false', async () => {
    const deps = buildDeps({ showNotifications: false });
    await makeCommand(deps).execute();

    expect(deps.notifier.info).not.toHaveBeenCalled();
  });

  it('calls notifier.error when the AI provider throws', async () => {
    const deps = buildDeps({});
    (deps.aiProviderFactory as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      generateMessage: vi.fn().mockRejectedValue(new Error('Connection refused')),
    }));

    await makeCommand(deps).execute();

    expect(deps.notifier.error).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
    expect(deps.notifier.info).not.toHaveBeenCalled();
  });

  it('passes the full CommitContext to the prompt builder', async () => {
    const context = makeContext({
      repositoryName: 'my-repo',
      branchName: 'feature-x',
      recentCommitMessages: ['feat: previous commit'],
    });
    const deps = buildDeps({ context });

    await makeCommand(deps).execute();

    expect(deps.promptBuilder.build).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        repositoryName: 'my-repo',
        branchName: 'feature-x',
        recentCommitMessages: ['feat: previous commit'],
      }),
    );
  });
});
