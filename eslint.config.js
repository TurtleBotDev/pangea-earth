import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  { ignores: ['node_modules/**', '.qa/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-duplicate-imports': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: 'error',
      curly: ['error', 'all'],
    },
  },
  {
    files: ['app.js', 'motion.js', 'src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.js', 'tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        // These names are evaluated inside Playwright's browser context.
        Cesium: 'readonly',
        pangea: 'readonly',
        renderErrors: 'readonly',
      },
    },
  },
]);
