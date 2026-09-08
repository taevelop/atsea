import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'atsea2d/**', '.tools/**', 'assets/**', 'public/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
];
