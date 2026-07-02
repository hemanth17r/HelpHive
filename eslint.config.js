import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      'react-refresh/only-export-components': 'warn',
      'no-unused-vars': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'no-useless-escape': 'warn',
      'no-unreachable': 'warn',
      'no-undef': 'warn',
      'no-useless-assignment': 'warn'
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
