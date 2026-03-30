/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    // Skip bootstrap / squash commits that predate this config
    (commit) => commit.startsWith('Initial commit'),
    // Skip agent planning/scaffolding commits
    (commit) => commit.startsWith('Initial plan'),
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [1, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 200],
    // Warn but do not fail — long lines are common in AI-generated bodies
    'body-max-line-length': [1, 'always', 72],
  },
};
