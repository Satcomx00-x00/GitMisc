import type { CommitConfig, CommitContext, BuiltPrompt } from '../types';
import type { IPromptBuilder } from '../interfaces';

const STEP_BY_STEP_RULES: readonly string[] = [
  '1. Analyze the CODE CHANGES thoroughly to understand what has been modified.',
  '2. Identify the purpose of the changes to answer the *why* for the commit message, also considering the optionally provided RECENT COMMITS.',
  '3. Review the provided RECENT COMMITS to identify established commit message conventions. Focus on the format and style, ignoring commit-specific details like refs, tags, and authors.',
  '4. Remove any meta information like issue references, tags, or author names from the commit message. The developer will add them.',
];

/**
 * OCP: Create a new IPromptBuilder implementation for different prompt strategies
 *      without changing this class.
 * SRP: Responsible only for building the system and user prompts from commit context.
 *
 * Inspired by the vscode-copilot-chat GitCommitMessagePrompt approach:
 *   - System message guides the AI through a step-by-step thinking process.
 *   - User message supplies repository context, recent commits, changed files,
 *     the diff, and a reminder to wrap the output in a ```text code block.
 */
export class CopilotCommitPromptBuilder implements IPromptBuilder {
  build(commitConfig: CommitConfig, context: CommitContext): BuiltPrompt {
    return {
      systemMessage: this.buildSystemMessage(commitConfig),
      userMessage: this.buildUserMessage(commitConfig, context),
    };
  }

  // ── Private ──

  private buildSystemMessage(commitConfig: CommitConfig): string {
    const formatRule = commitConfig.conventionalCommits
      ? [
          '5. The commit message MUST use Conventional Commits format: type(scope): description',
          '   Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.',
          '   Infer the scope from the changed files when possible.',
        ].join('\n')
      : '5. Generate a thoughtful and succinct commit message for the given CODE CHANGES. It MUST follow the established writing conventions.';

    const maxLengthRule = `6. The subject line MUST NOT exceed ${commitConfig.maxMessageLength} characters and must use lowercase, imperative mood with no trailing period.`;
    const outputRule =
      '7. Now only show your message, wrapped with a single markdown ```text codeblock! Do not provide any explanations or details.';

    return [
      'You are an AI programming assistant, helping a software developer to come up with the best git commit message for their code changes.',
      'You excel in interpreting the purpose behind code changes to craft succinct, clear commit messages that adhere to the repository\'s guidelines.',
      '',
      '# First, think step-by-step:',
      ...STEP_BY_STEP_RULES,
      formatRule,
      maxLengthRule,
      outputRule,
    ].join('\n');
  }

  private buildUserMessage(commitConfig: CommitConfig, context: CommitContext): string {
    const parts: string[] = [];

    parts.push('# REPOSITORY DETAILS:');
    parts.push(`Repository name: ${context.repositoryName}`);
    parts.push(`Branch name: ${context.branchName}`);

    if (context.recentCommitMessages.length > 0) {
      parts.push('');
      parts.push('# RECENT COMMITS (For reference only, do not copy!):');
      for (const msg of context.recentCommitMessages) {
        parts.push(`- ${msg}`);
      }
    }

    if (context.files.length > 0) {
      parts.push('');
      parts.push('# CHANGED FILES:');
      parts.push(context.files.join(', '));
    }

    parts.push('');
    parts.push('# CODE CHANGES:');
    parts.push('```diff');
    parts.push(context.diff);
    parts.push('```');

    if (commitConfig.customInstructions.trim()) {
      parts.push('');
      parts.push('# CUSTOM INSTRUCTIONS:');
      parts.push(
        'When generating the commit message, please follow these user-provided instructions:',
      );
      parts.push(commitConfig.customInstructions.trim());
    }

    parts.push('');
    parts.push('Now generate a commit message that describes the CODE CHANGES.');
    parts.push(
      'DO NOT COPY commits from RECENT COMMITS, but use them as reference for the commit style.',
    );
    parts.push('ONLY return a single markdown code block, NO OTHER PROSE!');
    parts.push('```text');
    parts.push('commit message goes here');
    parts.push('```');

    return parts.join('\n');
  }
}
