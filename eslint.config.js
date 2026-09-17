// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.tsbuild/**', '**/node_modules/**', '**/*.d.ts'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // A floating promise in a mutation is a write that may never land and
      // will never report that it didn't.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // `any` is how a 106k-line untyped file happens, one reasonable
      // exception at a time.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  {
    files: ['apps/**/*.tsx', 'packages/design/src/react/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  /**
   * The two-designs law, as a lint rule.
   *
   * `architecture.test.ts` checks the same thing and gives the better
   * message; this catches it in the editor, before the test runs. Both
   * exist because the law is the one thing in this codebase that cannot
   * be allowed to erode quietly.
   */
  {
    files: ['apps/console/src/desktop/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/phone/**', '../phone', '../../phone'],
              message:
                'The desktop design cannot import from the phone design. They share @ow/domain and @ow/data and nothing else — duplicate it instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/console/src/phone/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/desktop/**', '../desktop', '../../desktop'],
              message:
                'The phone design cannot import from the desktop design. They share @ow/domain and @ow/data and nothing else — duplicate it instead.',
            },
          ],
        },
      ],
    },
  },

  // The domain is pure: no DOM, no React, no I/O. Its tsconfig already
  // withholds the DOM lib; this says why out loud.
  {
    files: ['packages/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', '@ow/design', '@ow/data'],
              message:
                'packages/domain is pure business logic — no UI, no I/O. If it needs one of those, it belongs in a different package.',
            },
          ],
        },
      ],
    },
  },

  { files: ['**/*.test.ts', '**/*.test.tsx', 'tools/**'], rules: { 'no-console': 'off' } },

  // Build config and one-off scripts sit outside every tsconfig, so the
  // type-aware rules have nothing to read. Lint them syntactically. Vite
  // compiles these itself, so a type error in one fails the build rather
  // than slipping through.
  {
    files: [
      '**/*.config.{js,ts,mjs}',
      'apps/console/build-stamp.ts',
      'tools/**',
      'eslint.config.js',
    ],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: { projectService: false, project: false },
      globals: { ...globals.node },
    },
  },
);
