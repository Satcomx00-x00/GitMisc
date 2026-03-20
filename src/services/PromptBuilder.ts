import type { CommitConfig } from '../types';
import type { IPromptBuilder } from '../interfaces';

/**
 * OCP: Create a new IPromptBuilder implementation for different prompt strategies
 *      (e.g., branch-name-aware, ticket-aware) without changing this class.
 * SRP: Responsible only for resolving the template from config into a final prompt.
 *
 * Supported placeholders in config's systemPrompt:
 *   {{FORMAT}}     — conventional-commit instructions or a plain summary line
 *   {{MAX_LENGTH}} — commit.maxMessageLength value
 *   {{FILE_LIST}}  — "\nChanged files: a.ts, b.ts" or empty string
 */
export class ConventionalCommitPromptBuilder implements IPromptBuilder {
  build(commitConfig: CommitConfig, files: readonly string[]): string {
    const fileList = files.length > 0 ? `\nChanged files: ${files.join(', ')}` : '';

    const format = commitConfig.conventionalCommits
      ? `Use Conventional Commits format: type(scope): description
Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
Infer the scope from the changed files when possible.`
      : 'Write a concise commit message summarizing the changes.';

    return commitConfig.systemPrompt
      .replace(/\{\{FORMAT\}\}/g, format)
      .replace(/\{\{MAX_LENGTH\}\}/g, String(commitConfig.maxMessageLength))
      .replace(/\{\{FILE_LIST\}\}/g, fileList);
  }
}
