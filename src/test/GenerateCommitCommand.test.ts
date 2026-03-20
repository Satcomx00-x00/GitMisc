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
import type { Config, DiffResult, Repository } from '../types';

// ── Shared fixtures ──────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<Config['commit']> = {}): Config {
  return {
    providers: { commit: { providerUrl: '', model: '', temperature: 0.5, maxTokens: 1000 } },
    commit: { conventionalCommits: true, maxMessageLength: 100, systemPrompt: '', ...overrides },
    ui: { showNotifications: true, theme: 'dark' },
  };
}

function makeRepo(initialValue = ''): Repository {
  return {
    rootUri: { fsPath: '/workspace', scheme: 'file' } as unknown as Repository['rootUri'],
    inputBox: { value: initialValue },
    state: { workingTreeChanges: [], indexChanges: [], mergeChanges: [] },
    diff: vi.fn().mockResolvedValue(''),
  };
}

// ── Helpers to build mocks ───────────────────────────────────────────────────

function buildDeps(overrides: {
  repo?: Repository | undefined;
  diff?: DiffResult;
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
    ...(overrides.showNotifications !== undefined
      ? {}
      : {}),
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
    getDiff: vi.fn(async () => overrides.diff ?? { diff: 'diff content', files: ['file.ts'] }),
  };

  const mockProvider: IAIProvider = {
    generateMessage: vi.fn(async () => overrides.rawAI ?? 'SUBJECT: feat: test\nBODY: '),
  };
  const aiProviderFactory: AIProviderFactory = vi.fn(() => mockProvider);

  const promptBuilder: IPromptBuilder = {
    build: vi.fn(() => 'system prompt'),
  };

  const responseParser: IResponseParser = {
    parse: vi.fn((raw: string) => {
      // Real parser logic for integration fidelity
      const subjectMatch = raw.match(/^SUBJECT:\s*(.+)/im);
      const bodyMatch = raw.match(/^BODY:\s*([\s\S]*)/im);
      const subject = subjectMatch ? subjectMatch[1].trim() : raw.trim();
      const body = bodyMatch ? bodyMatch[1].trim() : '';
      return { subject, body };
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
    const deps = buildDeps({ diff: { diff: '   ', files: [] } });
    await makeCommand(deps).execute();

    expect(deps.notifier.warn).toHaveBeenCalledWith(expect.stringContaining('No changes'));
    expect(deps.aiProviderFactory).not.toHaveBeenCalled();
  });

  it('sets inputBox.value to subject only when body is empty', async () => {
    const repo = makeRepo();
    const deps = buildDeps({ repo, rawAI: 'SUBJECT: feat(scope): add feature\nBODY: ' });

    await makeCommand(deps).execute();

    expect(repo.inputBox.value).toBe('feat(scope): add feature');
  });

  it('sets inputBox.value to subject + blank line + body when body is present', async () => {
    const repo = makeRepo();
    const deps = buildDeps({
      repo,
      rawAI: 'SUBJECT: fix(auth): handle expiry\nBODY: Token was not refreshed before expiry.',
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
      rawAI: 'SUBJECT: feat: ' + 'a'.repeat(200),
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
});
