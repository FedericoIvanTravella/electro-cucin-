import js from '@eslint/js'

export default [
  { ignores: ['node_modules/**', 'data/**', 'public/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }]
    }
  }
]
