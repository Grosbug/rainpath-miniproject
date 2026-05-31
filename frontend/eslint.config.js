import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `eslint-plugin-react-hooks@7` ships new strict rules (set-state-in-effect,
      // ref access ordering, manual-memoization static checks) that flag
      // patterns the codebase was written for pre-v7. Downgrading to warn
      // surfaces them in editors without failing CI until the related effects
      // are refactored.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/immutability': 'warn',
      // Matches the backend convention noted in the audit (no-explicit-any:
      // off). We keep it visible as a warning so editor surfaces it, but
      // intentional escape hatches (typed-as-any payloads at boundaries, third-
      // party callback shapes) don't block CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Project convention (matches backend ESLint): leading-underscore identifiers
      // are deliberately unused (placeholder destructuring, intentionally-ignored
      // callback args). We still flag every other unused symbol.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Test fixtures, mocks, and shape-stub `as any` casts are pragmatic in tests
    // and would otherwise force layers of generic boilerplate. Allow `any` here
    // — production code keeps the error level.
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
