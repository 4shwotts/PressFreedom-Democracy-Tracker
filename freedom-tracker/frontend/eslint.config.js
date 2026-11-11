// ESLint flat config: recommended JS rules, React, the rules of hooks, and
// jsx-a11y (catches accessibility mistakes in JSX before axe does).
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  { ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/'] },

  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    plugins: { 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // the project doesn't use PropTypes
      'react/prop-types': 'off',
      // scrollable regions must be keyboard-focusable (WCAG 2.1.1; axe rule
      // scrollable-region-focusable): the insight rail (complementary) and the
      // data-table panels (region) are given tabIndex={0} on purpose
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'], tags: ['aside'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },

  // config files, tests and the Playwright specs run in Node
  {
    files: ['*.config.js', 'e2e/**', 'checks/**', 'src/test/**', 'src/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  }
]
