// Flat ESLint config shared by every TS workspace package.
// Run from a package dir (`eslint src`) — ESLint walks up to this root config.
// Type-aware safety is enforced separately by `tsc` (pnpm typecheck); ESLint here is
// non-type-checked so it stays fast and does not require every file to be in a tsconfig.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/*.config.{js,cjs,mjs}',
      // apps/web is linted by Next's own ESLint (see apps/web/.eslintrc.json).
      'apps/web/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
