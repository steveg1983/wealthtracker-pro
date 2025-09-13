// Conventional Commits rules
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'docs',
        'test',
        'build',
        'ci',
        'chore',
        'revert'
      ]
    ],
    'scope-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-case': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}

