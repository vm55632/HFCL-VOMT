/**
 * Conventional Commits, enforced by the commit-msg hook.
 * Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [1, 'always', 120],
  },
};
